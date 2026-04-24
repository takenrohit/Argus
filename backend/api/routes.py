"""
ARGUS — api/routes.py
All REST API endpoints mounted onto the FastAPI app in main.py.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..config import CAMERA_LOCATION, CAMERA_LAT, CAMERA_LNG
from .websocket import manager
from ..alerts.alert_manager import alert_manager
from ..runner import get_processor                              # NEW


router = APIRouter()


def _active_incident_rows() -> list[dict]:
    return [incident.to_dict() for incident in alert_manager.get_active()]


# ─────────────────────────────────────────────
#  PYDANTIC SCHEMAS
# ─────────────────────────────────────────────

class AlertPayload(BaseModel):
    """Sent by video_processor → POST /alert"""
    track_id:       int
    alert_level:    str             # CRITICAL | REVIEW | MONITOR
    confidence:     float
    distress_flags: dict
    camera_id:      str  = "CAM-01"
    location:       str  = CAMERA_LOCATION
    latitude:       float = CAMERA_LAT
    longitude:      float = CAMERA_LNG
    frame_b64:      Optional[str] = None   # base64 JPEG screenshot


class IncidentStatusUpdate(BaseModel):
    """Sent by dashboard officer → PATCH /incidents/{id}"""
    status: str    # acknowledged | resolved | false_positive


class CameraRegister(BaseModel):
    camera_id: str
    location:  str
    latitude:  float
    longitude: float


def _get_supabase_client():
    from ..config import SUPABASE_KEY, SUPABASE_URL

    if not SUPABASE_URL or not SUPABASE_KEY:
        return None

    try:
        from supabase import create_client
    except ImportError:
        return None

    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ─────────────────────────────────────────────
#  HEALTH
# ─────────────────────────────────────────────

@router.get("/health", tags=["System"])
async def health_check():
    """Quick liveness check — also shows connection status of all services."""
    from ..config import SUPABASE_URL, GEMINI_API_KEY, FAST2SMS_KEY
    return {
        "status":           "ok",
        "timestamp":        datetime.now(timezone.utc).isoformat(),
        "supabase":         bool(SUPABASE_URL),
        "gemini":           bool(GEMINI_API_KEY),
        "sms":              bool(FAST2SMS_KEY),
        "dashboard_clients": manager.client_count(),
    }


# ─────────────────────────────────────────────
#  ALERT INTAKE
# ─────────────────────────────────────────────

@router.post("/alert", tags=["Alerts"])
async def receive_alert(payload: AlertPayload):
    """
    Called by video_processor every time a distress event fires.

    Pipeline:
        1. Validate confidence threshold
        2. Run Gemini Vision confirmation
        3. Store incident in Supabase
        4. Send SMS if CRITICAL
        5. Broadcast to dashboard via WebSocket
    """
    # Discard anything below MONITOR threshold
    if payload.confidence < 0.50:
        return {"status": "ignored", "reason": "below threshold"}

    result = await alert_manager.handle(
        track_id=       payload.track_id,
        alert_level=    payload.alert_level,
        confidence=     payload.confidence,
        distress_flags= payload.distress_flags,
        camera_id=      payload.camera_id,
        location=       payload.location,
        latitude=       payload.latitude,
        longitude=      payload.longitude,
        frame_b64=      payload.frame_b64,
    )

    return result


# ─────────────────────────────────────────────
#  INCIDENTS
# ─────────────────────────────────────────────

@router.get("/incidents", tags=["Incidents"])
async def list_incidents(
    limit:  int           = Query(default=50,  ge=1, le=200),
    offset: int           = Query(default=0,   ge=0),
    level:  Optional[str] = Query(default=None, description="CRITICAL | REVIEW | MONITOR"),
    status: Optional[str] = Query(default=None, description="open | acknowledged | resolved | false_positive"),
):
    """
    Fetch paginated incident history for the dashboard.
    Optionally filter by alert level or status.
    """
    sb = _get_supabase_client()
    if sb is None:
        rows = _active_incident_rows()
        incidents = rows[offset:offset + limit]
        if level:
            incidents = [incident for incident in incidents if incident.get("alert_level") == level.upper()]
        if status:
            incidents = [incident for incident in incidents if incident.get("status") == status.lower()]
        return {
            "incidents": incidents,
            "total": len(rows),
            "limit": limit,
            "offset": offset,
            "note": "Using in-memory incident store",
        }

    try:
        q  = (
            sb.table("incidents")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if level:
            q = q.eq("alert_level", level.upper())
        if status:
            q = q.eq("status", status.lower())

        result = q.execute()
        return {
            "incidents": result.data,
            "total":     result.count,
            "limit":     limit,
            "offset":    offset,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/incidents/{incident_id}", tags=["Incidents"])
async def get_incident(incident_id: str):
    """Fetch a single incident by ID."""
    sb = _get_supabase_client()
    if sb is None:
        incident = alert_manager.get_incident(incident_id)
        if incident:
            return incident.to_dict()
        raise HTTPException(status_code=404, detail="Incident not found")

    try:
        result = sb.table("incidents").select("*").eq("id", incident_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Incident not found")
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/incidents/{incident_id}", tags=["Incidents"])
async def update_incident(incident_id: str, update: IncidentStatusUpdate):
    """
    Officer updates incident status from the dashboard.
    Valid statuses: acknowledged | resolved | false_positive
    """
    valid_statuses = {"acknowledged", "resolved", "false_positive"}
    if update.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    sb = _get_supabase_client()
    if sb is None:
        incident = alert_manager.get_incident(incident_id)
        if incident:
            incident.status = update.status
            incident.updated_at = datetime.now(timezone.utc).isoformat()
        await manager.broadcast_incident_update(incident_id, update.status)
        return {"status": "broadcast_only", "incident_id": incident_id}

    try:
        sb.table("incidents").update({
            "status":     update.status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", incident_id).execute()

        # Push live update to all dashboard clients
        await manager.broadcast_incident_update(incident_id, update.status)

        return {"status": "updated", "incident_id": incident_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/incidents/{incident_id}", tags=["Incidents"])
async def delete_incident(incident_id: str):
    """Delete a false positive incident permanently."""
    sb = _get_supabase_client()
    if sb is None:
        alert_manager._active.pop(incident_id, None)
        return {"status": "deleted", "incident_id": incident_id}

    try:
        sb.table("incidents").delete().eq("id", incident_id).execute()
        return {"status": "deleted", "incident_id": incident_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
#  STATS
# ─────────────────────────────────────────────

@router.get("/stats", tags=["Stats"])
async def get_stats():
    """
    Summary counts for the dashboard header.
    Returns totals broken down by alert level and status.
    """
    sb = _get_supabase_client()
    if sb is None:
        rows = _active_incident_rows()
        return {
            "total": len(rows),
            "critical": sum(1 for r in rows if r.get("alert_level") == "CRITICAL"),
            "review": sum(1 for r in rows if r.get("alert_level") == "REVIEW"),
            "monitor": sum(1 for r in rows if r.get("alert_level") == "MONITOR"),
            "open": sum(1 for r in rows if r.get("status") == "open"),
            "acknowledged": sum(1 for r in rows if r.get("status") == "acknowledged"),
            "resolved": sum(1 for r in rows if r.get("status") == "resolved"),
            "false_positive": sum(1 for r in rows if r.get("status") == "false_positive"),
            "dashboard_clients": manager.client_count(),
        }

    try:
        result = sb.table("incidents").select("alert_level, status").execute()
        rows   = result.data or []

        stats = {
            "total":         len(rows),
            "critical":      sum(1 for r in rows if r["alert_level"] == "CRITICAL"),
            "review":        sum(1 for r in rows if r["alert_level"] == "REVIEW"),
            "monitor":       sum(1 for r in rows if r["alert_level"] == "MONITOR"),
            "open":          sum(1 for r in rows if r["status"] == "open"),
            "acknowledged":  sum(1 for r in rows if r["status"] == "acknowledged"),
            "resolved":      sum(1 for r in rows if r["status"] == "resolved"),
            "false_positive":sum(1 for r in rows if r["status"] == "false_positive"),
            "dashboard_clients": manager.client_count(),
        }

        # Also push to all WebSocket clients so dashboard stays live
        await manager.broadcast_stats(stats)
        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
#  CAMERAS  (uses the registry in backend/cameras.py)
# ─────────────────────────────────────────────

from ..cameras import list_cameras as _registry_list, get_camera as _registry_get

@router.get("/cameras", tags=["Cameras"])
async def list_cameras():
    """List all cameras (without exposing internal source paths)."""
    return {"cameras": [c.to_public() for c in _registry_list()]}


@router.get("/cameras/{camera_id}", tags=["Cameras"])
async def get_camera_info(camera_id: str):
    cam = _registry_get(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam.to_public()


# ─────────────────────────────────────────────
#  FIGHT CLUSTERS  (NEW — frame-level fight detector output)
# ─────────────────────────────────────────────

@router.get("/clusters/{camera_id}", tags=["Cameras"])
async def get_clusters(camera_id: str):
    """
    Latest fight clusters detected for one camera.

    Returned per cluster:
        bbox          (x1, y1, x2, y2)  — region on the frame
        person_ids    list of TrackedPerson IDs in the cluster
        body_count    number of bodies in the cluster
        avg_speed     average pixel-speed of bodies
        motion_energy fraction of cluster region that is moving (0..1)
        intensity     final smoothed score (0..1)
        alert_level   NONE | MONITOR | REVIEW | CRITICAL
    """
    proc = get_processor(camera_id)
    if proc is None:
        raise HTTPException(status_code=404, detail=f"Unknown camera: {camera_id}")
    return {"camera_id": camera_id, "clusters": proc.latest_clusters()}


# ─────────────────────────────────────────────
#  DEMO SAFETY NET — manually fire a fake incident
# ─────────────────────────────────────────────

@router.post("/demo/trigger/{camera_id}", tags=["Demo"])
async def trigger_demo_incident(camera_id: str, level: str = "CRITICAL"):
    """If live detection misfires during the judge demo, hit this to force
    a full alert cycle (Supabase write, WS broadcast, map pin, evidence modal)."""
    cam = _registry_get(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return await alert_manager.handle(
        track_id=999,
        alert_level=level.upper(),
        confidence=0.92,
        distress_flags={"physical_struggle": 0.9, "panic_running": 0.7},
        camera_id=cam.id,
        location=cam.location,
        latitude=cam.latitude,
        longitude=cam.longitude,
        frame_b64=None,
    )