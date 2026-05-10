import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.services.elevenlabs import generate_sound_effect

router = APIRouter(tags=["music"])

BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BASE_DIR / "output"

ELEVENLABS_MAX_SECONDS = 22.0

INTENSITY_TEMPLATES: dict[str, str] = {
    "subtle": (
        "very quiet, minimal cinematic ambient music, {mood} tone, "
        "gentle background score, barely audible film underscore"
    ),
    "moderate": (
        "cinematic background music, {mood} tone, "
        "atmospheric film score, orchestral undertones"
    ),
    "intense": (
        "dramatic cinematic music, {mood} tone, "
        "powerful film score, building tension"
    ),
}


class GenerateMusicRequest(BaseModel):
    mood: str = "neutral"
    duration_seconds: float = 10.0
    intensity: Literal["subtle", "moderate", "intense"] = "moderate"


@router.get("/music/ping")
async def ping() -> dict[str, str]:
    return {"route": "music", "status": "ok"}


@router.post("/generate-music")
async def generate_music(req: GenerateMusicRequest) -> dict:
    settings = get_settings()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    template = INTENSITY_TEMPLATES.get(req.intensity, INTENSITY_TEMPLATES["moderate"])
    prompt = template.format(mood=req.mood)

    music_id = uuid.uuid4().hex
    filename = f"music_{music_id}.mp3"
    file_path = OUTPUT_DIR / filename

    requested_duration = max(0.5, req.duration_seconds)
    api_duration = min(requested_duration, ELEVENLABS_MAX_SECONDS)
    truncated = requested_duration > ELEVENLABS_MAX_SECONDS

    if not settings.ELEVENLABS_API_KEY:
        return {
            "music_url": None,
            "mood": req.mood,
            "intensity": req.intensity,
            "duration": 0.0,
            "prompt": prompt,
            "warning": (
                "ELEVENLABS_API_KEY is not set. No music generated. "
                "Add the key to backend/.env to enable music generation."
            ),
            "mock": True,
        }

    try:
        audio_bytes = await generate_sound_effect(
            description=prompt,
            duration_seconds=api_duration,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs music generation failed: {exc}",
        )

    with open(file_path, "wb") as f:
        f.write(audio_bytes)

    return {
        "music_url": f"/output/{filename}",
        "mood": req.mood,
        "intensity": req.intensity,
        "duration": api_duration,
        "prompt": prompt,
        "truncated": truncated,
        "mock": False,
    }
