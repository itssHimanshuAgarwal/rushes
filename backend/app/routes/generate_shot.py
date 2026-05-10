import os
import uuid
from pathlib import Path
from typing import Literal

import aiofiles
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.events import publish
from app.services.ffmpeg_ops import (
    extract_thumbnail,
    get_video_metadata,
    render_ken_burns_clip,
)
from app.services.runware import download, text_to_image, text_to_video

router = APIRouter(tags=["generate-shot"])

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"


class GenerateShotRequest(BaseModel):
    prompt: str
    mode: Literal["image", "video"] = "image"
    description: str | None = None  # optional human label for the missing shot
    job_id: str | None = None


@router.post("/generate-shot")
async def generate_shot(req: GenerateShotRequest) -> dict:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    job = req.job_id or ""
    clip_id = uuid.uuid4().hex
    saved_filename = f"{clip_id}.mp4"
    saved_path = UPLOADS_DIR / saved_filename

    # Friendlier filename for the UI
    label = (req.description or "missing-shot").strip()[:40]
    safe_label = "".join(c if c.isalnum() else "_" for c in label).strip("_") or "missing"
    display_filename = f"{safe_label.upper()}_v1.mp4"

    try:
        if req.mode == "image":
            await publish(
                job,
                {"type": "shot_progress", "stage": "image", "status": "running", "mode": "image"},
            )
            image_url = await text_to_image(req.prompt)
            image_bytes = await download(image_url)
            still_path = PROCESSED_DIR / f"{clip_id}_still.jpg"
            async with aiofiles.open(still_path, "wb") as f:
                await f.write(image_bytes)
            await publish(
                job, {"type": "shot_progress", "stage": "image", "status": "completed"}
            )

            await publish(
                job,
                {"type": "shot_progress", "stage": "render", "status": "running"},
            )
            await render_ken_burns_clip(
                str(still_path), str(saved_path), duration_seconds=4.0
            )
            await publish(
                job, {"type": "shot_progress", "stage": "render", "status": "completed"}
            )

        elif req.mode == "video":
            await publish(
                job,
                {"type": "shot_progress", "stage": "submit", "status": "running", "mode": "video"},
            )

            async def on_progress(elapsed: int):
                await publish(
                    job,
                    {"type": "shot_progress", "stage": "render", "status": "running", "elapsed": elapsed},
                )

            video_url = await text_to_video(req.prompt, on_progress=on_progress)
            await publish(
                job, {"type": "shot_progress", "stage": "render", "status": "completed"}
            )

            video_bytes = await download(video_url)
            async with aiofiles.open(saved_path, "wb") as f:
                await f.write(video_bytes)

        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {req.mode}")

    except Exception as exc:
        await publish(job, {"type": "shot_error", "message": str(exc)})
        # Cleanup partial files
        if saved_path.exists():
            try:
                saved_path.unlink()
            except OSError:
                pass
        raise HTTPException(
            status_code=502, detail=f"Generation failed: {exc}"
        )

    # Probe the saved clip + render a thumbnail for the dashboard
    metadata = await get_video_metadata(str(saved_path))
    thumb_path = await extract_thumbnail(str(saved_path), str(PROCESSED_DIR), clip_id)

    clip = {
        "clip_id": clip_id,
        "filename": display_filename,
        "duration": metadata["duration"],
        "resolution": metadata["resolution"],
        "has_audio": metadata["has_audio"],
        "scene_description": req.description or req.prompt[:140],
        "environment": "AI-generated",
        "lighting": "matched to prompt",
        "mood": "generated",
        "characters": [],
        "objects": [],
        "sounds_needed": [],
        "ambient_type": "indoor-room",
        "quality_score": 80 if req.mode == "video" else 70,
        "quality_issues": (
            []
            if req.mode == "video"
            else ["still-image based — synthetic motion only"]
        ),
        "color_palette": "matched to prompt",
        "thumbnail_url": f"/processed/{os.path.basename(thumb_path)}",
        "video_url": f"/uploads/{saved_filename}",
        "generated": True,
        "generation_mode": req.mode,
    }
    await publish(job, {"type": "shot_done", "clip": clip})
    return clip
