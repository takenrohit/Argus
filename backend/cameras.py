"""ARGUS — backend/cameras.py
Camera registry. Add/remove cameras by editing the CAMERAS dict.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from .config import CAMERA_LAT, CAMERA_LNG

SAMPLE_DIR     = Path(__file__).resolve().parent / "sample_videos"
SAMPLE_VIDEO_1 = SAMPLE_DIR / "incident.mp4"
SAMPLE_VIDEO_2 = SAMPLE_DIR / "incident2.mp4"


def _resolve_source(*candidates: Path) -> str:
    """Pick the first video file that actually exists. Raises if none found."""
    for p in candidates:
        if p.exists():
            return str(p)
    tried = ", ".join(str(p) for p in candidates)
    raise FileNotFoundError(
        f"No video found for camera. Tried: {tried}. "
        f"Drop a video into {SAMPLE_DIR} and restart."
    )


@dataclass
class Camera:
    id: str
    name: str
    source: str | int        # MP4 path, RTSP URL, or webcam index (0/1/...)
    location: str
    latitude: float
    longitude: float
    status: str = "active"

    def to_public(self) -> dict:
        d = asdict(self)
        d.pop("source", None)   # don't leak internal source path to the browser
        return d


CAMERAS: dict[str, Camera] = {
    "CAM-01": Camera(
        id="CAM-01",
        name="Hospital Entrance",
        source=_resolve_source(SAMPLE_VIDEO_1, SAMPLE_VIDEO_2),
        location="AIIMS Delhi — Main Entrance",
        latitude=28.5672,
        longitude=77.2100,
    ),
    "CAM-02": Camera(
        id="CAM-02",
        name="Operator Camera",
        source=_resolve_source(SAMPLE_VIDEO_2, SAMPLE_VIDEO_1),
        location="Hackathon Demo Booth",
        latitude=CAMERA_LAT or 28.6139,
        longitude=CAMERA_LNG or 77.2090,
    ),
    "CAM-WEB": Camera(
        id="CAM-WEB",
        name="Live Webcam",
        source=0,
        location="Operator Workstation",
        latitude=28.6139,
        longitude=77.2090,
    ),
}


def get_camera(camera_id: str) -> Camera | None:
    return CAMERAS.get(camera_id)


def list_cameras() -> list[Camera]:
    return list(CAMERAS.values())