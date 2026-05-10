import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ffmpeg_ops import (
    assemble_clips,
    get_video_metadata,
    normalize_audio,
    overlay_music_bed,
)

router = APIRouter(tags=["assemble"])

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"
OUTPUT_DIR = BASE_DIR / "output"


class AssembleRequest(BaseModel):
    clip_ids: list[str] = Field(..., min_length=1)
    music_url: Optional[str] = None
    crossfade_seconds: float = 0.5


@router.get("/assemble/ping")
async def ping() -> dict[str, str]:
    return {"route": "assemble", "status": "ok"}


def _resolve_clip_source(clip_id: str) -> Path:
    """Prefer the with-audio version in processed/, fall back to uploads/."""
    processed = PROCESSED_DIR / f"{clip_id}_with_audio.mp4"
    if processed.exists():
        return processed
    matches = sorted(UPLOADS_DIR.glob(f"{clip_id}.*"))
    if matches:
        return matches[0]
    raise HTTPException(
        status_code=404, detail=f"No video found for clip_id={clip_id}"
    )


def _resolve_music_path(music_url: str) -> Path:
    """Map a URL like /output/music_xxx.mp3 to a filesystem path."""
    cleaned = music_url.lstrip("/")
    candidate = BASE_DIR / cleaned
    if candidate.exists():
        return candidate
    # fall back: filename only, look in output/
    filename = Path(cleaned).name
    fallback = OUTPUT_DIR / filename
    if fallback.exists():
        return fallback
    raise HTTPException(
        status_code=404, detail=f"Music file not found for url={music_url}"
    )


@router.post("/assemble")
async def assemble(req: AssembleRequest) -> dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    sources = [_resolve_clip_source(cid) for cid in req.clip_ids]

    normalized_paths: list[str] = []
    for i, src in enumerate(sources):
        norm_path = PROCESSED_DIR / f"{req.clip_ids[i]}_loudnorm.mp4"
        await normalize_audio(str(src), str(norm_path))
        normalized_paths.append(str(norm_path))

    job_id = uuid.uuid4().hex
    assembled_path = OUTPUT_DIR / f"assembled_{job_id}.mp4"
    try:
        await assemble_clips(
            normalized_paths, str(assembled_path), req.crossfade_seconds
        )
    except Exception as exc:
        for p in normalized_paths:
            Path(p).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Assembly failed: {exc}")

    if not assembled_path.exists() or assembled_path.stat().st_size == 0:
        for p in normalized_paths:
            Path(p).unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=(
                "Assembly produced an empty file. This usually means the source "
                "clips have incompatible formats. Try re-uploading or use ⌘D demo mode."
            ),
        )

    final_path = assembled_path
    music_status: Optional[str] = None
    if req.music_url:
        music_path = _resolve_music_path(req.music_url)
        with_music_path = OUTPUT_DIR / f"final_{job_id}.mp4"
        await overlay_music_bed(
            str(assembled_path), str(music_path), str(with_music_path)
        )
        if with_music_path.exists() and with_music_path.stat().st_size > 0:
            final_path = with_music_path
            music_status = "applied"
        else:
            music_status = "failed"

    for p in normalized_paths:
        try:
            Path(p).unlink(missing_ok=True)
        except OSError:
            pass

    final_meta = await get_video_metadata(str(final_path))

    return {
        "output_url": f"/output/{final_path.name}",
        "duration": final_meta["duration"],
        "clips_used": len(req.clip_ids),
        "music_applied": music_status == "applied",
        "music_status": music_status,
    }
