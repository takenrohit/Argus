"""Shared Supabase client.

Centralises the Supabase connection so we don't create three separate
clients (one per module). Returns None if Supabase is not configured.
"""
from typing import Optional

from .config import SUPABASE_URL, SUPABASE_KEY

_client = None
_initialized = False


def get_supabase():
    """Return a process-wide Supabase client, or None if not configured."""
    global _client, _initialized
    if _initialized:
        return _client

    _initialized = True
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[db] Supabase not configured; running in in-memory mode.")
        return None

    try:
        from supabase import create_client
    except ImportError as e:
        print(f"[db] supabase-py not installed: {e}")
        return None

    try:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[db] Supabase client ready.")
    except Exception as e:
        print(f"[db] Supabase init failed: {e}")
        _client = None

    return _client