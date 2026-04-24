"""
ARGUS — core/distress_engine.py
Analyses each TrackedPerson and scores them across 5 distress signatures.
Also computes final alert level (NONE / MONITOR / REVIEW / CRITICAL).

FIXES vs. previous version
--------------------------
1. Removed the "max_flag * 0.95" boost in _compute_alert_level — a single noisy
   signal on one person used to be enough to push them to REVIEW/CRITICAL.
2. Encirclement wrap-gap math fixed (arctan2 returns -180..180, not 0..360),
   removed the *1.5 inflation, and now requires meaningful angular coverage.
3. Physical struggle now requires GROUP CONTEXT — at least one other fast-moving
   person within close proximity. A person waving alone no longer scores high.
4. Panic running no longer returns a free 0.4 for short tracks (which are
   created constantly by YOLO ID switches).
5. Collapsed now requires BOTH stillness AND a flat aspect ratio (AND, not OR).
6. Added per-track temporal smoothing — a signal must persist across multiple
   frames before it counts toward the alert level.
7. Being-followed now requires the follower to actually be BEHIND the target
   (along the target's heading), not just moving in the same general direction.
8. Small-bbox / low-history tracks are filtered out so distant noise can't
   trigger alerts.
"""

from collections import defaultdict, deque
import numpy as np
from .yolo_tracker import TrackedPerson


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

ENCIRCLEMENT_RADIUS    = 180   # pixels — how close others must be to count
ENCIRCLEMENT_MIN       = 3     # min people around target to even consider
ENCIRCLEMENT_MIN_COV   = 0.55  # need >55% angular coverage to score anything

FOLLOW_MIN_MOVEMENT    = 8     # pixels — ignore stationary people
FOLLOW_COS_THRESHOLD   = 0.88  # how similar movement directions must be
FOLLOW_MIN_DIST        = 50    # follower can't be ON TOP of target
FOLLOW_MAX_DIST        = 200   # follower can't be too far
FOLLOW_BEHIND_COS      = 0.30  # follower must be roughly behind the target

PANIC_SPEED_THRESHOLD  = 60    # pixels/sec — above this = potential panic run
PANIC_MIN_HISTORY      = 12    # frames — never score panic on brand-new tracks

COLLAPSE_SECONDS       = 2.0   # seconds still before collapse triggers
COLLAPSE_ASPECT_RATIO  = 1.4   # bbox width/height ratio for lying down

STRUGGLE_GROUP_RADIUS  = 140   # pixels — distance for "in the same scuffle"
STRUGGLE_GROUP_SPEED   = 12    # both bodies must be moving this fast
MIN_BBOX_AREA          = 1500  # pixels² — ignore tiny/distant detections

# Temporal smoothing — how many recent frames to average each flag over
SMOOTHING_FRAMES       = 8
# A signal must hit this fraction of recent frames to be "sustained"
SUSTAIN_FRACTION       = 0.5


# ─────────────────────────────────────────────
#  ALERT LEVEL WEIGHTS
# ─────────────────────────────────────────────

SIGNATURE_WEIGHTS = {
    "encirclement":      0.25,
    "being_followed":    0.15,
    "physical_struggle": 0.30,
    "panic_running":     0.15,
    "collapsed":         0.15,
}


# ─────────────────────────────────────────────
#  DISTRESS ENGINE
# ─────────────────────────────────────────────

class DistressEngine:
    """
    Detects 5 distress signatures for every tracked person.
    Call analyse_all() every frame after YOLO + MediaPipe have run.
    """

    def __init__(self):
        # Per-track rolling history of each flag for temporal smoothing.
        self._history: dict[int, dict[str, deque]] = defaultdict(
            lambda: {k: deque(maxlen=SMOOTHING_FRAMES) for k in SIGNATURE_WEIGHTS}
        )

    # -----------------------------------------
    #  ENTRY POINT
    # -----------------------------------------

    def analyse_all(self, persons: dict[int, TrackedPerson]) -> dict[int, TrackedPerson]:
        # Drop history for tracks that disappeared
        for dead in list(self._history.keys()):
            if dead not in persons:
                del self._history[dead]

        for tid, person in persons.items():
            # Filter out garbage detections (tiny bbox = distant noise / artefact).
            # bbox_area() is optional on TrackedPerson — fall back to bbox tuple.
            area = None
            if hasattr(person, "bbox_area") and callable(person.bbox_area):
                area = person.bbox_area()
            elif hasattr(person, "bbox") and person.bbox is not None:
                x1, y1, x2, y2 = person.bbox
                area = max(0, x2 - x1) * max(0, y2 - y1)
            if area is not None and area < MIN_BBOX_AREA:
                person.distress_flags = {k: 0.0 for k in SIGNATURE_WEIGHTS}
                person.confidence, person.alert_level = 0.0, "NONE"
                continue

            raw_flags = {
                "encirclement":      self._check_encirclement(person, persons),
                "being_followed":    self._check_followed(person, persons),
                "physical_struggle": self._check_struggle(person, persons),
                "panic_running":     self._check_panic_run(person),
                "collapsed":         self._check_collapsed(person),
            }

            # Temporal smoothing — average the flag across the recent window
            smoothed = {}
            for k, v in raw_flags.items():
                hist = self._history[tid][k]
                hist.append(v)
                avg = sum(hist) / len(hist)
                sustained = sum(1 for x in hist if x > 0.3) / len(hist)
                smoothed[k] = avg if sustained >= SUSTAIN_FRACTION else avg * 0.4

            person.distress_flags = {k: round(v, 2) for k, v in smoothed.items()}
            person.confidence, person.alert_level = self._compute_alert_level(smoothed)

        return persons

    # -----------------------------------------
    #  SIGNATURE 1 — Surrounding / Encirclement
    # -----------------------------------------

    def _check_encirclement(self, target, all_persons):
        cx, cy = target.center()
        nearby = []

        for pid, p in all_persons.items():
            if pid == target.track_id:
                continue
            pcx, pcy = p.center()
            dist = np.hypot(cx - pcx, cy - pcy)
            if dist < ENCIRCLEMENT_RADIUS:
                nearby.append((pcx - cx, pcy - cy))

        if len(nearby) < ENCIRCLEMENT_MIN:
            return 0.0

        # Convert arctan2 output (-180..180) into 0..360 for clean wrap math
        angles = sorted(
            (np.degrees(np.arctan2(dy, dx)) + 360.0) % 360.0
            for dx, dy in nearby
        )

        gaps = [angles[i + 1] - angles[i] for i in range(len(angles) - 1)]
        wrap_gap = (angles[0] + 360.0) - angles[-1]
        max_gap = max(gaps + [wrap_gap])

        coverage = 1.0 - (max_gap / 360.0)
        if coverage < ENCIRCLEMENT_MIN_COV:
            return 0.0

        return round(min(coverage, 1.0), 2)

    # -----------------------------------------
    #  SIGNATURE 2 — Being Followed
    # -----------------------------------------

    def _check_followed(self, target, all_persons):
        if len(target.positions) < 20:
            return 0.0

        t_vec = np.array(target.positions[-1]) - np.array(target.positions[-10])
        t_norm = np.linalg.norm(t_vec)
        if t_norm < FOLLOW_MIN_MOVEMENT:
            return 0.0
        t_dir = t_vec / t_norm

        scores = []
        cx1, cy1 = target.center()

        for pid, p in all_persons.items():
            if pid == target.track_id or len(p.positions) < 20:
                continue

            p_vec = np.array(p.positions[-1]) - np.array(p.positions[-10])
            p_norm = np.linalg.norm(p_vec)
            if p_norm < FOLLOW_MIN_MOVEMENT:
                continue

            cos_sim = float(np.dot(t_vec, p_vec) / (t_norm * p_norm))
            if cos_sim < FOLLOW_COS_THRESHOLD:
                continue

            cx2, cy2 = p.center()
            dist = np.hypot(cx1 - cx2, cy1 - cy2)
            if not (FOLLOW_MIN_DIST < dist < FOLLOW_MAX_DIST):
                continue

            # Behind-check: follower sits roughly OPPOSITE the target's heading.
            offset = np.array([cx2 - cx1, cy2 - cy1])
            offset_norm = np.linalg.norm(offset)
            if offset_norm == 0:
                continue
            behind_cos = float(np.dot(t_dir, -offset / offset_norm))
            if behind_cos < FOLLOW_BEHIND_COS:
                continue

            scores.append(cos_sim)

        return round(min(max(scores, default=0.0), 1.0), 2)

    # -----------------------------------------
    #  SIGNATURE 3 — Physical Struggle (now group-aware)
    # -----------------------------------------

    def _check_struggle(self, person, all_persons):
        kp = person.keypoints
        pose_score = 0.0

        if kp and len(kp) >= 17:
            def get(idx): return kp[idx] if idx < len(kp) else (0, 0, 0)
            left_shoulder  = get(11)
            right_shoulder = get(12)
            left_wrist     = get(15)
            right_wrist    = get(16)

            # Arms above shoulders (defensive)
            if left_wrist[2] > 0.5 and left_shoulder[2] > 0.5 and left_wrist[1] < left_shoulder[1]:
                pose_score += 0.20
            if right_wrist[2] > 0.5 and right_shoulder[2] > 0.5 and right_wrist[1] < right_shoulder[1]:
                pose_score += 0.20

            # Wrists very close — grappling/grabbing
            if left_wrist[2] > 0.5 and right_wrist[2] > 0.5:
                wrist_dist = np.hypot(
                    left_wrist[0] - right_wrist[0],
                    left_wrist[1] - right_wrist[1],
                )
                if wrist_dist < 60:
                    pose_score += 0.20

        # Self-motion
        spd = person.speed()
        motion_score = 0.0
        if spd > 20:
            motion_score = min((spd - 20) / 60.0, 0.4)

        # GROUP CONTEXT — a real fight needs another fast body right next to you
        cx, cy = person.center()
        partner_present = False
        for pid, other in all_persons.items():
            if pid == person.track_id:
                continue
            ocx, ocy = other.center()
            if np.hypot(cx - ocx, cy - ocy) < STRUGGLE_GROUP_RADIUS \
                    and other.speed() > STRUGGLE_GROUP_SPEED:
                partner_present = True
                break

        # If isolated, dampen heavily — solo gestures shouldn't be "struggle"
        group_multiplier = 1.0 if partner_present else 0.35

        score = (pose_score + motion_score) * group_multiplier
        return round(min(score, 1.0), 2)

    # -----------------------------------------
    #  SIGNATURE 4 — Panic Running
    # -----------------------------------------

    def _check_panic_run(self, person):
        spd = person.speed()
        if spd < PANIC_SPEED_THRESHOLD:
            return 0.0

        # No more freebie 0.4 for short tracks — those are usually ID switches
        if len(person.positions) < PANIC_MIN_HISTORY:
            return 0.0

        pos = list(person.positions)
        vecs = [
            np.array([pos[i][0] - pos[i - 1][0], pos[i][1] - pos[i - 1][1]])
            for i in range(1, min(10, len(pos)))
        ]

        direction_changes = 0
        for i in range(1, len(vecs)):
            n1 = np.linalg.norm(vecs[i - 1])
            n2 = np.linalg.norm(vecs[i])
            if n1 > 0 and n2 > 0:
                cos = float(np.clip(np.dot(vecs[i - 1], vecs[i]) / (n1 * n2), -1.0, 1.0))
                if cos < 0.5:
                    direction_changes += 1

        erratic_ratio = direction_changes / max(len(vecs) - 1, 1)
        speed_score = min((spd - PANIC_SPEED_THRESHOLD) / 100.0, 0.6)

        return round(min(speed_score + erratic_ratio * 0.4, 1.0), 2)

    # -----------------------------------------
    #  SIGNATURE 5 — Person Collapsed
    # -----------------------------------------

    def _check_collapsed(self, person):
        # Require BOTH conditions — sitting still alone isn't collapse,
        # nor is a wide bbox from someone bending over momentarily.
        if not person.is_still(COLLAPSE_SECONDS):
            return 0.0

        aspect = person.bbox_aspect_ratio()
        if aspect <= COLLAPSE_ASPECT_RATIO:
            return 0.0

        return round(min(aspect / 2.0, 1.0), 2)

    # -----------------------------------------
    #  ALERT LEVEL CALCULATOR
    # -----------------------------------------

    def _compute_alert_level(self, flags: dict) -> tuple[float, str]:
        """
        Combine flag scores into a single confidence value.

        Important: NO single-signal "boost" override. The previous version
        used max(weighted, max_flag * 0.95) which let one noisy signal on one
        person spike the whole alert. Now confidence is a true weighted sum.
        """
        weighted = sum(
            flags.get(k, 0.0) * w
            for k, w in SIGNATURE_WEIGHTS.items()
        )

        # Modest synergy bonus — multiple co-occurring signals are more
        # trustworthy than the same total score from a lone signal.
        active = sum(1 for v in flags.values() if v > 0.35)
        synergy = 0.05 * max(active - 1, 0)

        confidence = round(min(weighted + synergy, 1.0), 3)

        if confidence >= 0.65:
            level = "CRITICAL"
        elif confidence >= 0.45:
            level = "REVIEW"
        elif confidence >= 0.30:
            level = "MONITOR"
        else:
            level = "NONE"

        return confidence, level

    # -----------------------------------------
    #  HELPER — active flags summary
    # -----------------------------------------

    @staticmethod
    def active_flags(person: TrackedPerson, threshold: float = 0.3) -> list[str]:
        return [k for k, v in person.distress_flags.items() if v > threshold]