"""
ARGUS — core/video_processor.py
The main processing loop.
Ties together: YOLOTracker → MediaPipe Pose → DistressEngine
Runs frame-by-frame and emits alerts via a callback.
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


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

# MediaPipe model complexity: 0=fast, 1=balanced, 2=accurate
MEDIAPIPE_COMPLEXITY  = 1
MEDIAPIPE_MIN_DETECT  = 0.5
MEDIAPIPE_MIN_TRACK   = 0.5

# Alert cooldown per person — don't fire the same alert repeatedly
ALERT_COOLDOWN_SEC    = 10

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
        await processor.start(on_alert=my_alert_handler)

    on_alert callback signature:
        async def on_alert(person: TrackedPerson, frame: np.ndarray): ...
    """

    def __init__(self, source: int | str = 0, camera_id: str = "CAM-01"):
        self.source    = source
        self.camera_id = camera_id

        # Core modules
        self.tracker = YOLOTracker()
        self.engine  = DistressEngine()

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

        # State
        self.running     = False
        self.frame_count = 0
        self.cap: cv2.VideoCapture | None = None

        # NEW: latest annotated JPEG, served by /api/video/{camera_id}
        self._latest_jpeg: bytes | None = None

    # ─────────────────────────────────────────
    #  START / STOP
    # ─────────────────────────────────────────

    async def start(
        self,
        on_alert: Callable[[TrackedPerson, np.ndarray], Awaitable[None]] | None = None,
        show_preview: bool = False,
    ):
        """
        Start the processing loop.

        Args:
            on_alert:     async callback fired when a distress event occurs
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
                    # If source is a file, loop it seamlessly for demo
                    if isinstance(self.source, str):
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                    print("[VideoProcessor] Stream ended or frame dropped.")
                    break

                self.frame_count += 1
                annotated = await self._process_frame(frame, on_alert)

                # NEW: cache JPEG so the MJPEG endpoint can serve it
                ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ok:
                    self._latest_jpeg = buf.tobytes()

                if show_preview:
                    cv2.imshow(f"Argus - {self.camera_id}", annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                # Yield control so FastAPI event loop stays responsive
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
        on_alert: Callable | None,
    ) -> np.ndarray:
        """
        Full pipeline for a single frame:
          1. YOLO — detect & track persons
          2. MediaPipe — extract body keypoints per person
          3. Distress Engine — score all 5 signatures
          4. Fire alerts for CRITICAL / REVIEW persons
          5. Draw annotations onto frame

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

        # ── Step 4: Alert callbacks ──
        if on_alert:
            for person in persons.values():
                if person.alert_level in ("CRITICAL", "REVIEW"):
                    if self._should_alert(person):
                        await on_alert(person, frame.copy())

        # ── Step 5: Draw ──
        annotated = self._draw(frame, persons)
        return annotated

    # ─────────────────────────────────────────
    #  MEDIAPIPE — KEYPOINT EXTRACTION
    # ─────────────────────────────────────────

    def _extract_keypoints(self, person: TrackedPerson, rgb_frame: np.ndarray):
        """
        Crops the person ROI, runs MediaPipe Pose, and stores
        keypoints back onto the TrackedPerson in full-frame coordinates.
        """
        x1, y1, x2, y2 = person.bbox
        pad = 20
        h, w = rgb_frame.shape[:2]

        # Crop with padding, clamped to frame bounds
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

        # Convert normalised ROI coords → absolute full-frame coords
        person.keypoints = [
            (
                lm.x * roi_w + cx1,
                lm.y * roi_h + cy1,
                lm.visibility,
            )
            for lm in result.pose_landmarks.landmark
        ]

    # ─────────────────────────────────────────
    #  ALERT THROTTLE
    # ─────────────────────────────────────────

    def _should_alert(self, person: TrackedPerson) -> bool:
        """
        Returns True only if enough time has passed since last alert
        for this person — prevents spamming the backend.
        """
        now  = time.time()
        last = self._last_alerted.get(person.track_id, 0)
        if now - last >= ALERT_COOLDOWN_SEC:
            self._last_alerted[person.track_id] = now
            return True
        return False

    # ─────────────────────────────────────────
    #  LATEST JPEG — MJPEG ENDPOINT
    # ─────────────────────────────────────────

    def latest_jpeg(self) -> bytes | None:
        """Most recent annotated frame, JPEG-encoded. Used by /api/video/{id}."""
        return self._latest_jpeg

    # ─────────────────────────────────────────
    #  DRAWING / ANNOTATIONS
    # ─────────────────────────────────────────

    def _draw(self, frame: np.ndarray, persons: dict[int, TrackedPerson]) -> np.ndarray:
        """Draw bounding boxes, labels, keypoints, and HUD onto the frame."""
        out = frame.copy()

        for person in persons.values():
            colour = LEVEL_COLOURS.get(person.alert_level, (160, 160, 160))
            x1, y1, x2, y2 = person.bbox
            thickness = 3 if person.alert_level == "CRITICAL" else 1

            # Bounding box
            cv2.rectangle(out, (x1, y1), (x2, y2), colour, thickness)

            # Label
            active = DistressEngine.active_flags(person)
            label  = f"ID:{person.track_id} {person.alert_level} {person.confidence:.0%}"
            if active:
                label += f"  [{', '.join(active)}]"
            cv2.putText(out, label, (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, colour, 1, cv2.LINE_AA)

            # Draw visible keypoints
            for x, y, vis in person.keypoints:
                if vis > 0.5:
                    cv2.circle(out, (int(x), int(y)), 3, colour, -1)

        # HUD overlay
        self._draw_hud(out, persons)
        return out

    def _draw_hud(self, frame: np.ndarray, persons: dict[int, TrackedPerson]):
        """Top-left status panel + bottom red banner for CRITICAL alerts."""
        h, w = frame.shape[:2]

        critical = sum(1 for p in persons.values() if p.alert_level == "CRITICAL")
        review   = sum(1 for p in persons.values() if p.alert_level == "REVIEW")

        # Status panel
        cv2.rectangle(frame, (0, 0), (340, 75), (20, 20, 20), -1)
        cv2.putText(frame, "ARGUS SURVEILLANCE",
                    (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 255, 180), 1)
        cv2.putText(frame,
                    f"Tracking: {len(persons)}   CRITICAL: {critical}   REVIEW: {review}",
                    (8, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (200, 200, 200), 1)
        cv2.putText(frame,
                    f"{self.camera_id}   frame #{self.frame_count}   {time.strftime('%H:%M:%S')}",
                    (8, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1)

        # Critical alert banner
        if critical > 0:
            cv2.rectangle(frame, (0, h - 44), (w, h), (0, 0, 180), -1)
            cv2.putText(frame,
                        f"  CRITICAL ALERT - {critical} INCIDENT(S) DETECTED  |  Argus",
                        (10, h - 14),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 2, cv2.LINE_AA)

    # ─────────────────────────────────────────
    #  SNAPSHOT HELPER
    # ─────────────────────────────────────────

    @staticmethod
    def encode_frame_b64(frame: np.ndarray, quality: int = 70) -> str:
        """
        Encode a frame as a base64 JPEG string.
        Used by alert_manager to attach evidence screenshots.
        """
        import base64
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return base64.b64encode(buf).decode("utf-8")