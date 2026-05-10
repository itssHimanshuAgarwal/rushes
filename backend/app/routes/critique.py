import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.critic import critique_film
from app.services.events import publish
from app.services.ffmpeg_ops import extract_evenly_spaced_keyframes

router = APIRouter(tags=["critique"])

BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BASE_DIR / "output"
PROCESSED_DIR = BASE_DIR / "processed"


class CritiqueRequest(BaseModel):
    output_url: str  # e.g. "/output/final_xxxx.mp4"
    job_id: str | None = None


def _resolve_output_path(output_url: str) -> Path:
    """Map /output/foo.mp4 → backend/output/foo.mp4"""
    cleaned = output_url.lstrip("/")
    candidate = BASE_DIR / cleaned
    if candidate.exists():
        return candidate
    fallback = OUTPUT_DIR / Path(cleaned).name
    if fallback.exists():
        return fallback
    raise HTTPException(
        status_code=404, detail=f"Assembled video not found: {output_url}"
    )


@router.post("/critique")
async def critique(req: CritiqueRequest) -> dict:
    job = req.job_id or ""
    video_path = _resolve_output_path(req.output_url)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    label = f"critic_{uuid.uuid4().hex[:8]}"

    await publish(job, {"type": "stage", "stage": "critic", "status": "running"})

    try:
        frames = await extract_evenly_spaced_keyframes(
            str(video_path), str(PROCESSED_DIR), label, num_frames=5
        )
        if not frames:
            raise RuntimeError("Could not extract review frames from assembled film.")
        critique_data = await critique_film(frames)
    except Exception as exc:
        await publish(job, {"type": "error", "stage": "critic", "message": str(exc)})
        raise HTTPException(status_code=502, detail=f"Critic failed: {exc}")

    await publish(
        job,
        {
            "type": "stage",
            "stage": "critic",
            "status": "completed",
            "overall_score": critique_data.get("overall_score", 0),
        },
    )

    return critique_data
