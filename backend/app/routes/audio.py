from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.elevenlabs import generate_audio_layers
from app.services.ffmpeg_ops import mix_audio_layers, overlay_audio_on_video

router = APIRouter(tags=["audio"])

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"


class GenerateAudioRequest(BaseModel):
    clip_id: str
    sounds_needed: list[str] = Field(default_factory=list)
    ambient_type: str = "indoor-room"
    mood: str = "neutral"
    duration_seconds: float = 5.0


def _find_source_video(clip_id: str) -> Path | None:
    matches = sorted(UPLOADS_DIR.glob(f"{clip_id}.*"))
    return matches[0] if matches else None


@router.get("/audio/ping")
async def ping() -> dict[str, str]:
    return {"route": "audio", "status": "ok"}


@router.post("/generate-audio")
async def generate_audio(req: GenerateAudioRequest) -> dict:
    settings = get_settings()

    source_video = _find_source_video(req.clip_id)
    if source_video is None:
        raise HTTPException(
            status_code=404,
            detail=f"No source video found for clip_id={req.clip_id} in uploads/",
        )

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_filename = f"{req.clip_id}_with_audio.mp4"
    output_path = PROCESSED_DIR / output_filename

    if not settings.ELEVENLABS_API_KEY:
        # Mock mode: copy original video to processed/ so the frontend has a URL.
        import shutil

        shutil.copy2(source_video, output_path)
        return {
            "clip_id": req.clip_id,
            "video_with_audio_url": f"/processed/{output_filename}",
            "audio_url": None,
            "sounds_generated": [],
            "warning": (
                "ELEVENLABS_API_KEY is not set. Returning the original video "
                "unmodified so the frontend can be developed. Add the key to "
                "backend/.env to enable real audio generation."
            ),
            "mock": True,
        }

    layers = await generate_audio_layers(
        sounds_needed=req.sounds_needed,
        ambient_type=req.ambient_type,
        mood=req.mood,
        duration_seconds=req.duration_seconds,
        output_dir=str(PROCESSED_DIR),
        clip_id=req.clip_id,
    )

    if not layers["all_files"]:
        raise HTTPException(
            status_code=502,
            detail="ElevenLabs returned no audio for any layer. Check the API key and quota.",
        )

    mixed_audio_path = PROCESSED_DIR / f"{req.clip_id}_mix.mp3"
    await mix_audio_layers(
        layers["all_files"],
        str(mixed_audio_path),
        req.duration_seconds,
    )

    try:
        await overlay_audio_on_video(
            str(source_video),
            str(mixed_audio_path),
            str(output_path),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "clip_id": req.clip_id,
        "video_with_audio_url": f"/processed/{output_filename}",
        "audio_url": f"/processed/{mixed_audio_path.name}",
        "sounds_generated": layers["sounds_generated"],
        "mock": False,
    }
