"""
ARGUS — core/distress_engine.py
Analyses each TrackedPerson and scores them across 5 distress signatures.
Also computes final alert level (NONE / MONITOR / REVIEW / CRITICAL).
"""

import numpy as np
from dataclasses import dataclass
from .yolo_tracker import TrackedPerson


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

ENCIRCLEMENT_RADIUS   = 150   # pixels — how close others must be to count
ENCIRCLEMENT_MIN      = 3     # min people around target to trigger
FOLLOW_MIN_MOVEMENT   = 12    # pixels — ignore stationary people for follow check
FOLLOW_COS_THRESHOLD  = 0.90  # how similar movement directions must be
FOLLOW_MIN_DIST       = 40    # follower can't be ON TOP of target
FOLLOW_MAX_DIST       = 200   # follower can't be too far
PANIC_SPEED_THRESHOLD = 55    # pixels/sec — above this = potential panic run
COLLAPSE_SECONDS      = 8     # seconds still before collapse triggers
COLLAPSE_ASPECT_RATIO = 2.0   # bbox width/height ratio for truly lying down


# ─────────────────────────────────────────────
#  ALERT LEVEL WEIGHTS
# ─────────────────────────────────────────────

# How much each signature contributes to overall confidence score
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

    Signatures:
        1. Surrounding / Encirclement
        2. Being Followed
        3. Physical Struggle
        4. Panic Running
        5. Person Collapsed
    """

    def analyse_all(self, persons: dict[int, TrackedPerson]) -> dict[int, TrackedPerson]:
        """
        Run all 5 checks for every person.
        Updates each TrackedPerson's distress_flags, confidence, alert_level in place.

        Args:
            persons: dict of { track_id: TrackedPerson } from YOLOTracker

        Returns:
            Same dict, updated with distress results.
        """
        for tid, person in persons.items():
            flags = {
                "encirclement":      self._check_encirclement(person, persons),
                "being_followed":    self._check_followed(person, persons),
                "physical_struggle": self._check_struggle(person, persons),
                "panic_running":     self._check_panic_run(person),
                "collapsed":         self._check_collapsed(person),
            }
            person.distress_flags = flags
            person.confidence, person.alert_level = self._compute_alert_level(flags)

        return persons

    # ─────────────────────────────────────────
    #  SIGNATURE 1 — Surrounding / Encirclement
    # ─────────────────────────────────────────

    def _check_encirclement(
        self,
        target: TrackedPerson,
        all_persons: dict[int, TrackedPerson]
    ) -> float:
        """
        Checks if multiple people are surrounding the target from multiple directions.
        Uses angular spread — true encirclement = no large gap in angles.
        """
        cx, cy  = target.center()
        nearby  = []

        for pid, p in all_persons.items():
            if pid == target.track_id:
                continue
            pcx, pcy = p.center()
            dist = np.sqrt((cx - pcx)**2 + (cy - pcy)**2)
            if dist < ENCIRCLEMENT_RADIUS:
                nearby.append((pcx - cx, pcy - cy))

        if len(nearby) < ENCIRCLEMENT_MIN:
            return 0.0

        # Calculate angles of nearby persons relative to target
        angles = sorted([
            np.degrees(np.arctan2(dy, dx))
            for dx, dy in nearby
        ])

        # Find the largest angular gap between consecutive people
        gaps = [angles[i+1] - angles[i] for i in range(len(angles) - 1)]
        wrap_gap = (360 - angles[-1] + angles[0])
        max_gap  = max(gaps + [wrap_gap])

        # Coverage = how much of the 360° circle is "filled"
        coverage = 1.0 - (max_gap / 360.0)
        return round(min(coverage * 1.5, 1.0), 2)

    # ─────────────────────────────────────────
    #  SIGNATURE 2 — Being Followed
    # ─────────────────────────────────────────

    def _check_followed(
        self,
        target: TrackedPerson,
        all_persons: dict[int, TrackedPerson]
    ) -> float:
        """
        Checks if any other person is consistently moving in the same
        direction as the target while staying nearby.
        Uses cosine similarity between movement vectors.
        """
        if len(target.positions) < 20:
            return 0.0

        scores = []

        for pid, p in all_persons.items():
            if pid == target.track_id or len(p.positions) < 20:
                continue

            # Movement vectors over last 10 frames
            t_vec = np.array(target.positions[-1]) - np.array(target.positions[-10])
            p_vec = np.array(p.positions[-1])       - np.array(p.positions[-10])

            t_norm = np.linalg.norm(t_vec)
            p_norm = np.linalg.norm(p_vec)

            # Skip if either person is barely moving
            if t_norm < FOLLOW_MIN_MOVEMENT or p_norm < FOLLOW_MIN_MOVEMENT:
                continue

            cos_sim = np.dot(t_vec, p_vec) / (t_norm * p_norm)

            # Check proximity — follower stays close but not overlapping
            cx1, cy1 = target.center()
            cx2, cy2 = p.center()
            dist = np.sqrt((cx1 - cx2)**2 + (cy1 - cy2)**2)

            if cos_sim > FOLLOW_COS_THRESHOLD and FOLLOW_MIN_DIST < dist < FOLLOW_MAX_DIST:
                scores.append(cos_sim)

        return round(min(max(scores, default=0.0), 1.0), 2)

    # ─────────────────────────────────────────
    #  SIGNATURE 3 — Physical Struggle
    # ─────────────────────────────────────────

    def _check_struggle(
        self,
        person: TrackedPerson,
        all_persons: dict[int, TrackedPerson] | None = None,
    ) -> float:
        """
        Detects physical struggle via:
        - Wrists raised above shoulders (defensive / punching)
        - Wrists close together (grappling)
        - Rapid movement
        - Multiple people in very close proximity with movement (fight)
        """
        kp = person.keypoints
        if not kp or len(kp) < 17:
            # No pose data — fall back to proximity-only fight detection
            return self._check_proximity_fight(person, all_persons)

        def get(idx):
            """Safe keypoint getter — returns (x, y, visibility)."""
            return kp[idx] if idx < len(kp) else (0, 0, 0)

        # MediaPipe Pose landmark indices
        left_shoulder  = get(11)
        right_shoulder = get(12)
        left_elbow     = get(13)
        right_elbow    = get(14)
        left_wrist     = get(15)
        right_wrist    = get(16)

        score = 0.0

        # Check: left wrist raised above left shoulder (defensive/punch posture)
        if left_wrist[2] > 0.5 and left_shoulder[2] > 0.5:
            if left_wrist[1] < left_shoulder[1] - 15:
                score += 0.25

        # Check: right wrist raised above right shoulder
        if right_wrist[2] > 0.5 and right_shoulder[2] > 0.5:
            if right_wrist[1] < right_shoulder[1] - 15:
                score += 0.25

        # Check: wrists close together = grappling / grabbing
        if left_wrist[2] > 0.5 and right_wrist[2] > 0.5:
            wrist_dist = np.sqrt(
                (left_wrist[0] - right_wrist[0])**2 +
                (left_wrist[1] - right_wrist[1])**2
            )
            if wrist_dist < 65:
                score += 0.3

        # Check: rapid movement indicates a physical altercation (Lowered from 18 to 12)
        spd = person.speed()
        if spd > 12:
            score += min(0.4, (spd - 12) / 30.0 + 0.20)

        # Check: proximity fight — other people very close AND moving
        proximity_score = self._check_proximity_fight(person, all_persons)
        score = max(score, score * 0.6 + proximity_score * 0.4)

        return round(min(score, 1.0), 2)

    def _check_proximity_fight(
        self,
        target: TrackedPerson,
        all_persons: dict[int, TrackedPerson] | None = None,
    ) -> float:
        """
        Detect fights by checking if multiple people are very close together
        and at least one is moving. Works even without pose keypoints.
        """
        if not all_persons or len(all_persons) < 2:
            return 0.0

        cx, cy = target.center()
        close_and_moving = 0
        close_count = 0

        for pid, p in all_persons.items():
            if pid == target.track_id:
                continue
            ox, oy = p.center()
            dist = np.sqrt((cx - ox)**2 + (cy - oy)**2)
            if dist < 180:  # increased from 120 to cover more frame area
                close_count += 1
                if p.speed() > 8 or target.speed() > 8:
                    close_and_moving += 1

        if close_and_moving >= 1:
            return min(0.85, 0.5 + close_and_moving * 0.2)
        elif close_count >= 2:
            return 0.4  # crowded but not necessarily fighting
        return 0.0

    # ─────────────────────────────────────────
    #  SIGNATURE 4 — Panic Running
    # ─────────────────────────────────────────

    def _check_panic_run(self, person: TrackedPerson) -> float:
        """
        Detects panic running via:
        - Speed above threshold
        - Erratic direction changes (not steady straight-line running)
        """
        spd = person.speed()
        if spd < PANIC_SPEED_THRESHOLD:
            return 0.0

        if len(person.positions) < 10:
            return 0.4   # fast but not enough history — partial score

        # Build movement vectors between consecutive positions
        pos  = list(person.positions)
        vecs = [
            np.array([pos[i][0] - pos[i-1][0], pos[i][1] - pos[i-1][1]])
            for i in range(1, min(10, len(pos)))
        ]

        # Count sharp direction changes (>60°)
        direction_changes = 0
        for i in range(1, len(vecs)):
            n1 = np.linalg.norm(vecs[i-1])
            n2 = np.linalg.norm(vecs[i])
            if n1 > 0 and n2 > 0:
                cos = np.dot(vecs[i-1], vecs[i]) / (n1 * n2)
                cos = np.clip(cos, -1.0, 1.0)
                if cos < 0.5:   # angle > 60°
                    direction_changes += 1

        erratic_ratio = direction_changes / max(len(vecs) - 1, 1)
        speed_score   = min((spd - PANIC_SPEED_THRESHOLD) / 100.0, 0.6)

        return round(min(speed_score + erratic_ratio * 0.4, 1.0), 2)

    # ─────────────────────────────────────────
    #  SIGNATURE 5 — Person Collapsed
    # ─────────────────────────────────────────

    def _check_collapsed(self, person: TrackedPerson) -> float:
        """
        Detects collapse via two signals:
        - Bounding box is wider than it is tall (lying flat on ground)
        - Person has been completely still for several seconds
        """
        still_score = 1.0 if person.is_still(COLLAPSE_SECONDS) else 0.0

        aspect      = person.bbox_aspect_ratio()
        pose_score  = min((aspect - COLLAPSE_ASPECT_RATIO) / 1.5, 1.0) if aspect > COLLAPSE_ASPECT_RATIO else 0.0

        # Both conditions must be true — must be still AND lying flat
        if still_score < 0.5 or pose_score < 0.3:
            return 0.0

        combined = still_score * 0.4 + pose_score * 0.6
        return round(combined, 2)

    # ─────────────────────────────────────────
    #  ALERT LEVEL CALCULATOR
    # ─────────────────────────────────────────

    def _compute_alert_level(self, flags: dict) -> tuple[float, str]:
        """
        Combines all flag scores into a single confidence value and alert level.

        Boost rule: if any single flag is very high, escalate overall confidence
        so a single severe signal isn't diluted by the other zeros.
        """
        weighted = sum(
            flags.get(k, 0.0) * w
            for k, w in SIGNATURE_WEIGHTS.items()
        )

        # Boost: strong single signals should still escalate
        max_flag   = max(flags.values(), default=0.0)
        active_count = sum(1 for v in flags.values() if v > 0.3)
        boost_mult = 0.90 if active_count >= 2 else 0.80
        confidence = max(weighted, max_flag * boost_mult)
        confidence = round(min(confidence, 1.0), 3)

        if confidence >= 0.55: # lowered from 0.60
            level = "CRITICAL"
        elif confidence >= 0.50:
            level = "REVIEW"
        elif confidence >= 0.30:
            level = "MONITOR"
        else:
            level = "NONE"

        return confidence, level

    # ─────────────────────────────────────────
    #  HELPER — active flags summary
    # ─────────────────────────────────────────

    @staticmethod
    def active_flags(person: TrackedPerson, threshold: float = 0.3) -> list[str]:
        """Returns list of flag names that are above threshold."""
        return [k for k, v in person.distress_flags.items() if v > threshold]