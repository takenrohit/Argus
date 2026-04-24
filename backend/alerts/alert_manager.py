"""
ARGUS — alerts/alert_manager.py
Central alert pipeline. Called by routes.py POST /alert.

For every incoming distress event:
    1. Gemini Vision  — visually confirm the threat
    2. Evidence Saver — store screenshot
    3. Supabase       — persist the incident record
    4. SMS            — notify police if CRITICAL
    5. WebSocket      — broadcast to all dashboard clients
"""

import time
import httpx
import asyncio
from datetime import datetime, timezone
from typing import Optional

from supabase import create_client

from ..config import (
    SUPABASE_URL, SUPABASE_KEY,
    FAST2SMS_KEY, POLICE_PHONE,
    CAMERA_LOCATION,
)
from ..core.gemini_validator import GeminiValidator, GeminiResult
from ..alerts.evidence_saver import EvidenceSaver
from ..models.incident import Incident
from ..api.websocket import manager as ws_manager


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

SMS_COOLDOWN_SEC = 60    # minimum seconds between SMS for the same person


# ─────────────────────────────────────────────
#  ALERT MANAGER
# ─────────────────────────────────────────────

class AlertManager:
    """
    Orchestrates the full alert pipeline.

    Usage (from routes.py):
        result = await alert_manager.handle(
            track_id=1, alert_level="CRITICAL", confidence=0.92, ...
        )
    """

    def __init__(self):
        self.gemini   = GeminiValidator()
        self.evidence = EvidenceSaver()

        # Supabase client — None if not configured
        self._sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

        # In-memory active incidents (fast lookup, resets on restart)
        self._active: dict[str, Incident] = {}

        # SMS throttle — track_id → last sent timestamp
        self._sms_last: dict[int, float] = {}

        print("[AlertManager] Ready")

    # ─────────────────────────────────────────
    #  MAIN HANDLE METHOD
    # ─────────────────────────────────────────

    async def handle(
        self,
        track_id:       int,
        alert_level:    str,
        confidence:     float,
        distress_flags: dict,
        camera_id:      str,
        location:       str,
        latitude:       float,
        longitude:      float,
        frame_b64:      Optional[str] = None,
    ) -> dict:
        """
        Full pipeline for one distress event.
        Returns a result dict sent back to the caller (routes.py).
        """

        # ── Step 1: Gemini Vision confirmation ──
        gemini_result: GeminiResult = await self.gemini.validate(
            frame=          self._b64_to_frame(frame_b64) if frame_b64 else None,
            distress_flags= distress_flags,
            confidence=     confidence,
            alert_level=    alert_level,
        )
        print(
            f"[AlertManager] Gemini -> confirmed={gemini_result.confirmed} "
            f"| {gemini_result.threat_level} | {gemini_result.description}"
        )

        # ── Step 2: Build incident record ──
        incident_id = f"INC-{int(time.time())}-{track_id}"
        incident    = Incident(
            id=                  incident_id,
            track_id=            track_id,
            alert_level=         alert_level,
            confidence=          confidence,
            distress_flags=      distress_flags,
            camera_id=           camera_id,
            location=            location,
            latitude=            latitude,
            longitude=           longitude,
            gemini_confirmed=    gemini_result.confirmed,
            gemini_description=  gemini_result.description,
            gemini_threat_level= gemini_result.threat_level,
            status=              "open",
            created_at=          datetime.now(timezone.utc).isoformat(),
        )

        # ── Step 3: Save evidence screenshot ──
        if frame_b64:
            screenshot_url = await self.evidence.save(
                frame_b64=   frame_b64,
                incident_id= incident_id,
                camera_id=   camera_id,
            )
            incident.screenshot_url = screenshot_url

        # ── Step 4: Persist to Supabase ──
        await self._store(incident)

        # Keep in memory for fast access
        self._active[incident_id] = incident

        # ── Step 5: SMS if CRITICAL and Gemini confirmed ──
        if alert_level == "CRITICAL" and gemini_result.confirmed:
            asyncio.create_task(
                self._send_sms(incident)
            )

        # ── Step 6: Broadcast to dashboard ──
        await ws_manager.broadcast_alert({
            "incident_id":        incident_id,
            "track_id":           track_id,
            "alert_level":        alert_level,
            "confidence":         confidence,
            "distress_flags":     distress_flags,
            "camera_id":          camera_id,
            "location":           location,
            "latitude":           latitude,
            "longitude":          longitude,
            "gemini_confirmed":   gemini_result.confirmed,
            "gemini_description": gemini_result.description,
            "gemini_threat_level":gemini_result.threat_level,
            "screenshot_url":     incident.screenshot_url,
            "status":             "open",
            "timestamp":          incident.created_at,
            "frame_b64":          frame_b64,   # live frame for dashboard feed
        })

        return {
            "status":           "processed",
            "incident_id":      incident_id,
            "gemini_confirmed": gemini_result.confirmed,
            "gemini_threat":    gemini_result.threat_level,
            "sms_queued":       alert_level == "CRITICAL" and gemini_result.confirmed,
        }

    # ─────────────────────────────────────────
    #  SUPABASE STORE
    # ─────────────────────────────────────────

    async def _store(self, incident: Incident):
        """Persist incident to Supabase. Silently skips if not configured."""
        if not self._sb:
            print(f"[AlertManager] Supabase not configured; incident {incident.id} not persisted.")
            return
        try:
            self._sb.table("incidents").insert(incident.to_dict()).execute()
            print(f"[AlertManager] Stored {incident.id}")
        except Exception as e:
            print(f"[AlertManager] Supabase error: {e}")

    async def update_status(self, incident_id: str, status: str):
        """Update incident status — called by routes.py PATCH /incidents/{id}."""
        # Update in-memory
        if incident_id in self._active:
            self._active[incident_id].status = status

        # Update in Supabase
        if not self._sb:
            return
        try:
            self._sb.table("incidents").update({
                "status":     status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", incident_id).execute()
        except Exception as e:
            print(f"[AlertManager] Status update error: {e}")

    # ─────────────────────────────────────────
    #  SMS — Fast2SMS
    # ─────────────────────────────────────────

    async def _send_sms(self, incident: Incident):
        """Send SMS alert to police. Throttled per track_id."""
        now  = time.time()
        last = self._sms_last.get(incident.track_id, 0)

        if now - last < SMS_COOLDOWN_SEC:
            print(f"[AlertManager] SMS throttled for track_id {incident.track_id}")
            return

        self._sms_last[incident.track_id] = now

        if not FAST2SMS_KEY or not POLICE_PHONE:
            print(f"[AlertManager] SMS not configured; would have alerted: {incident.id}")
            return

        ts      = datetime.now().strftime("%H:%M:%S")
        message = (
            f"ARGUS ALERT [{incident.alert_level}]\n"
            f"Location: {incident.location}\n"
            f"Camera: {incident.camera_id}\n"
            f"Confidence: {incident.confidence:.0%}\n"
            f"ID: {incident.id}\n"
            f"Time: {ts}"
        )

        numbers = ",".join(p.strip() for p in POLICE_PHONE.split(",") if p.strip())

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={"authorization": FAST2SMS_KEY},
                    params={
                        "variables_values": message,
                        "route":            "q",
                        "numbers":          numbers,
                    },
                )
                data = resp.json()
                if data.get("return"):
                    print(f"[AlertManager] SMS sent to {numbers}")
                else:
                    print(f"[AlertManager] SMS failed: {data}")
        except Exception as e:
            print(f"[AlertManager] SMS error: {e}")

    # ─────────────────────────────────────────
    #  IN-MEMORY HELPERS
    # ─────────────────────────────────────────

    def get_active(self) -> list[Incident]:
        """Return all in-memory active incidents."""
        return list(self._active.values())

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        return self._active.get(incident_id)

    def clear(self):
        """Flush in-memory store — for testing."""
        self._active.clear()
        print("[AlertManager] In-memory store cleared.")

    # ─────────────────────────────────────────
    #  UTILITY
    # ─────────────────────────────────────────

    @staticmethod
    def _b64_to_frame(frame_b64: str):
        """Decode base64 JPEG string back to numpy array for Gemini."""
        import base64
        import numpy as np
        import cv2
        try:
            buf   = base64.b64decode(frame_b64)
            arr   = np.frombuffer(buf, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return frame
        except Exception:
            return None


# ─────────────────────────────────────────────
#  SINGLETON
# ─────────────────────────────────────────────

alert_manager = AlertManager()
