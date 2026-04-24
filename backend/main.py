import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend.api.routes import router
from backend.api.websocket import websocket_endpoint
from backend.runner import start_all, stop_all, get_processor


# ─────────────────────────────────────────────
#  LIFESPAN — start/stop all camera processors
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await start_all()
    yield
    await stop_all()


# ─────────────────────────────────────────────
#  APP
# ─────────────────────────────────────────────

app = FastAPI(
    title="Argus",
    description="Real-Time AI Public Safety Surveillance System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,    # '*' + credentials is invalid per CORS spec
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.add_api_websocket_route("/ws/alerts", websocket_endpoint)


# ─────────────────────────────────────────────
#  LIVE VIDEO — MJPEG STREAM PER CAMERA
# ─────────────────────────────────────────────

@app.get("/api/video/{camera_id}", tags=["Cameras"])
async def stream_camera(camera_id: str):
    """Continuous annotated MJPEG feed for one camera.
    Browser usage: <img src="/api/video/CAM-01" />
    """
    proc = get_processor(camera_id)
    if proc is None:
        raise HTTPException(status_code=404, detail=f"Unknown camera: {camera_id}")

    async def gen():
        while True:
            jpeg = proc.latest_jpeg()
            if jpeg:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n" +
                    jpeg + b"\r\n"
                )
            await asyncio.sleep(1 / 15)   # ~15 fps to the browser is plenty

    return StreamingResponse(
        gen(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ─────────────────────────────────────────────
#  HEALTH
# ─────────────────────────────────────────────

@app.get("/health")
async def root_health_check():
    return {"status": "Argus backend running"}


# ─────────────────────────────────────────────
#  FRONTEND SERVING (with path-traversal fix)
# ─────────────────────────────────────────────

FRONTEND_DIST_DIR = (
    Path(__file__).resolve().parent.parent
    / "frontend" / "Argus2.0" / "ASSETS" / "argus-smart-surveillance" / "dist"
).resolve()

if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    async def serve_frontend():
        return FileResponse(FRONTEND_DIST_DIR / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend_routes(full_path: str):
        # Resolve and ensure the requested path is INSIDE the dist dir
        candidate = (FRONTEND_DIST_DIR / full_path).resolve()
        try:
            candidate.relative_to(FRONTEND_DIST_DIR)
        except ValueError:
            # Path traversal attempt — serve index.html instead
            return FileResponse(FRONTEND_DIST_DIR / "index.html")
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")

else:
    @app.get("/", include_in_schema=False)
    async def fallback_root():
        return {"status": "Argus backend running", "frontend": "Build the frontend to serve it."}