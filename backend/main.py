# ============================================================
# main.py — Argus Backend Entry Point
# Real-Time AI Surveillance System
# ============================================================

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio

# ── App Initialization ───────────────────────────────────────
app = FastAPI(
    title="Argus",
    description="Real-Time AI Public Safety Surveillance System",
    version="1.0.0",
)

# ── CORS Middleware ──────────────────────────────────────────
# Allow all origins for hackathon demo; restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router Registration ──────────────────────────────────────
# Safely include API routes if the module is available
try:
    from api.routes import router
    app.include_router(router, prefix="/api")
except ImportError:
    pass  # Routes not yet implemented; skip gracefully

# ── WebSocket Connection Manager ─────────────────────────────
# Manages active WebSocket connections for broadcasting alerts
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Broadcast a JSON alert to all connected clients."""
        payload = json.dumps(message)
        for connection in self.active_connections:
            await connection.send_text(payload)

manager = ConnectionManager()

# ── Health Check ─────────────────────────────────────────────
@app.get("/")
async def health_check():
    """Simple health check to verify backend is running."""
    return {"status": "Argus backend running"}

# ── WebSocket Alert Endpoint ─────────────────────────────────
# Clients (Next.js dashboard) connect here to receive live alerts
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """
    Real-time alert stream via WebSocket.
    The distress detection engine pushes alerts through this endpoint.
    Payload shape:
        {
            "type": "ENCIRCLEMENT" | "FOLLOWING" | "STRUGGLE",
            "confidence": float,
            "camera_id": str,
            "timestamp": str,
            "bbox": [x1, y1, x2, y2]
        }
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; alerts are pushed via manager.broadcast()
            # Optionally handle incoming client messages (e.g. ACK, ping)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ── Expose Manager for Alert Broadcasting ────────────────────
# Import this in distress_engine.py or video_processor.py:
#   from main import manager
#   await manager.broadcast(alert_payload)