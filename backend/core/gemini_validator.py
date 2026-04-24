"""
ARGUS — core/gemini_validator.py
Uses Google Gemini Vision to visually confirm distress detections.
Acts as the final layer of validation before an alert is fired —
reduces false positives by having AI actually look at the scene.
"""

import json
import base64
import httpx
import numpy as np
import cv2
from dataclasses import dataclass

from ..config import GEMINI_API_KEY


# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────

GEMINI_MODEL   = "gemini-1.5-flash"   # fast + free tier
# We construct the URL dynamically in the call method to ensure the latest API key is used
REQUEST_TIMEOUT = 12   # seconds


# ─────────────────────────────────────────────
#  RESULT DATACLASS
# ─────────────────────────────────────────────

@dataclass
class GeminiResult:
    confirmed:    bool
    threat_level: str    # "high" | "medium" | "low" | "none"
    description:  str    # one-sentence scene summary
    raw_response: str    # full text from Gemini (for debugging)

    def is_threat(self) -> bool:
        return self.confirmed and self.threat_level in ("high", "medium")


# ─────────────────────────────────────────────
#  GEMINI VALIDATOR
# ─────────────────────────────────────────────

class GeminiValidator:
    """
    Sends a CCTV frame + detected distress flags to Gemini Vision
    and asks it to confirm whether a real threat is present.

    Usage:
        validator = GeminiValidator()
        result = await validator.validate(frame, flags)
        if result.is_threat():
            # proceed with alert
    """

    def __init__(self):
        if not GEMINI_API_KEY:
            print("[GeminiValidator] No API key; running in bypass mode.")
        else:
            print("[GeminiValidator] Ready")

    async def validate(
        self,
        frame: np.ndarray,
        distress_flags: dict[str, float],
        confidence: float,
        alert_level: str,
    ) -> GeminiResult:
        """
        Main validation method.

        Args:
            frame:          BGR numpy frame (OpenCV)
            distress_flags: dict of { signature_name: score }
            confidence:     overall confidence from distress engine
            alert_level:    CRITICAL | REVIEW | MONITOR

        Returns:
            GeminiResult with confirmed, threat_level, description
        """

        # If no API key, bypass and trust the distress engine.
        if not GEMINI_API_KEY:
            return GeminiResult(
                confirmed=True,
                threat_level="high" if alert_level == "CRITICAL" else "medium",
                description="Gemini not configured; distress engine result accepted.",
                raw_response="",
            )

        if frame is None:
            return GeminiResult(
                confirmed=True,
                threat_level="medium",
                description="No frame provided; distress engine result accepted.",
                raw_response="",
            )

        frame_b64 = self._encode_frame(frame)
        prompt    = self._build_prompt(distress_flags, confidence, alert_level)

        try:
            raw = await self._call_gemini(frame_b64, prompt)
            return self._parse_response(raw)
        except Exception as e:
            print(f"[GeminiValidator] Error: {e}; defaulting to confirmed.")
            return GeminiResult(
                confirmed=True,
                threat_level="medium",
                description=f"Gemini call failed: {str(e)}",
                raw_response="",
            )

    # ─────────────────────────────────────────
    #  PROMPT BUILDER
    # ─────────────────────────────────────────

    def _build_prompt(
        self,
        flags: dict[str, float],
        confidence: float,
        alert_level: str,
    ) -> str:
        """
        Builds a structured prompt telling Gemini exactly what to look for
        based on which distress signatures were triggered.
        """
        # Describe only flags that actually triggered
        active_flags = {k: v for k, v in flags.items() if v > 0.3}

        flag_descriptions = {
            "encirclement":      "multiple people surrounding or encircling a person",
            "being_followed":    "a person being followed or stalked",
            "physical_struggle": "a physical fight, assault, or struggle",
            "panic_running":     "a person running in panic or fleeing",
            "collapsed":         "a person collapsed or unconscious on the ground",
        }

        detected_str = "\n".join([
            f"  - {flag_descriptions.get(k, k)} (score: {v:.0%})"
            for k, v in active_flags.items()
        ]) or "  - general distress behaviour"

        return f"""You are an AI safety analyst reviewing a CCTV surveillance frame.

The automated system has flagged this scene as [{alert_level}] with {confidence:.0%} confidence.

Detected signals:
{detected_str}

Your task:
1. Look at the image carefully.
2. Determine if the scene genuinely shows a distress or safety threat.
3. Respond ONLY with a valid JSON object — no extra text, no markdown fences.

Required JSON format:
{{
  "confirmed": true or false,
  "threat_level": "high" or "medium" or "low" or "none",
  "description": "One sentence describing what you see in the scene."
}}

Rules:
- confirmed = true if there is a visible safety concern
- threat_level "high" = immediate danger (assault, collapse, surrounded)
- threat_level "medium" = suspicious but uncertain (possible follow, mild struggle)
- threat_level "low" = unlikely threat, normal behaviour
- threat_level "none" = clearly no threat, false positive
- Keep description factual and under 20 words."""

    # ─────────────────────────────────────────
    #  GEMINI API CALL
    # ─────────────────────────────────────────

    async def _call_gemini(self, frame_b64: str, prompt: str) -> str:
        """POST to Gemini Vision API and return raw text response."""
        body = {
            "contents": [{
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": frame_b64,
                        }
                    },
                    {
                        "text": prompt
                    }
                ]
            }],
            "generationConfig": {
                "temperature":     0.1,   # low temp = consistent structured output
                "maxOutputTokens": 150,
            }
        }

        # Resolve key dynamically to ensure it's always up to date
        from ..config import GEMINI_API_KEY
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()

        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]

    # ─────────────────────────────────────────
    #  RESPONSE PARSER
    # ─────────────────────────────────────────

    def _parse_response(self, raw: str) -> GeminiResult:
        """
        Parse Gemini's text response into a GeminiResult.
        Handles cases where Gemini wraps JSON in markdown fences.
        """
        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines   = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]).strip()

        try:
            data = json.loads(cleaned)
            return GeminiResult(
                confirmed=    bool(data.get("confirmed", True)),
                threat_level= str(data.get("threat_level", "medium")).lower(),
                description=  str(data.get("description", "No description.")),
                raw_response= raw,
            )
        except json.JSONDecodeError:
            print(f"[GeminiValidator] Could not parse JSON: {raw[:100]}")
            # Fallback — treat as confirmed medium threat
            return GeminiResult(
                confirmed=True,
                threat_level="medium",
                description=raw[:120],
                raw_response=raw,
            )

    # ─────────────────────────────────────────
    #  FRAME ENCODER
    # ─────────────────────────────────────────

    @staticmethod
    def _encode_frame(frame: np.ndarray, quality: int = 75) -> str:
        """Encode BGR frame as base64 JPEG for Gemini API."""
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return base64.b64encode(buf).decode("utf-8")
