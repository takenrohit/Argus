"""
ARGUS — alerts/evidence_saver.py
Saves evidence screenshots when an alert fires.

Priority:
    1. Upload to Supabase Storage  → returns public URL
    2. Fallback: save locally      → returns local file path

alert_manager.py calls:
    url = await evidence_saver.save(frame_b64, incident_id, camera_id)
"""

import os
import base64
import asyncio
from datetime import datetime

import cv2
import numpy as np

from ..config import SUPABASE_URL, SUPABASE_KEY


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

LOCAL_EVIDENCE_DIR   = "evidence"
SUPABASE_BUCKET      = "evidence"        # bucket name in Supabase Storage
JPEG_QUALITY         = 85


# ─────────────────────────────────────────────
#  EVIDENCE SAVER
# ─────────────────────────────────────────────

class EvidenceSaver:
    """
    Accepts a base64 JPEG string, decodes it, and saves it as evidence.

    Tries Supabase Storage first for a persistent public URL.
    Falls back to local disk if Supabase is unavailable.

    Usage:
        url = await evidence_saver.save(frame_b64, incident_id, camera_id)
    """

    def __init__(self, evidence_dir: str = LOCAL_EVIDENCE_DIR):
        self.evidence_dir = evidence_dir
        os.makedirs(self.evidence_dir, exist_ok=True)

        # Supabase client — None if not configured
        self._sb = None
        if SUPABASE_URL and SUPABASE_KEY:
            try:
                from supabase import create_client
                self._sb = create_client(SUPABASE_URL, SUPABASE_KEY)
                print("[EvidenceSaver] Supabase Storage ready ✅")
            except Exception as e:
                print(f"[EvidenceSaver] Supabase init failed: {e} — using local storage.")
        else:
            print("[EvidenceSaver] No Supabase config — saving locally.")

    # ─────────────────────────────────────────
    #  MAIN SAVE METHOD
    # ─────────────────────────────────────────

    async def save(
        self,
        frame_b64:   str,
        incident_id: str,
        camera_id:   str = "CAM-01",
    ) -> str:
        """
        Decode base64 frame and save as evidence.

        Args:
            frame_b64:   base64-encoded JPEG string from video_processor
            incident_id: unique incident ID (used in filename)
            camera_id:   camera label (used in filename)

        Returns:
            URL string — Supabase public URL or local file path
        """
        # Decode base64 → numpy frame
        frame = self._decode_b64(frame_b64)
        if frame is None:
            print(f"[EvidenceSaver] ❌ Could not decode frame for {incident_id}")
            return ""

        filename = self._make_filename(incident_id, camera_id)

        # Try Supabase Storage first
        if self._sb:
            url = await self._upload_supabase(frame, filename)
            if url:
                return url

        # Fallback — save locally
        return self._save_local(frame, filename)

    # ─────────────────────────────────────────
    #  SUPABASE STORAGE UPLOAD
    # ─────────────────────────────────────────

    async def _upload_supabase(self, frame: np.ndarray, filename: str) -> str:
        """
        Upload frame to Supabase Storage bucket.
        Returns public URL on success, empty string on failure.
        """
        try:
            # Encode frame to JPEG bytes
            jpeg_bytes = self._encode_jpeg(frame)

            # Run blocking Supabase upload in thread so we don't block event loop
            url = await asyncio.to_thread(
                self._supabase_upload_sync,
                jpeg_bytes,
                filename,
            )
            print(f"[EvidenceSaver] ✅ Uploaded to Supabase: {filename}")
            return url

        except Exception as e:
            print(f"[EvidenceSaver] ❌ Supabase upload failed: {e} — falling back to local.")
            return ""

    def _supabase_upload_sync(self, jpeg_bytes: bytes, filename: str) -> str:
        """Synchronous Supabase upload (run via asyncio.to_thread)."""
        self._sb.storage.from_(SUPABASE_BUCKET).upload(
            path=         filename,
            file=         jpeg_bytes,
            file_options= {"content-type": "image/jpeg"},
        )
        # Get public URL
        result = self._sb.storage.from_(SUPABASE_BUCKET).get_public_url(filename)
        return result

    # ─────────────────────────────────────────
    #  LOCAL SAVE
    # ─────────────────────────────────────────

    def _save_local(self, frame: np.ndarray, filename: str) -> str:
        """
        Save frame to local evidence/ directory.
        Returns absolute file path.
        """
        file_path = os.path.join(self.evidence_dir, filename)
        success   = cv2.imwrite(
            file_path,
            frame,
            [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
        )
        if not success:
            print(f"[EvidenceSaver] ❌ cv2.imwrite failed: {file_path}")
            return ""

        abs_path = os.path.abspath(file_path)
        print(f"[EvidenceSaver] ✅ Saved locally: {abs_path}")
        return abs_path

    # ─────────────────────────────────────────
    #  UTILITIES
    # ─────────────────────────────────────────

    @staticmethod
    def _make_filename(incident_id: str, camera_id: str) -> str:
        """
        Build a clean filename.
        Format: CAM-01_INC-1714900000-3_2025-05-05_14-32-00.jpg
        """
        ts = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
        return f"{camera_id}_{incident_id}_{ts}.jpg"

    @staticmethod
    def _decode_b64(frame_b64: str) -> np.ndarray | None:
        """Decode a base64 JPEG string to a BGR numpy array."""
        try:
            buf   = base64.b64decode(frame_b64)
            arr   = np.frombuffer(buf, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return frame
        except Exception as e:
            print(f"[EvidenceSaver] Decode error: {e}")
            return None

    @staticmethod
    def _encode_jpeg(frame: np.ndarray, quality: int = JPEG_QUALITY) -> bytes:
        """Encode BGR numpy array to JPEG bytes."""
        _, buf = cv2.imencode(
            ".jpg", frame,
            [cv2.IMWRITE_JPEG_QUALITY, quality]
        )
        return buf.tobytes()

    # ─────────────────────────────────────────
    #  LEGACY SUPPORT
    # ─────────────────────────────────────────

    def save_frame(self, frame: np.ndarray, incident_id: str) -> str:
        """
        Legacy method — keeps backward compatibility if anything
        still calls save_frame() with a raw numpy array directly.
        """
        filename = self._make_filename(incident_id, "CAM-00")
        return self._save_local(frame, filename)


# ─────────────────────────────────────────────
#  SINGLETON
# ─────────────────────────────────────────────

evidence_saver = EvidenceSaver()