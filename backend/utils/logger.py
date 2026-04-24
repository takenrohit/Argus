"""
ARGUS — utils/logger.py
Structured logging for the entire backend.
Every module imports the logger from here so logs are consistent.

Usage:
    from utils.logger import get_logger
    log = get_logger(__name__)

    log.info("VideoProcessor started")
    log.alert("CRITICAL incident detected", incident_id="INC-123", confidence=0.92)
    log.warning("Gemini API slow response")
    log.error("Supabase insert failed", error=str(e))
"""

import logging
import sys
import os
from datetime import datetime, timezone
from typing import Any


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

LOG_LEVEL    = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_TO_FILE  = os.getenv("LOG_TO_FILE", "false").lower() == "true"
LOG_FILE     = os.getenv("LOG_FILE", "logs/argus.log")

# Custom level for distress alerts — sits above WARNING (30), below ERROR (40)
ALERT_LEVEL     = 35
ALERT_LEVEL_NAME = "ALERT"


# ─────────────────────────────────────────────
#  CUSTOM ALERT LEVEL
# ─────────────────────────────────────────────

logging.addLevelName(ALERT_LEVEL, ALERT_LEVEL_NAME)

def _alert(self, message, *args, **kwargs):
    if self.isEnabledFor(ALERT_LEVEL):
        self._log(ALERT_LEVEL, message, args, **kwargs)

logging.Logger.alert = _alert


# ─────────────────────────────────────────────
#  COLOUR FORMATTER  (terminal only)
# ─────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"

LEVEL_COLOURS = {
    "DEBUG":   "\033[36m",    # cyan
    "INFO":    "\033[32m",    # green
    "WARNING": "\033[33m",    # yellow
    "ALERT":   "\033[35m",    # magenta
    "ERROR":   "\033[31m",    # red
    "CRITICAL":"\033[41m",    # red background
}


class ColourFormatter(logging.Formatter):
    """
    Colourised log formatter for terminal output.
    Format:  2025-05-05 14:32:00  [ALERT ]  alerts.alert_manager — CRITICAL incident detected
    """

    FMT = "%(asctime)s  %(levelname_coloured)s  %(name_short)s — %(message)s%(fields)s"

    def format(self, record: logging.LogRecord) -> str:
        # Shorten logger name: "backend.core.video_processor" → "core.video_processor"
        parts = record.name.split(".")
        record.name_short = ".".join(parts[-2:]) if len(parts) > 1 else record.name

        # Colour the level label, padded to 8 chars
        colour = LEVEL_COLOURS.get(record.levelname, RESET)
        record.levelname_coloured = (
            f"{colour}{BOLD}[{record.levelname:<7}]{RESET}"
        )

        # Extra structured fields passed as kwargs to log calls
        extra_fields = getattr(record, "_fields", {})
        if extra_fields:
            fields_str = "  " + "  ".join(f"{k}={v}" for k, v in extra_fields.items())
            record.fields = f"\n             {fields_str}"
        else:
            record.fields = ""

        record.asctime = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        formatter = logging.Formatter(self.FMT)
        return formatter.format(record)


class PlainFormatter(logging.Formatter):
    """Plain formatter for file output — no colour codes."""

    def format(self, record: logging.LogRecord) -> str:
        parts = record.name.split(".")
        record.name_short = ".".join(parts[-2:]) if len(parts) > 1 else record.name

        extra_fields = getattr(record, "_fields", {})
        fields_str   = ""
        if extra_fields:
            fields_str = "  " + "  ".join(f"{k}={v}" for k, v in extra_fields.items())

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        return (
            f"{ts}  [{record.levelname:<8}]  {record.name_short} — "
            f"{record.getMessage()}{fields_str}"
        )


# ─────────────────────────────────────────────
#  ARGUS LOGGER WRAPPER
# ─────────────────────────────────────────────

class ArgusLogger:
    """
    Thin wrapper around Python's logging.Logger.
    Adds structured field support and the custom .alert() level.

    All log methods accept optional keyword arguments that are
    printed as structured key=value pairs after the message:

        log.info("Person tracked", track_id=3, speed=92.4)
        log.alert("CRITICAL fired", incident_id="INC-123", camera="CAM-01")
    """

    def __init__(self, logger: logging.Logger):
        self._logger = logger

    def _log(self, level: int, msg: str, fields: dict):
        if fields:
            extra = {"_fields": fields}
            self._logger.log(level, msg, extra=extra)
        else:
            self._logger.log(level, msg)

    def debug(self, msg: str, **fields: Any):
        self._log(logging.DEBUG, msg, fields)

    def info(self, msg: str, **fields: Any):
        self._log(logging.INFO, msg, fields)

    def warning(self, msg: str, **fields: Any):
        self._log(logging.WARNING, msg, fields)

    def alert(self, msg: str, **fields: Any):
        """Custom ALERT level — for distress incidents."""
        self._log(ALERT_LEVEL, msg, fields)

    def error(self, msg: str, **fields: Any):
        self._log(logging.ERROR, msg, fields)

    def critical(self, msg: str, **fields: Any):
        self._log(logging.CRITICAL, msg, fields)

    def exception(self, msg: str, **fields: Any):
        """Log ERROR with full traceback — use inside except blocks."""
        if fields:
            self._logger.exception(msg, extra={"_fields": fields})
        else:
            self._logger.exception(msg)


# ─────────────────────────────────────────────
#  SETUP — run once on import
# ─────────────────────────────────────────────

def _setup_root_logger():
    root = logging.getLogger("argus")
    root.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    # Remove any existing handlers (avoid duplicate logs on reload)
    root.handlers.clear()

    # ── Terminal handler ──
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(ColourFormatter())
    root.addHandler(console)

    # ── File handler (optional) ──
    if LOG_TO_FILE:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
        file_handler.setFormatter(PlainFormatter())
        root.addHandler(file_handler)
        root.info(f"File logging enabled → {LOG_FILE}")

    # Silence noisy third-party loggers
    for noisy in ("uvicorn.access", "ultralytics", "mediapipe"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return root


_root_logger = _setup_root_logger()


# ─────────────────────────────────────────────
#  PUBLIC API
# ─────────────────────────────────────────────

def get_logger(name: str) -> ArgusLogger:
    """
    Get a named ArgusLogger for any module.

    Usage:
        from utils.logger import get_logger
        log = get_logger(__name__)
    """
    child = logging.getLogger(f"argus.{name}")
    return ArgusLogger(child)


# ─────────────────────────────────────────────
#  MODULE-LEVEL CONVENIENCE LOGGERS
# ─────────────────────────────────────────────
# These are pre-made loggers for the main modules.
# Import directly if you don't want to call get_logger():
#
#   from utils.logger import video_log
#   video_log.info("Frame processed", frame=42)

video_log   = get_logger("core.video_processor")
yolo_log    = get_logger("core.yolo_tracker")
engine_log  = get_logger("core.distress_engine")
gemini_log  = get_logger("core.gemini_validator")
alert_log   = get_logger("alerts.alert_manager")
evidence_log= get_logger("alerts.evidence_saver")
api_log     = get_logger("api.routes")
ws_log      = get_logger("api.websocket")