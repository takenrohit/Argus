"""
ARGUS — models/incident.py
Incident data model — used across the entire backend.

    alert_manager.py  → creates Incident objects
    routes.py         → receives/returns Incident data
    websocket.py      → broadcasts Incident as JSON
    Supabase          → stores Incident via to_dict()
"""

from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional
from enum import Enum


# ─────────────────────────────────────────────
#  ENUMS
# ─────────────────────────────────────────────

class ThreatLevel(str, Enum):
    CRITICAL = "CRITICAL"   # >80% confidence — immediate police dispatch
    REVIEW   = "REVIEW"     # 60–80%          — officer review required
    MONITOR  = "MONITOR"    # 50–60%          — flagged, stored for audit
    NONE     = "NONE"       # <50%            — discarded


class IncidentStatus(str, Enum):
    OPEN            = "open"
    ACKNOWLEDGED    = "acknowledged"
    RESOLVED        = "resolved"
    FALSE_POSITIVE  = "false_positive"


class DistressType(str, Enum):
    """All 5 detectable distress signatures."""
    ENCIRCLEMENT      = "encirclement"
    BEING_FOLLOWED    = "being_followed"
    PHYSICAL_STRUGGLE = "physical_struggle"
    PANIC_RUNNING     = "panic_running"
    COLLAPSED         = "collapsed"


# ─────────────────────────────────────────────
#  INCIDENT MODEL
# ─────────────────────────────────────────────

class Incident(BaseModel):
    """
    Full incident record — created by alert_manager, stored in Supabase,
    broadcast via WebSocket to the Next.js dashboard.
    """

    # ── Identity ──
    id:          str                    # e.g. "INC-1714900000-3"
    track_id:    int                    # YOLOv8 person track ID
    camera_id:   str = "CAM-01"        # source camera

    # ── Detection ──
    alert_level:    ThreatLevel         # CRITICAL | REVIEW | MONITOR | NONE
    confidence:     float               # 0.0 – 1.0 overall distress confidence
    distress_flags: dict = Field(       # { "encirclement": 0.9, "collapsed": 0.0, ... }
        default_factory=dict
    )

    # ── Location ──
    location:   str   = "Unknown"
    latitude:   float = 0.0
    longitude:  float = 0.0

    # ── Gemini Validation ──
    gemini_confirmed:    bool  = False
    gemini_description:  str   = ""
    gemini_threat_level: str   = "unknown"   # "high" | "medium" | "low" | "none"

    # ── Evidence ──
    screenshot_url: Optional[str] = None    # Supabase Storage URL or local path

    # ── Lifecycle ──
    status:     IncidentStatus = IncidentStatus.OPEN
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Optional[str] = None

    class Config:
        use_enum_values = True   # serialize enums as plain strings

    # ─────────────────────────────────────────
    #  HELPERS
    # ─────────────────────────────────────────

    def active_flags(self, threshold: float = 0.3) -> list[str]:
        """Return distress flag names that are above threshold."""
        return [k for k, v in self.distress_flags.items() if v > threshold]

    def is_critical(self) -> bool:
        return self.alert_level == ThreatLevel.CRITICAL

    def to_dict(self) -> dict:
        """
        Serialise to a flat dict for Supabase insert.
        Converts enums to strings so Supabase doesn't reject them.
        """
        return {
            "id":                   self.id,
            "track_id":             self.track_id,
            "camera_id":            self.camera_id,
            "alert_level":          str(self.alert_level),
            "confidence":           self.confidence,
            "distress_flags":       self.distress_flags,
            "location":             self.location,
            "latitude":             self.latitude,
            "longitude":            self.longitude,
            "gemini_confirmed":     self.gemini_confirmed,
            "gemini_description":   self.gemini_description,
            "screenshot_url":       self.screenshot_url,
            "status":               str(self.status),
            "created_at":           self.created_at,
        }

    def to_ws_payload(self) -> dict:
        """
        Serialise for WebSocket broadcast — includes only what
        the dashboard needs (no raw frame data).
        """
        return {
            "type":                 "alert",
            "incident_id":          self.id,
            "track_id":             self.track_id,
            "camera_id":            self.camera_id,
            "alert_level":          str(self.alert_level),
            "confidence":           self.confidence,
            "distress_flags":       self.distress_flags,
            "active_flags":         self.active_flags(),
            "location":             self.location,
            "latitude":             self.latitude,
            "longitude":            self.longitude,
            "gemini_confirmed":     self.gemini_confirmed,
            "gemini_description":   self.gemini_description,
            "gemini_threat_level":  self.gemini_threat_level,
            "screenshot_url":       self.screenshot_url,
            "status":               str(self.status),
            "created_at":           self.created_at,
        }


# ─────────────────────────────────────────────
#  RESPONSE SCHEMAS  (used by routes.py)
# ─────────────────────────────────────────────

class IncidentListResponse(BaseModel):
    incidents: list[Incident]
    total:     int
    limit:     int
    offset:    int


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus


class AlertResponse(BaseModel):
    """Returned by POST /alert."""
    status:           str
    incident_id:      str
    gemini_confirmed: bool
    gemini_threat:    str
    sms_queued:       bool