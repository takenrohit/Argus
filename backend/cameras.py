"""ARGUS — backend/cameras.py
Camera registry. Add/remove cameras by editing the CAMERAS dict.
"""
from dataclasses import dataclass, asdict
from pathlib import Path
from .config import CAMERA_LAT, CAMERA_LNG

SAMPLE_VIDEO = Path(__file__).resolve().parent / "sample_videos" / "incident.mp4"


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
        source=str(SAMPLE_VIDEO) if SAMPLE_VIDEO.exists() else 0,
        location="AIIMS Delhi — Main Entrance",
        latitude=28.5672,
        longitude=77.2100,
    ),
    "CAM-02": Camera(
        id="CAM-02",
        name="Operator Camera",
        source=str(Path(__file__).resolve().parent / "sample_videos" / "incident2.mp4"),
        location="Hackathon Demo Booth",
        latitude=CAMERA_LAT or 28.6139,
        longitude=CAMERA_LNG or 77.2090,
    ),
}


def get_camera(camera_id: str) -> Camera | None:
    return CAMERAS.get(camera_id)


def list_cameras() -> list[Camera]:
    return list(CAMERAS.values())