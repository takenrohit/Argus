"""
ARGUS — core/fight_cluster_detector.py

Clip-level "fight cluster" detector. Operates on REGIONS of the frame, not
on individual TrackedPerson IDs, so it still fires when YOLO loses tracks
mid-scuffle (the exact failure mode in the CAM-02 sample).

Two complementary signals are combined:

  1. Body clustering   — find tight groups of bodies (>= MIN_BODIES) that
                         are mutually close, compact, and in motion.
  2. Motion energy     — (optional) raw frame-difference energy inside the
                         cluster's bounding region. This catches limbs and
                         flailing bodies that YOLO failed to box.

The detector returns a list of FightCluster objects. Each cluster has its
own region, intensity, and alert_level — independent of per-person alerts.
You typically OR the cluster alert with the per-person alert from
DistressEngine when deciding whether to escalate the camera.
"""

from dataclasses import dataclass
from collections import deque
import numpy as np

from .yolo_tracker import TrackedPerson


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

CLUSTER_RADIUS        = 130   # px — two bodies within this distance link
MIN_BODIES            = 2     # min bodies to form a cluster
COMPACTNESS_MAX_AREA  = 90000 # cluster bbox area cap — wider groups aren't fights
BODY_MOTION_THRESHOLD = 8     # px/sec — a body counts as "moving"
MIN_MOVING_FRACTION   = 0.6   # >=60% of cluster bodies must be moving

# Frame-difference (optical-flow lite) tuning
MOTION_DIFF_THRESHOLD = 18    # pixel-intensity delta to count as motion
MOTION_AREA_FRACTION  = 0.18  # fraction of cluster region that must be active

# Smoothing — a cluster has to persist a few frames before alerting
SMOOTHING_FRAMES      = 6
SUSTAIN_FRACTION      = 0.5

# Alert thresholds (cluster intensity is 0..1)
LEVEL_THRESHOLDS = [
    (0.70, "CRITICAL"),
    (0.50, "REVIEW"),
    (0.32, "MONITOR"),
]


# ─────────────────────────────────────────────
#  DATA CLASSES
# ─────────────────────────────────────────────

@dataclass
class FightCluster:
    bbox: tuple[int, int, int, int]       # (x1, y1, x2, y2)
    person_ids: list[int]
    body_count: int
    avg_speed: float
    motion_energy: float                  # 0..1
    intensity: float                      # 0..1 (final smoothed score)
    alert_level: str                      # NONE / MONITOR / REVIEW / CRITICAL


# ─────────────────────────────────────────────
#  DETECTOR
# ─────────────────────────────────────────────

class FightClusterDetector:
    """
    Frame-level fight detector. Stateless except for a short rolling history
    used for temporal smoothing per spatial cell.
    """

    def __init__(self):
        # Bucket recent intensity per coarse 100x100 grid cell so we can
        # smooth across frames even as cluster IDs come and go.
        self._cell_history: dict[tuple[int, int], deque] = {}
        self._prev_gray = None  # previous grayscale frame for motion-diff

    # -----------------------------------------
    #  ENTRY POINT
    # -----------------------------------------

    def detect(
        self,
        persons: dict[int, TrackedPerson],
        frame=None,           # optional BGR ndarray for motion-energy signal
    ) -> list[FightCluster]:
        """
        Args:
            persons: same dict you pass to DistressEngine.analyse_all
            frame:   optional current camera frame (np.ndarray, HxWx3 BGR).
                     If provided, raw motion energy in cluster regions is
                     added to the score — strongly recommended for occluded
                     fights where YOLO loses bodies.
        """
        groups = self._cluster_bodies(persons)
        clusters: list[FightCluster] = []

        gray = None
        diff = None
        if frame is not None:
            gray = self._to_gray(frame)
            if self._prev_gray is not None and self._prev_gray.shape == gray.shape:
                diff = np.abs(gray.astype(np.int16) - self._prev_gray.astype(np.int16))

        for group in groups:
            cluster = self._score_group(group, persons, diff)
            if cluster is None:
                continue

            # Temporal smoothing per spatial cell
            cx = (cluster.bbox[0] + cluster.bbox[2]) // 2
            cy = (cluster.bbox[1] + cluster.bbox[3]) // 2
            cell = (cx // 100, cy // 100)
            hist = self._cell_history.setdefault(cell, deque(maxlen=SMOOTHING_FRAMES))
            hist.append(cluster.intensity)

            avg = sum(hist) / len(hist)
            sustained = sum(1 for x in hist if x > 0.32) / len(hist)
            smoothed = avg if sustained >= SUSTAIN_FRACTION else avg * 0.4

            cluster.intensity = round(min(smoothed, 1.0), 3)
            cluster.alert_level = self._level_for(cluster.intensity)
            clusters.append(cluster)

        # Decay history for cells we didn't see this frame
        active_cells = {((c.bbox[0] + c.bbox[2]) // 200, (c.bbox[1] + c.bbox[3]) // 200)
                        for c in clusters}
        for cell, hist in list(self._cell_history.items()):
            if cell not in active_cells and hist:
                hist.append(0.0)
                if all(v == 0.0 for v in hist):
                    del self._cell_history[cell]

        if gray is not None:
            self._prev_gray = gray

        clusters.sort(key=lambda c: c.intensity, reverse=True)
        return clusters

    # -----------------------------------------
    #  STEP 1 — Cluster nearby bodies
    # -----------------------------------------

    def _cluster_bodies(self, persons: dict[int, TrackedPerson]) -> list[list[int]]:
        """Union-Find by proximity → returns groups of person ids."""
        ids = list(persons.keys())
        if len(ids) < MIN_BODIES:
            return []

        parent = {i: i for i in ids}

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a, b):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for i, a in enumerate(ids):
            ax, ay = persons[a].center()
            for b in ids[i + 1:]:
                bx, by = persons[b].center()
                if np.hypot(ax - bx, ay - by) < CLUSTER_RADIUS:
                    union(a, b)

        groups: dict[int, list[int]] = {}
        for i in ids:
            groups.setdefault(find(i), []).append(i)

        return [g for g in groups.values() if len(g) >= MIN_BODIES]

    # -----------------------------------------
    #  STEP 2 — Score a single group
    # -----------------------------------------

    def _score_group(self, group, persons, diff):
        x1 = y1 = 10**9
        x2 = y2 = -10**9
        speeds = []

        for pid in group:
            p = persons[pid]
            if hasattr(p, "bbox") and p.bbox is not None:
                px1, py1, px2, py2 = p.bbox
            else:
                cx, cy = p.center()
                px1, py1, px2, py2 = cx - 30, cy - 60, cx + 30, cy + 60
            x1 = min(x1, int(px1)); y1 = min(y1, int(py1))
            x2 = max(x2, int(px2)); y2 = max(y2, int(py2))
            speeds.append(p.speed())

        bbox = (x1, y1, x2, y2)
        area = max(1, (x2 - x1) * (y2 - y1))
        if area > COMPACTNESS_MAX_AREA:
            return None  # too spread out — probably just a queue/crowd

        moving = sum(1 for s in speeds if s > BODY_MOTION_THRESHOLD)
        moving_fraction = moving / len(speeds)
        if moving_fraction < MIN_MOVING_FRACTION:
            return None

        avg_speed = float(np.mean(speeds))
        body_count = len(group)

        # Body density score
        density = body_count / (area / 10000.0)
        density_score = min(density / 3.0, 1.0)

        # Motion score from per-body speeds
        motion_score = min((avg_speed - BODY_MOTION_THRESHOLD) / 40.0, 1.0)
        motion_score = max(motion_score, 0.0)

        # Optional raw frame-difference energy inside the cluster region
        motion_energy = 0.0
        if diff is not None:
            h, w = diff.shape
            cx1 = max(0, x1); cy1 = max(0, y1)
            cx2 = min(w, x2); cy2 = min(h, y2)
            if cx2 > cx1 and cy2 > cy1:
                region = diff[cy1:cy2, cx1:cx2]
                active = (region > MOTION_DIFF_THRESHOLD).sum()
                motion_energy = active / region.size
                if motion_energy < MOTION_AREA_FRACTION:
                    motion_energy *= 0.4

        intensity = (
            0.35 * density_score
            + 0.25 * motion_score
            + 0.40 * min(motion_energy / 0.5, 1.0)
        )
        intensity = round(min(intensity, 1.0), 3)

        return FightCluster(
            bbox=bbox,
            person_ids=list(group),
            body_count=body_count,
            avg_speed=round(avg_speed, 2),
            motion_energy=round(motion_energy, 3),
            intensity=intensity,
            alert_level="NONE",
        )

    # -----------------------------------------
    #  Helpers
    # -----------------------------------------

    @staticmethod
    def _to_gray(frame_bgr):
        if frame_bgr.ndim == 2:
            return frame_bgr
        b = frame_bgr[..., 0].astype(np.uint16)
        g = frame_bgr[..., 1].astype(np.uint16)
        r = frame_bgr[..., 2].astype(np.uint16)
        return ((r * 76 + g * 150 + b * 30) >> 8).astype(np.uint8)

    @staticmethod
    def _level_for(intensity):
        for thr, level in LEVEL_THRESHOLDS:
            if intensity >= thr:
                return level
        return "NONE"