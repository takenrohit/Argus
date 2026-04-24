"""
ARGUS — core/fight_cluster_detector.py

Clip-level "fight cluster" detector. Operates on REGIONS of the frame, not
on individual TrackedPerson IDs, so it still fires when YOLO loses tracks
mid-scuffle (the exact failure mode in the CAM-02 sample).

THREE complementary signals are combined:

  1. Body clustering   — tight groups of bodies (>= MIN_BODIES) that are
                         mutually close, compact, and in motion.
  2. Motion energy     — raw frame-difference energy inside the cluster's
                         bounding region. Catches limbs/flailing bodies that
                         YOLO failed to box.
  3. Motion-only blob  — Pure frame-difference blobs of chaotic motion even
                         when zero bodies are tracked there. Requires >=2
                         tracked bodies to exist somewhere in the frame so
                         a single person moving fast cannot trigger it.
"""

from dataclasses import dataclass
from collections import deque
import numpy as np

from .yolo_tracker import TrackedPerson


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

CLUSTER_RADIUS        = 150
MIN_BODIES            = 2
COMPACTNESS_MAX_AREA  = 110000
BODY_MOTION_THRESHOLD = 6
MIN_MOVING_FRACTION   = 0.5

MOTION_DIFF_THRESHOLD = 16
MOTION_AREA_FRACTION  = 0.15

BLOB_GRID_CELL        = 40
BLOB_HOT_FRACTION     = 0.30
BLOB_MIN_HOT_CELLS    = 6
BLOB_MAX_HOT_CELLS    = 90

SMOOTHING_FRAMES      = 6
SUSTAIN_FRACTION      = 0.4

LEVEL_THRESHOLDS = [
    (0.62, "CRITICAL"),
    (0.42, "REVIEW"),
    (0.25, "MONITOR"),
]


# ─────────────────────────────────────────────
#  DATA CLASSES
# ─────────────────────────────────────────────

@dataclass
class FightCluster:
    bbox: tuple[int, int, int, int]
    person_ids: list[int]
    body_count: int
    avg_speed: float
    motion_energy: float
    intensity: float
    alert_level: str
    source: str = "body"


# ─────────────────────────────────────────────
#  DETECTOR
# ─────────────────────────────────────────────

class FightClusterDetector:
    def __init__(self):
        self._cell_history: dict[tuple[int, int], deque] = {}
        self._prev_gray = None
        self._prev_prev_gray = None

    # -----------------------------------------
    #  ENTRY POINT
    # -----------------------------------------

    def detect(
        self,
        persons: dict[int, TrackedPerson],
        frame=None,
    ) -> list[FightCluster]:
        groups = self._cluster_bodies(persons)
        clusters: list[FightCluster] = []

        gray = None
        diff = None
        if frame is not None:
            gray = self._to_gray(frame)
            ref = self._prev_prev_gray if self._prev_prev_gray is not None else self._prev_gray
            if ref is not None and ref.shape == gray.shape:
                diff = np.abs(gray.astype(np.int16) - ref.astype(np.int16)).astype(np.uint8)

        # Body-driven clusters
        body_bboxes: list[tuple[int, int, int, int]] = []
        for group in groups:
            cluster = self._score_group(group, persons, diff)
            if cluster is None:
                continue
            clusters.append(cluster)
            body_bboxes.append(cluster.bbox)

        # Motion-only blob clusters — REQUIRES at least 2 tracked bodies in
        # the frame. A single person moving fast (waving, exercising, walking
        # briskly) is NOT a fight. Real fights need multiple people.
        if diff is not None and len(persons) >= 2:
            for blob in self._find_motion_blobs(
                diff,
                exclude=body_bboxes,
                person_centers=[p.center() for p in persons.values()],
            ):
                clusters.append(blob)

        # Temporal smoothing per spatial cell
        smoothed_clusters: list[FightCluster] = []
        for cluster in clusters:
            cx = (cluster.bbox[0] + cluster.bbox[2]) // 2
            cy = (cluster.bbox[1] + cluster.bbox[3]) // 2
            cell = (cx // 100, cy // 100)
            hist = self._cell_history.setdefault(cell, deque(maxlen=SMOOTHING_FRAMES))
            hist.append(cluster.intensity)

            avg = sum(hist) / len(hist)
            sustained = sum(1 for x in hist if x > 0.25) / len(hist)
            smoothed = avg if sustained >= SUSTAIN_FRACTION else avg * 0.5

            cluster.intensity = round(min(smoothed, 1.0), 3)
            cluster.alert_level = self._level_for(cluster.intensity)
            smoothed_clusters.append(cluster)

        # Decay history for cells we didn't see this frame
        active_cells = {((c.bbox[0] + c.bbox[2]) // 200, (c.bbox[1] + c.bbox[3]) // 200)
                        for c in smoothed_clusters}
        for cell, hist in list(self._cell_history.items()):
            if cell not in active_cells and hist:
                hist.append(0.0)
                if all(v == 0.0 for v in hist):
                    del self._cell_history[cell]

        # Roll the gray-frame buffer
        if gray is not None:
            self._prev_prev_gray = self._prev_gray
            self._prev_gray = gray

        smoothed_clusters.sort(key=lambda c: c.intensity, reverse=True)
        return smoothed_clusters

    # -----------------------------------------
    #  STEP 1 — Cluster nearby bodies
    # -----------------------------------------

    def _cluster_bodies(self, persons: dict[int, TrackedPerson]) -> list[list[int]]:
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
    #  STEP 2 — Score a body-driven group
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
            return None

        moving = sum(1 for s in speeds if s > BODY_MOTION_THRESHOLD)
        moving_fraction = moving / len(speeds)

        motion_energy = 0.0
        if diff is not None:
            h, w = diff.shape
            cx1 = max(0, x1); cy1 = max(0, y1)
            cx2 = min(w, x2); cy2 = min(h, y2)
            if cx2 > cx1 and cy2 > cy1:
                region = diff[cy1:cy2, cx1:cx2]
                active = (region > MOTION_DIFF_THRESHOLD).sum()
                motion_energy = active / region.size

        if moving_fraction < MIN_MOVING_FRACTION and motion_energy < 0.20:
            return None

        avg_speed = float(np.mean(speeds))
        body_count = len(group)

        density = body_count / (area / 10000.0)
        density_score = min(density / 3.0, 1.0)

        motion_score = min(max((avg_speed - BODY_MOTION_THRESHOLD) / 35.0, 0.0), 1.0)

        intensity = (
            0.30 * density_score
            + 0.20 * motion_score
            + 0.50 * min(motion_energy / 0.45, 1.0)
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
            source="body",
        )

    # -----------------------------------------
    #  STEP 3 — Motion-only blob detection
    # -----------------------------------------

    def _find_motion_blobs(
        self,
        diff: np.ndarray,
        exclude: list[tuple[int, int, int, int]],
        person_centers: list[tuple[float, float]] | None = None,
    ) -> list[FightCluster]:
        h, w = diff.shape
        cell = BLOB_GRID_CELL
        gh, gw = h // cell, w // cell
        if gh < 2 or gw < 2:
            return []

        hot = np.zeros((gh, gw), dtype=np.uint8)
        for gy in range(gh):
            for gx in range(gw):
                y0, x0 = gy * cell, gx * cell
                region = diff[y0:y0 + cell, x0:x0 + cell]
                active = (region > MOTION_DIFF_THRESHOLD).sum()
                if active / region.size >= BLOB_HOT_FRACTION:
                    hot[gy, gx] = 1

        if hot.sum() == 0:
            return []

        labels = np.zeros_like(hot, dtype=np.int32)
        next_label = 0
        for sy in range(gh):
            for sx in range(gw):
                if hot[sy, sx] == 0 or labels[sy, sx] != 0:
                    continue
                next_label += 1
                stack = [(sy, sx)]
                while stack:
                    y, x = stack.pop()
                    if y < 0 or y >= gh or x < 0 or x >= gw:
                        continue
                    if hot[y, x] == 0 or labels[y, x] != 0:
                        continue
                    labels[y, x] = next_label
                    stack.extend([(y+1, x), (y-1, x), (y, x+1), (y, x-1)])

        blobs: list[FightCluster] = []
        for lbl in range(1, next_label + 1):
            ys, xs = np.where(labels == lbl)
            count = len(xs)
            if count < BLOB_MIN_HOT_CELLS or count > BLOB_MAX_HOT_CELLS:
                continue

            x1 = int(xs.min() * cell)
            y1 = int(ys.min() * cell)
            x2 = int((xs.max() + 1) * cell)
            y2 = int((ys.max() + 1) * cell)
            bbox = (x1, y1, x2, y2)

            # Skip blobs already covered by a body-driven cluster
            if any(self._iou(bbox, b) > 0.4 for b in exclude):
                continue

            # Require >= 2 person centers near/inside this blob.
            # A single person moving fast must NOT trigger a fight.
            if person_centers is not None:
                pad = 60
                near = sum(
                    1 for (cx, cy) in person_centers
                    if (x1 - pad) <= cx <= (x2 + pad)
                    and (y1 - pad) <= cy <= (y2 + pad)
                )
                if near < 2:
                    continue

            region = diff[y1:y2, x1:x2]
            active_frac = (region > MOTION_DIFF_THRESHOLD).sum() / max(region.size, 1)

            area_score = min(count / 30.0, 1.0)
            density_score = min(active_frac / 0.5, 1.0)
            intensity = round(min(0.45 * area_score + 0.55 * density_score, 1.0), 3)
            intensity = round(intensity * 0.85, 3)

            blobs.append(FightCluster(
                bbox=bbox,
                person_ids=[],
                body_count=0,
                avg_speed=0.0,
                motion_energy=round(active_frac, 3),
                intensity=intensity,
                alert_level="NONE",
                source="motion-only",
            ))

        return blobs

    # -----------------------------------------
    #  Helpers
    # -----------------------------------------

    @staticmethod
    def _iou(a, b) -> float:
        ax1, ay1, ax2, ay2 = a
        bx1, by1, bx2, by2 = b
        ix1, iy1 = max(ax1, bx1), max(ay1, by1)
        ix2, iy2 = min(ax2, bx2), min(ay2, by2)
        iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
        inter = iw * ih
        if inter == 0:
            return 0.0
        area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
        area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
        return inter / (area_a + area_b - inter)

    @staticmethod
    def _to_gray(frame_bgr: np.ndarray) -> np.ndarray:
        if frame_bgr.ndim == 2:
            return frame_bgr
        b = frame_bgr[..., 0].astype(np.uint16)
        g = frame_bgr[..., 1].astype(np.uint16)
        r = frame_bgr[..., 2].astype(np.uint16)
        return ((r * 76 + g * 150 + b * 30) >> 8).astype(np.uint8)

    @staticmethod
    def _level_for(intensity: float) -> str:
        for thr, level in LEVEL_THRESHOLDS:
            if intensity >= thr:
                return level
        return "NONE"