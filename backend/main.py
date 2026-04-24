from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.api.routes import router
from backend.api.websocket import websocket_endpoint


app = FastAPI(
    title="Argus",
    description="Real-Time AI Public Safety Surveillance System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.add_api_websocket_route("/ws/alerts", websocket_endpoint)

FRONTEND_DIST_DIR = (
    Path(__file__).resolve().parent.parent
    / "frontend"
    / "Argus2.0"
    / "ASSETS"
    / "argus-smart-surveillance"
    / "dist"
)


@app.get("/health")
async def root_health_check():
    return {"status": "Argus backend running"}


if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    async def serve_frontend():
        return FileResponse(FRONTEND_DIST_DIR / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend_routes(full_path: str):
        requested_path = FRONTEND_DIST_DIR / full_path
        if requested_path.is_file():
            return FileResponse(requested_path)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
else:
    @app.get("/", include_in_schema=False)
    async def fallback_root():
        return {
            "status": "Argus backend running",
            "frontend": "Build the frontend to serve it from FastAPI.",
        }
