"""ARGUS — backend/runner.py
Launches one VideoProcessor per camera at FastAPI startup.
"""
import asyncio
import logging

from .cameras import CAMERAS
from .core.video_processor import VideoProcessor
from .alerts.alert_manager import alert_manager

log = logging.getLogger("argus.runner")

_processors: dict[str, VideoProcessor] = {}
_tasks: dict[str, asyncio.Task] = {}


def get_processor(camera_id: str) -> VideoProcessor | None:
    return _processors.get(camera_id)


def _make_alert_callback(camera_id: str):
    cam = CAMERAS[camera_id]

    async def on_alert(person, frame):
        # Pass the raw numpy frame — alert_manager encodes once at the end.
        await alert_manager.handle(
            track_id       = person.track_id,
            alert_level    = person.alert_level,
            confidence     = person.confidence,
            distress_flags = person.distress_flags,
            camera_id      = cam.id,
            location       = cam.location,
            latitude       = cam.latitude,
            longitude      = cam.longitude,
            frame          = frame,
        )

    return on_alert


async def _run_safely(processor: VideoProcessor, on_alert, camera_id: str, max_restarts: int = 3):
    """Auto-restart a processor a few times if it crashes (e.g. webcam glitch)."""
    for attempt in range(max_restarts):
        try:
            await processor.start(on_alert=on_alert)
            log.info("Camera %s ended cleanly.", camera_id)
            return
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning("Camera %s crashed (%d/%d): %s", camera_id, attempt + 1, max_restarts, e)
            await asyncio.sleep(3)
    log.error("Camera %s gave up after %d attempts.", camera_id, max_restarts)


async def start_all():
    for cam in CAMERAS.values():
        try:
            processor = VideoProcessor(source=cam.source, camera_id=cam.id)
            _processors[cam.id] = processor
            on_alert = _make_alert_callback(cam.id)
            _tasks[cam.id] = asyncio.create_task(
                _run_safely(processor, on_alert, cam.id)
            )
            log.info("Started camera %s on source=%s", cam.id, cam.source)
        except Exception as e:
            log.exception("Failed to start camera %s: %s", cam.id, e)


async def stop_all():
    # Cancel tasks first
    for task in _tasks.values():
        task.cancel()

    # Then wait for them so we don't leak unawaited cancellations
    if _tasks:
        await asyncio.gather(*_tasks.values(), return_exceptions=True)

    for processor in _processors.values():
        try:
            processor.stop()
        except Exception as e:
            log.warning("Processor stop error: %s", e)

    _tasks.clear()
    _processors.clear()
    log.info("All cameras stopped.")