from dotenv import load_dotenv
from pathlib import Path
import os

# Explicitly load from project root (one level up from backend/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path, override=True) # Ensure .env updates take effect immediately

SUPABASE_URL     = os.getenv("SUPABASE_URL")
SUPABASE_KEY     = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY")
FAST2SMS_KEY     = os.getenv("FAST2SMS_KEY")
POLICE_PHONE     = os.getenv("POLICE_PHONE")
CAMERA_LOCATION  = os.getenv("CAMERA_LOCATION", "Unknown")
CAMERA_LAT       = float(os.getenv("CAMERA_LAT", "0.0"))
CAMERA_LNG       = float(os.getenv("CAMERA_LNG", "0.0"))