"""ARGUS — alerts/evidence_saver.py
Persist a JPEG screenshot for one alert event.

Tries Supabase Storage first, falls back to local disk.
"""

import os
import base64
import asyncio
from datetime import datetime
from typing import Optional

import cv2
import numpy as np

from ..config import is_supabase_configured
from ..db import get_supabase


LOCAL_EVIDENCE_DIR = "evidence"
SUPABASE_BUCKET    = "evidence"
JPEG_QUALITY       = 85


class EvidenceSaver:
    """Saves a screenshot for an incident."""

    def __init__(self, evidence_dir: str = LOCAL_EVIDENCE_DIR):
        self.evidence_dir = evidence_dir
        os.makedirs(self.evidence_dir, exist_ok=True)

        self._sb = get_supabase() if is_supabase_configured() else None
        if self._sb:
            print("[EvidenceSaver] Supabase Storage ready")
        else:
            print("[EvidenceSaver] Saving evidence locally only.")

    # ─────────────────────────────────────────
    #  PUBLIC API
    # ─────────────────────────────────────────

    async def save(
        self,
        frame_b64:   str,
        incident_id: str,
        camera_id:   str = "CAM-01",
    ) -> str:
        """Backwards-compatible: accept a base64 JPEG string."""
        try:
            jpeg_bytes = base64.b64decode(frame_b64)
        except Exception as e:
            print(f"[EvidenceSaver] Could not decode frame for {incident_id}: {e}")
            return ""
        return await self.save_bytes(jpeg_bytes, incident_id, camera_id)

    async def save_bytes(
        self,
        jpeg_bytes:  bytes,
        incident_id: str,
        camera_id:   str = "CAM-01",
    ) -> str:
        """Preferred: accept the already-encoded JPEG bytes."""
        filename = self._make_filename(incident_id, camera_id)

        if self._sb:
            url = await self._upload_supabase(jpeg_bytes, filename)
            if url:
                return url

        return await asyncio.to_thread(self._save_local_bytes, jpeg_bytes, filename)

    async def save_frame(self, frame: np.ndarray, incident_id: str, camera_id: str = "CAM-01") -> str:
        """Convenience: encode a numpy BGR frame, then save."""
        jpeg_bytes = await asyncio.to_thread(self._encode_jpeg, frame)
        return await self.save_bytes(jpeg_bytes, incident_id, camera_id)

    # ─────────────────────────────────────────
    #  STORAGE
    # ─────────────────────────────────────────

    async def _upload_supabase(self, jpeg_bytes: bytes, filename: str) -> str:
        try:
            url = await asyncio.to_thread(self._supabase_upload_sync, jpeg_bytes, filename)
            print(f"[EvidenceSaver] Uploaded to Supabase: {filename}")
            return url
        except Exception as e:
            print(f"[EvidenceSaver] Supabase upload failed: {e}; falling back to local.")
            return ""

    def _supabase_upload_sync(self, jpeg_bytes: bytes, filename: str) -> str:
        self._sb.storage.from_(SUPABASE_BUCKET).upload(
            path         = filename,
            file         = jpeg_bytes,
            file_options = {"content-type": "image/jpeg"},
        )
        return self._sb.storage.from_(SUPABASE_BUCKET).get_public_url(filename)

    def _save_local_bytes(self, jpeg_bytes: bytes, filename: str) -> str:
        file_path = os.path.join(self.evidence_dir, filename)
        try:
            with open(file_path, "wb") as f:
                f.write(jpeg_bytes)
        except Exception as e:
            print(f"[EvidenceSaver] Local write failed {file_path}: {e}")
            return ""
        abs_path = os.path.abspath(file_path)
        print(f"[EvidenceSaver] Saved locally: {abs_path}")
        return abs_path

    # ─────────────────────────────────────────
    #  HELPERS
    # ─────────────────────────────────────────

    @staticmethod
    def _make_filename(incident_id: str, camera_id: str) -> str:
        ts = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
        return f"{camera_id}_{incident_id}_{ts}.jpg"

    @staticmethod
    def _encode_jpeg(frame: np.ndarray, quality: int = JPEG_QUALITY) -> bytes:
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return buf.tobytes()