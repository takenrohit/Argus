"""ARGUS — alerts/alert_manager.py
Central alert pipeline.

For every incoming distress event:
    1. Confidence threshold gate
    2. Gemini Vision visual confirmation
    3. Evidence saver (screenshot)
    4. Supabase persistence (non-blocking via to_thread)
    5. SMS to police if CRITICAL + Gemini-confirmed
    6. WebSocket broadcast to dashboard clients
"""

import time
import asyncio
import base64
from datetime import datetime, timezone
from typing import Optional

import httpx
import numpy as np
import cv2

from ..config import (
    FAST2SMS_KEY, POLICE_PHONE,
    ALERT_CONFIDENCE_THRESHOLD,
    is_supabase_configured, is_sms_configured,
)
from ..db import get_supabase
from ..core.gemini_validator import GeminiValidator, GeminiResult
from ..alerts.evidence_saver import EvidenceSaver
from ..models.incident import Incident
from ..api.websocket import manager as ws_manager


SMS_COOLDOWN_SEC = 60     # min seconds between SMS to the same person


class AlertManager:
    """Orchestrates the full alert pipeline."""

    def __init__(self):
        self.gemini   = GeminiValidator()
        self.evidence = EvidenceSaver()
        self._sb      = get_supabase()

        self._active: dict[str, Incident] = {}
        # Throttle SMS by (camera_id, location) so re-tracked persons can't spam
        self._sms_last: dict[tuple[str, str], float] = {}

        print("[AlertManager] Ready")

    # ─────────────────────────────────────────
    #  PUBLIC API
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
        frame:          Optional[np.ndarray] = None,
        frame_b64:      Optional[str] = None,
    ) -> dict:
        """Run the full pipeline for one distress event.

        Pass `frame` (numpy BGR) when available — saves a base64 round-trip.
        Falls back to decoding `frame_b64` if only that is provided.
        """
        # ── Threshold gate (was previously only enforced in /api/alert) ──
        if confidence < ALERT_CONFIDENCE_THRESHOLD:
            return {"status": "ignored", "reason": "below threshold"}

        # Get a numpy frame for Gemini once — and only once
        np_frame = frame if frame is not None else (
            self._b64_to_frame(frame_b64) if frame_b64 else None
        )

        # ── Step 1: Gemini Vision confirmation ──
        gemini_result: GeminiResult = await self.gemini.validate(
            frame=          np_frame,
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

        # ── Step 3: Save evidence screenshot (encode once) ──
        broadcast_b64 = frame_b64
        if np_frame is not None:
            jpeg_bytes = await asyncio.to_thread(self._encode_jpeg, np_frame)
            if not broadcast_b64:
                broadcast_b64 = base64.b64encode(jpeg_bytes).decode("ascii")
            screenshot_url = await self.evidence.save_bytes(
                jpeg_bytes=  jpeg_bytes,
                incident_id= incident_id,
                camera_id=   camera_id,
            )
            incident.screenshot_url = screenshot_url

        # ── Step 4: Persist to Supabase (off the event loop) ──
        await self._store(incident)

        # In-memory store for fast lookup
        self._active[incident_id] = incident

        # ── Step 5: SMS if CRITICAL + Gemini-confirmed ──
        if alert_level == "CRITICAL" and gemini_result.confirmed:
            asyncio.create_task(self._send_sms(incident))

        # ── Step 6: Broadcast to dashboard ──
        await ws_manager.broadcast_alert({
            "incident_id":         incident_id,
            "track_id":            track_id,
            "alert_level":         alert_level,
            "confidence":          confidence,
            "distress_flags":      distress_flags,
            "camera_id":           camera_id,
            "location":            location,
            "latitude":            latitude,
            "longitude":           longitude,
            "gemini_confirmed":    gemini_result.confirmed,
            "gemini_description":  gemini_result.description,
            "gemini_threat_level": gemini_result.threat_level,
            "screenshot_url":      incident.screenshot_url,
            "status":              "open",
            "timestamp":           incident.created_at,
            "frame_b64":           broadcast_b64,
        })

        return {
            "status":           "processed",
            "incident_id":      incident_id,
            "gemini_confirmed": gemini_result.confirmed,
            "gemini_threat":    gemini_result.threat_level,
            "sms_queued":       alert_level == "CRITICAL" and gemini_result.confirmed,
        }

    async def update_status(self, incident_id: str, status: str) -> None:
        """Update incident status (called by routes.py PATCH /incidents/{id})."""
        if incident_id in self._active:
            self._active[incident_id].status = status

        if not self._sb:
            return

        try:
            await asyncio.to_thread(
                lambda: self._sb.table("incidents").update({
                    "status":     status,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", incident_id).execute()
            )
        except Exception as e:
            print(f"[AlertManager] Status update error: {e}")

    async def remove(self, incident_id: str) -> None:
        """Delete an incident (called by routes.py DELETE /incidents/{id})."""
        self._active.pop(incident_id, None)
        if not self._sb:
            return
        try:
            await asyncio.to_thread(
                lambda: self._sb.table("incidents").delete().eq("id", incident_id).execute()
            )
        except Exception as e:
            print(f"[AlertManager] Delete error: {e}")

    def get_active(self) -> list[Incident]:
        return list(self._active.values())

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        return self._active.get(incident_id)

    def clear(self) -> None:
        self._active.clear()
        print("[AlertManager] In-memory store cleared.")

    # ─────────────────────────────────────────
    #  INTERNAL
    # ─────────────────────────────────────────

    async def _store(self, incident: Incident) -> None:
        if not self._sb:
            print(f"[AlertManager] Supabase not configured; {incident.id} not persisted.")
            return
        try:
            await asyncio.to_thread(
                lambda: self._sb.table("incidents").insert(incident.to_dict()).execute()
            )
            print(f"[AlertManager] Stored {incident.id}")
        except Exception as e:
            print(f"[AlertManager] Supabase insert error: {e}")

    async def _send_sms(self, incident: Incident) -> None:
        # Throttle by (camera, location) so a re-tracked person can't spam
        key  = (incident.camera_id, incident.location)
        now  = time.time()
        last = self._sms_last.get(key, 0)
        if now - last < SMS_COOLDOWN_SEC:
            print(f"[AlertManager] SMS throttled for {key}")
            return
        self._sms_last[key] = now

        if not is_sms_configured():
            print(f"[AlertManager] SMS not configured; would have alerted: {incident.id}")
            return

        ts      = datetime.now().strftime("%H:%M")
        # Quick route is limited to 160 chars — keep it tight.
        message = (
            f"ARGUS [{incident.alert_level}] "
            f"{incident.location} {incident.camera_id} "
            f"{int(incident.confidence * 100)}% {ts} {incident.id}"
        )[:155]

        numbers = ",".join(
            p.strip().lstrip("+").lstrip("91")
            for p in (POLICE_PHONE or "").split(",")
            if p.strip()
        )
        if not numbers:
            print("[AlertManager] POLICE_PHONE empty after parsing; skipping SMS.")
            return

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={"authorization": FAST2SMS_KEY},
                    data={
                        "message":          message,
                        "language":         "english",
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

    @staticmethod
    def _b64_to_frame(frame_b64: str) -> Optional[np.ndarray]:
        try:
            buf = base64.b64decode(frame_b64)
            arr = np.frombuffer(buf, dtype=np.uint8)
            return cv2.imdecode(arr, cv2.IMREAD_COLOR)
        except Exception:
            return None

    @staticmethod
    def _encode_jpeg(frame: np.ndarray, quality: int = 85) -> bytes:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return buf.tobytes()


# Module-level singleton — imported as `from ..alerts.alert_manager import alert_manager`
alert_manager = AlertManager()