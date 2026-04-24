
"""
ARGUS — core/yolo_tracker.py
Handles all YOLOv8 person detection and tracking.
Gives every person a persistent track_id across frames.
"""

import os
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[2] / ".runtime"
RUNTIME_DIR.mkdir(exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(RUNTIME_DIR / "matplotlib"))
os.environ.setdefault("YOLO_CONFIG_DIR", str(RUNTIME_DIR / "ultralytics"))
Path(os.environ["MPLCONFIGDIR"]).mkdir(exist_ok=True)
Path(os.environ["YOLO_CONFIG_DIR"]).mkdir(exist_ok=True)

import cv2
import numpy as np
from ultralytics import YOLO
from dataclasses import dataclass, field
from collections import deque
import time


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

MODEL_PATH        = "yolov8n.pt"   # downloads automatically on first run (~6MB)
CONFIDENCE        = 0.3            # minimum detection confidence (lower for dark CCTV)
MAX_TRACK_HISTORY = 60             # how many past positions to remember per person


# ─────────────────────────────────────────────
#  TRACKED PERSON
# ─────────────────────────────────────────────

@dataclass
class TrackedPerson:
    """
    Represents a single person being tracked across frames.
    Holds position history, bounding box, keypoints, and alert state.
    """
    track_id:   int
    bbox:       tuple = (0, 0, 0, 0)       # (x1, y1, x2, y2)
    keypoints:  list  = field(default_factory=list)  # from MediaPipe (set externally)

    # Rolling history — last N frames
    positions:  deque = field(default_factory=lambda: deque(maxlen=MAX_TRACK_HISTORY))
    timestamps: deque = field(default_factory=lambda: deque(maxlen=MAX_TRACK_HISTORY))

    # Set by distress engine
    distress_flags: dict  = field(default_factory=dict)
    confidence:     float = 0.0
    alert_level:    str   = "NONE"   # NONE | MONITOR | REVIEW | CRITICAL

    # ── Derived helpers ──

    def center(self) -> tuple[int, int]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) // 2, (y1 + y2) // 2)

    def speed(self) -> float:
        """
        Pixels per second based on recent position history.
        Returns 0 if not enough data.
        """
        if len(self.positions) < 5:
            return 0.0
        dx = self.positions[-1][0] - self.positions[-5][0]
        dy = self.positions[-1][1] - self.positions[-5][1]
        dt = self.timestamps[-1] - self.timestamps[-5]
        if dt <= 0:
            return 0.0
        return float(np.sqrt(dx**2 + dy**2) / dt)

    def is_still(self, seconds: float = 2.0) -> bool:
        """
        Returns True if person hasn't moved significantly for `seconds`.
        Used for collapsed detection.
        """
        if len(self.positions) < 10:
            return False
        now    = self.timestamps[-1]
        cutoff = now - seconds
        recent = [
            p for p, t in zip(self.positions, self.timestamps)
            if t >= cutoff
        ]
        if len(recent) < 5:
            return False
        xs = [p[0] for p in recent]
        ys = [p[1] for p in recent]
        return (max(xs) - min(xs)) < 20 and (max(ys) - min(ys)) < 20

    def bbox_aspect_ratio(self) -> float:
        """Width / Height of bounding box. > 1.2 suggests lying down."""
        x1, y1, x2, y2 = self.bbox
        h = y2 - y1
        w = x2 - x1
        return (w / h) if h > 0 else 0.0


# ─────────────────────────────────────────────
#  YOLO TRACKER
# ─────────────────────────────────────────────

class YOLOTracker:
    """
    Wraps YOLOv8 to detect and persistently track people across frames.

    Usage:
        tracker = YOLOTracker()
        persons = tracker.update(frame)   # call every frame
    """

    def __init__(self, model_path: str = MODEL_PATH, confidence: float = CONFIDENCE):
        print(f"[YOLOTracker] Loading model: {model_path}")
        self.model      = YOLO(model_path)
        self.confidence = confidence
        self.persons:   dict[int, TrackedPerson] = {}
        print("[YOLOTracker] Ready")

    def update(self, frame: np.ndarray) -> dict[int, TrackedPerson]:
        """
        Run detection + tracking on a single frame.

        Args:
            frame: BGR numpy array (from OpenCV)

        Returns:
            dict of { track_id: TrackedPerson } — only currently visible persons
        """
        now = time.time()

        results = self.model.track(
            frame,
            persist=True,           # keeps IDs consistent across frames
            classes=[0],            # class 0 = person only
            conf=self.confidence,
            verbose=False,
        )

        active_ids: set[int] = set()

        if results and results[0].boxes is not None:
            boxes = results[0].boxes

            for box in boxes:
                # Skip if YOLO hasn't assigned a track ID yet
                if box.id is None:
                    continue

                tid        = int(box.id.item())
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                active_ids.add(tid)

                # Create new entry if first time seeing this person
                if tid not in self.persons:
                    self.persons[tid] = TrackedPerson(track_id=tid)

                p        = self.persons[tid]
                p.bbox   = (x1, y1, x2, y2)

                cx, cy   = (x1 + x2) // 2, (y1 + y2) // 2
                p.positions.append((cx, cy))
                p.timestamps.append(now)

        # Remove persons no longer in frame
        lost_ids = set(self.persons.keys()) - active_ids
        for tid in lost_ids:
            del self.persons[tid]

        return self.persons

    def get_person(self, track_id: int) -> TrackedPerson | None:
        return self.persons.get(track_id)

    def count(self) -> int:
        return len(self.persons)

    def reset(self):
        """Clear all tracks — call when switching camera source."""
        self.persons.clear()
        print("[YOLOTracker] Tracks reset.")


# ─────────────────────────────────────────────
#  QUICK TEST  (python yolo_tracker.py)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    source = sys.argv[1] if len(sys.argv) > 1 else 0
    print(f"[TEST] Opening source: {source}")

    tracker = YOLOTracker()
    cap     = cv2.VideoCapture(source)

    if not cap.isOpened():
        print("[ERROR] Cannot open video source.")
        exit(1)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        persons = tracker.update(frame)

        # Draw bounding boxes
        for p in persons.values():
            x1, y1, x2, y2 = p.bbox
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 0), 2)
            cv2.putText(
                frame,
                f"ID:{p.track_id}  spd:{p.speed():.0f}px/s",
                (x1, y1 - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 0), 1,
            )

        cv2.putText(frame, f"Tracking: {tracker.count()} people",
                    (8, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        cv2.imshow("YOLOTracker Test", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
