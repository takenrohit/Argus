"""ARGUS — api/routes.py
All REST API endpoints mounted onto the FastAPI app in main.py.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import (
    CAMERA_LOCATION, CAMERA_LAT, CAMERA_LNG,
    is_supabase_configured, is_gemini_configured, is_sms_configured,
)
from ..db import get_supabase
from .websocket import manager
from ..alerts.alert_manager import alert_manager


router = APIRouter()


def _active_incident_rows() -> list[dict]:
    return [incident.to_dict() for incident in alert_manager.get_active()]


# ─────────────────────────────────────────────
#  PYDANTIC SCHEMAS
# ─────────────────────────────────────────────

class AlertPayload(BaseModel):
    """Sent by video_processor → POST /alert"""
    track_id:       int
    alert_level:    str
    confidence:     float
    distress_flags: dict
    camera_id:      str   = "CAM-01"
    location:       str   = CAMERA_LOCATION
    latitude:       float = CAMERA_LAT
    longitude:      float = CAMERA_LNG
    frame_b64:      Optional[str] = None


class IncidentStatusUpdate(BaseModel):
    """Sent by dashboard officer → PATCH /incidents/{id}"""
    status: str


# ─────────────────────────────────────────────
#  HEALTH
# ─────────────────────────────────────────────

@router.get("/health", tags=["System"])
async def health_check():
    return {
        "status":            "ok",
        "timestamp":         datetime.now(timezone.utc).isoformat(),
        "supabase":          is_supabase_configured(),
        "gemini":            is_gemini_configured(),
        "sms":               is_sms_configured(),
        "dashboard_clients": manager.client_count(),
    }


# ─────────────────────────────────────────────
#  ALERT INTAKE
# ─────────────────────────────────────────────

@router.post("/alert", tags=["Alerts"])
async def receive_alert(payload: AlertPayload):
    """Accept a distress event and run the full alert pipeline.

    Confidence threshold is enforced inside `alert_manager.handle()`,
    so the live-camera path and the HTTP path use the same gate.
    """
    return await alert_manager.handle(
        track_id       = payload.track_id,
        alert_level    = payload.alert_level,
        confidence     = payload.confidence,
        distress_flags = payload.distress_flags,
        camera_id      = payload.camera_id,
        location       = payload.location,
        latitude       = payload.latitude,
        longitude      = payload.longitude,
        frame_b64      = payload.frame_b64,
    )


# ─────────────────────────────────────────────
#  INCIDENTS
# ─────────────────────────────────────────────

@router.get("/incidents", tags=["Incidents"])
async def list_incidents(limit: int = 100):
    sb = get_supabase()
    if sb is None:
        rows = _active_incident_rows()[:limit]
        return {
            "incidents": rows,
            "total":     len(rows),
            "note":      "Supabase not configured — showing in-memory incidents only.",
        }

    try:
        result = await asyncio.to_thread(
            lambda: sb.table("incidents")
                      .select("*")
                      .order("created_at", desc=True)
                      .limit(limit)
                      .execute()
        )
        rows = result.data or []
        return {"incidents": rows, "total": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/incidents/{incident_id}", tags=["Incidents"])
async def update_incident(incident_id: str, update: IncidentStatusUpdate):
    """Officer action — acknowledge / resolve / mark false-positive."""
    await alert_manager.update_status(incident_id, update.status)
    await manager.broadcast_incident_update(incident_id, update.status)
    return {"status": "updated", "incident_id": incident_id}


@router.delete("/incidents/{incident_id}", tags=["Incidents"])
async def delete_incident(incident_id: str):
    """Permanently delete a false-positive incident."""
    await alert_manager.remove(incident_id)
    return {"status": "deleted", "incident_id": incident_id}


# ─────────────────────────────────────────────
#  STATS
# ─────────────────────────────────────────────

@router.get("/stats", tags=["Stats"])
async def get_stats():
    sb = get_supabase()
    if sb is None:
        rows = _active_incident_rows()
    else:
        try:
            result = await asyncio.to_thread(
                lambda: sb.table("incidents").select("alert_level, status").execute()
            )
            rows = result.data or []
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    stats = {
        "total":             len(rows),
        "critical":          sum(1 for r in rows if r.get("alert_level") == "CRITICAL"),
        "review":            sum(1 for r in rows if r.get("alert_level") == "REVIEW"),
        "monitor":           sum(1 for r in rows if r.get("alert_level") == "MONITOR"),
        "open":              sum(1 for r in rows if r.get("status") == "open"),
        "acknowledged":      sum(1 for r in rows if r.get("status") == "acknowledged"),
        "resolved":          sum(1 for r in rows if r.get("status") == "resolved"),
        "false_positive":    sum(1 for r in rows if r.get("status") == "false_positive"),
        "dashboard_clients": manager.client_count(),
    }

    if sb is not None:
        await manager.broadcast_stats(stats)
    return stats


# ─────────────────────────────────────────────
#  CAMERAS
# ─────────────────────────────────────────────

from ..cameras import list_cameras as _registry_list, get_camera as _registry_get


@router.get("/cameras", tags=["Cameras"])
async def list_cameras():
    return {"cameras": [c.to_public() for c in _registry_list()]}


@router.get("/cameras/{camera_id}", tags=["Cameras"])
async def get_camera_info(camera_id: str):
    cam = _registry_get(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam.to_public()


# ─────────────────────────────────────────────
#  DEMO SAFETY NET
# ─────────────────────────────────────────────

@router.post("/demo/trigger/{camera_id}", tags=["Demo"])
async def trigger_demo_incident(camera_id: str, level: str = "CRITICAL"):
    """If live detection misfires during the judge demo, force a full alert cycle."""
    cam = _registry_get(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return await alert_manager.handle(
        track_id       = 999,
        alert_level    = level.upper(),
        confidence     = 0.92,
        distress_flags = {"physical_struggle": 0.9, "panic_running": 0.7},
        camera_id      = cam.id,
        location       = cam.location,
        latitude       = cam.latitude,
        longitude      = cam.longitude,
    )