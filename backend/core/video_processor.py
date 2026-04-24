"""
ARGUS — core/video_processor.py
The main processing loop.
Ties together: YOLOTracker → MediaPipe Pose → DistressEngine → FightClusterDetector
Runs frame-by-frame and emits alerts via callbacks.
"""

import os
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[2] / ".runtime"
RUNTIME_DIR.mkdir(exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(RUNTIME_DIR / "matplotlib"))
Path(os.environ["MPLCONFIGDIR"]).mkdir(exist_ok=True)

import cv2
import numpy as np
import mediapipe as mp
import time
import asyncio
from typing import Callable, Awaitable

from .yolo_tracker import YOLOTracker, TrackedPerson
from .distress_engine import DistressEngine
from .fight_cluster_detector import FightClusterDetector, FightCluster   # NEW


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

# MediaPipe model complexity: 0=fast, 1=balanced, 2=accurate
MEDIAPIPE_COMPLEXITY  = 1
MEDIAPIPE_MIN_DETECT  = 0.5
MEDIAPIPE_MIN_TRACK   = 0.5

# Alert cooldown per person — don't fire the same alert repeatedly
ALERT_COOLDOWN_SEC    = 10
# NEW: Cooldown per spatial cell for cluster alerts
CLUSTER_COOLDOWN_SEC  = 8

# Colours for each alert level (BGR)
LEVEL_COLOURS = {
    "NONE":     (160, 160, 160),
    "MONITOR":  (0,   200,  0 ),
    "REVIEW":   (0,   200, 255),
    "CRITICAL": (0,   0,   255),
}


# ─────────────────────────────────────────────
#  VIDEO PROCESSOR
# ─────────────────────────────────────────────

class VideoProcessor:
    """
    Orchestrates the full Argus pipeline for a single camera source.

    Usage:
        processor = VideoProcessor(source=0)
        await processor.start(on_alert=my_alert_handler,
                              on_cluster=my_cluster_handler)

    on_alert callback signature:
        async def on_alert(person: TrackedPerson, frame: np.ndarray): ...

    on_cluster callback signature (NEW):
        async def on_cluster(cluster: FightCluster, frame: np.ndarray): ...
    """

    def __init__(self, source: int | str = 0, camera_id: str = "CAM-01"):
        self.source    = source
        self.camera_id = camera_id

        # Core modules
        self.tracker        = YOLOTracker()
        self.engine         = DistressEngine()
        self.fight_detector = FightClusterDetector()           # NEW

        # MediaPipe Pose
        self._mp_pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=MEDIAPIPE_COMPLEXITY,
            smooth_landmarks=True,
            min_detection_confidence=MEDIAPIPE_MIN_DETECT,
            min_tracking_confidence=MEDIAPIPE_MIN_TRACK,
        )

        # Alert throttle — track_id → last alert timestamp
        self._last_alerted: dict[int, float] = {}
        # NEW: Cluster cooldown — coarse spatial cell → last cluster alert ts
        self._last_clustered: dict[tuple[int, int], float] = {}

        # State
        self.running     = False
        self.frame_count = 0
        self.cap: cv2.VideoCapture | None = None

        # Latest annotated JPEG, served by /api/video/{camera_id}
        self._latest_jpeg: bytes | None = None
        # NEW: latest clusters, served by /api/clusters/{camera_id}
        self._latest_clusters: list[FightCluster] = []

    # ─────────────────────────────────────────
    #  START / STOP
    # ─────────────────────────────────────────

    async def start(
        self,
        on_alert:   Callable[[TrackedPerson, np.ndarray], Awaitable[None]] | None = None,
        on_cluster: Callable[[FightCluster, np.ndarray],   Awaitable[None]] | None = None,  # NEW
        show_preview: bool = False,
    ):
        """
        Start the processing loop.

        Args:
            on_alert:     async callback fired when a per-person distress event occurs
            on_cluster:   async callback fired when a fight CLUSTER is detected (NEW)
            show_preview: show OpenCV window (useful for local testing)
        """
        self.cap = cv2.VideoCapture(self.source)
        if not self.cap.isOpened():
            raise RuntimeError(f"[VideoProcessor] Cannot open source: {self.source}")

        self.running = True
        print(f"[VideoProcessor] Started; source: {self.source} | camera: {self.camera_id}")

        try:
            while self.running:
                ret, frame = self.cap.read()
                if not ret:
                    if isinstance(self.source, str):
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    print("[VideoProcessor] Stream ended or frame dropped.")
                    break

                self.frame_count += 1
                annotated = await self._process_frame(frame, on_alert, on_cluster)

                ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ok:
                    self._latest_jpeg = buf.tobytes()

                if show_preview:
                    cv2.imshow(f"Argus - {self.camera_id}", annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                await asyncio.sleep(0)

        finally:
            self.stop()

    def stop(self):
        """Release resources."""
        self.running = False
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()
        self._mp_pose.close()
        print(f"[VideoProcessor] Stopped; {self.frame_count} frames processed.")

    # ─────────────────────────────────────────
    #  CORE FRAME PIPELINE
    # ─────────────────────────────────────────

    async def _process_frame(
        self,
        frame: np.ndarray,
        on_alert:   Callable | None,
        on_cluster: Callable | None,                              # NEW
    ) -> np.ndarray:
        """
        Full pipeline for a single frame:
          1. YOLO — detect & track persons
          2. MediaPipe — extract body keypoints per person
          3. Distress Engine — score all 5 signatures
          4. Fight Cluster Detector — frame-level fight regions  (NEW)
          5. Fire per-person alerts for CRITICAL / REVIEW persons
          6. Fire per-cluster alerts for REVIEW / CRITICAL clusters (NEW)
          7. Draw annotations onto frame

        Returns annotated frame.
        """
        # ── Step 1: YOLO tracking ──
        persons = self.tracker.update(frame)

        # ── Step 2: MediaPipe keypoints ──
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        for person in persons.values():
            self._extract_keypoints(person, rgb)

        # ── Step 3: Distress analysis ──
        self.engine.analyse_all(persons)

        # ── Step 4: Fight cluster detection (NEW) ──
        clusters = self.fight_detector.detect(persons, frame=frame)
        self._latest_clusters = clusters

        # ── Step 5: Per-person alert callbacks ──
        if on_alert:
            for person in persons.values():
                if person.alert_level in ("CRITICAL", "REVIEW"):
                    if self._should_alert(person):
                        await on_alert(person, frame.copy())

        # ── Step 6: Per-cluster alert callbacks (NEW) ──
        if on_cluster:
            for cluster in clusters:
                if cluster.alert_level in ("CRITICAL", "REVIEW"):
                    if self._should_cluster_alert(cluster):
                        await on_cluster(cluster, frame.copy())

        # ── Step 7: Draw ──
        annotated = self._draw(frame, persons, clusters)
        return annotated

    # ─────────────────────────────────────────
    #  MEDIAPIPE — KEYPOINT EXTRACTION
    # ─────────────────────────────────────────

    def _extract_keypoints(self, person: TrackedPerson, rgb_frame: np.ndarray):
        x1, y1, x2, y2 = person.bbox
        pad = 20
        h, w = rgb_frame.shape[:2]

        cx1 = max(0, x1 - pad)
        cy1 = max(0, y1 - pad)
        cx2 = min(w, x2 + pad)
        cy2 = min(h, y2 + pad)

        roi = rgb_frame[cy1:cy2, cx1:cx2]
        if roi.size == 0:
            return

        result = self._mp_pose.process(roi)
        if not result.pose_landmarks:
            person.keypoints = []
            return

        roi_h = cy2 - cy1
        roi_w = cx2 - cx1

        person.keypoints = [
            (
                lm.x * roi_w + cx1,
                lm.y * roi_h + cy1,
                lm.visibility,
            )
            for lm in result.pose_landmarks.landmark
        ]

    # ─────────────────────────────────────────
    #  ALERT THROTTLES
    # ─────────────────────────────────────────

    def _should_alert(self, person: TrackedPerson) -> bool:
        now  = time.time()
        last = self._last_alerted.get(person.track_id, 0)
        if now - last >= ALERT_COOLDOWN_SEC:
            self._last_alerted[person.track_id] = now
            return True
        return False

    def _should_cluster_alert(self, cluster: FightCluster) -> bool:
        """NEW: Throttle cluster alerts by coarse spatial cell so the same
        scuffle doesn't fire 30 alerts/sec."""
        cx = (cluster.bbox[0] + cluster.bbox[2]) // 2
        cy = (cluster.bbox[1] + cluster.bbox[3]) // 2
        cell = (cx // 100, cy // 100)
        now  = time.time()
        last = self._last_clustered.get(cell, 0)
        if now - last >= CLUSTER_COOLDOWN_SEC:
            self._last_clustered[cell] = now
            return True
        return False

    # ─────────────────────────────────────────
    #  PUBLIC ACCESSORS
    # ─────────────────────────────────────────

    def latest_jpeg(self) -> bytes | None:
        return self._latest_jpeg

    def latest_clusters(self) -> list[dict]:                       # NEW
        """Latest fight clusters as plain dicts (JSON-friendly).
        Used by /api/clusters/{camera_id}."""
        return [
            {
                "bbox":          list(c.bbox),
                "person_ids":    c.person_ids,
                "body_count":    c.body_count,
                "avg_speed":     c.avg_speed,
                "motion_energy": c.motion_energy,
                "intensity":     c.intensity,
                "alert_level":   c.alert_level,
            }
            for c in self._latest_clusters
        ]

    # ─────────────────────────────────────────
    #  DRAWING / ANNOTATIONS
    # ─────────────────────────────────────────

    def _draw(
        self,
        frame: np.ndarray,
        persons: dict[int, TrackedPerson],
        clusters: list[FightCluster] | None = None,                # NEW
    ) -> np.ndarray:
        """Draw bounding boxes, labels, keypoints, cluster regions, and HUD."""
        out = frame.copy()

        # NEW: Draw fight cluster regions FIRST so per-person boxes sit on top
        if clusters:
            for cluster in clusters:
                if cluster.alert_level == "NONE":
                    continue
                colour = LEVEL_COLOURS.get(cluster.alert_level, (160, 160, 160))
                x1, y1, x2, y2 = cluster.bbox
                # Translucent fill
                overlay = out.copy()
                cv2.rectangle(overlay, (x1, y1), (x2, y2), colour, -1)
                cv2.addWeighted(overlay, 0.18, out, 0.82, 0, out)
                # Outline
                cv2.rectangle(out, (x1, y1), (x2, y2), colour, 2)
                label = (f"FIGHT {cluster.alert_level} "
                         f"x{cluster.body_count}  {cluster.intensity:.2f}")
                cv2.putText(out, label, (x1, max(14, y1 - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, colour, 2, cv2.LINE_AA)

        # Per-person boxes
        for person in persons.values():
            colour = LEVEL_COLOURS.get(person.alert_level, (160, 160, 160))
            x1, y1, x2, y2 = person.bbox
            thickness = 3 if person.alert_level == "CRITICAL" else 1

            cv2.rectangle(out, (x1, y1), (x2, y2), colour, thickness)

            active = DistressEngine.active_flags(person)
            label  = f"ID:{person.track_id} {person.alert_level} {person.confidence:.0%}"
            if active:
                label += f"  [{', '.join(active)}]"
            cv2.putText(out, label, (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, colour, 1, cv2.LINE_AA)

            for x, y, vis in person.keypoints:
                if vis > 0.5:
                    cv2.circle(out, (int(x), int(y)), 3, colour, -1)

        self._draw_hud(out, persons, clusters)
        return out

    def _draw_hud(
        self,
        frame: np.ndarray,
        persons: dict[int, TrackedPerson],
        clusters: list[FightCluster] | None = None,                # NEW
    ):
        h, w = frame.shape[:2]

        critical = sum(1 for p in persons.values() if p.alert_level == "CRITICAL")
        review   = sum(1 for p in persons.values() if p.alert_level == "REVIEW")
        # NEW: count fight cluster events
        fights   = sum(1 for c in (clusters or [])
                       if c.alert_level in ("REVIEW", "CRITICAL"))

        # Status panel (taller now to fit FIGHTS line)
        cv2.rectangle(frame, (0, 0), (340, 95), (20, 20, 20), -1)
        cv2.putText(frame, "ARGUS SURVEILLANCE",
                    (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 255, 180), 1)
        cv2.putText(frame,
                    f"Tracking: {len(persons)}   CRITICAL: {critical}   REVIEW: {review}",
                    (8, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (200, 200, 200), 1)
        cv2.putText(frame,
                    f"FIGHTS: {fights}",
                    (8, 66), cv2.FONT_HERSHEY_SIMPLEX, 0.44,
                    (0, 80, 255) if fights else (140, 140, 140), 1)
        cv2.putText(frame,
                    f"{self.camera_id}   frame #{self.frame_count}   {time.strftime('%H:%M:%S')}",
                    (8, 88), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1)

        # Critical banner (now also fires when a fight cluster goes CRITICAL)
        critical_clusters = sum(1 for c in (clusters or [])
                                if c.alert_level == "CRITICAL")
        if critical > 0 or critical_clusters > 0:
            cv2.rectangle(frame, (0, h - 44), (w, h), (0, 0, 180), -1)
            msg = (f"  CRITICAL ALERT - {critical} PERSON(S), "
                   f"{critical_clusters} FIGHT CLUSTER(S)  |  Argus")
            cv2.putText(frame, msg, (10, h - 14),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)

    # ─────────────────────────────────────────
    #  SNAPSHOT HELPER
    # ─────────────────────────────────────────

    @staticmethod
    def encode_frame_b64(frame: np.ndarray, quality: int = 70) -> str:
        import base64
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return base64.b64encode(buf).decode("utf-8")