import asyncio
import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.continuity import check_continuity
from app.services.events import publish
from app.services.ffmpeg_ops import (
    extract_keyframes,
    extract_thumbnail,
    get_video_metadata,
)
from app.services.vision import analyze_scene, design_sound, score_quality

router = APIRouter(prefix="/analyze", tags=["analyze"])

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOADS_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"


@router.get("/ping")
async def ping() -> dict[str, str]:
    return {"route": "analyze", "status": "ok"}


@router.post("")
async def analyze_clips(
    files: list[UploadFile] = File(...),
    job_id: str | None = Form(default=None),
) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    job = job_id or ""
    total = len(files)

    # ---------- Stage 1: upload (stream files to disk) ----------
    await publish(job, {"type": "stage", "stage": "upload", "status": "running", "total": total})
    saved: list[tuple[str, str, Path]] = []  # (clip_id, original_name, saved_path)
    for i, upload in enumerate(files):
        clip_id = uuid.uuid4().hex
        original_name = upload.filename or "clip.mp4"
        ext = os.path.splitext(original_name)[1] or ".mp4"
        saved_filename = f"{clip_id}{ext}"
        saved_path = UPLOADS_DIR / saved_filename
        async with aiofiles.open(saved_path, "wb") as out_file:
            while chunk := await upload.read(1024 * 1024):
                await out_file.write(chunk)
        await upload.close()
        saved.append((clip_id, original_name, saved_path))
        await publish(
            job,
            {"type": "clip_upload_done", "clip_index": i, "total": total, "filename": original_name},
        )
    await publish(job, {"type": "stage", "stage": "upload", "status": "completed", "total": total})

    # ---------- Stage 2: frames (ffmpeg keyframes + thumbnails) ----------
    await publish(job, {"type": "stage", "stage": "frames", "status": "running", "total": total})
    extracted: list[tuple[str, str, Path, dict, list[str], str]] = []
    # (clip_id, original_name, saved_path, metadata, frame_paths, thumbnail_path)
    for i, (clip_id, original_name, saved_path) in enumerate(saved):
        try:
            metadata = await get_video_metadata(str(saved_path))
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"Failed to probe '{original_name}': {exc}"
            )
        frame_paths = await extract_keyframes(str(saved_path), str(PROCESSED_DIR), clip_id)
        thumbnail_path = await extract_thumbnail(str(saved_path), str(PROCESSED_DIR), clip_id)
        if not frame_paths:
            raise HTTPException(
                status_code=400, detail=f"Could not extract keyframes from '{original_name}'"
            )
        extracted.append((clip_id, original_name, saved_path, metadata, frame_paths, thumbnail_path))
        await publish(
            job,
            {"type": "clip_frames_done", "clip_index": i, "total": total, "filename": original_name},
        )
    await publish(job, {"type": "stage", "stage": "frames", "status": "completed", "total": total})

    # ---------- Stage 3: three parallel vision AGENTS per clip ----------
    # Each clip fires THREE concurrent OpenAI calls: Quality Scorer + Scene
    # Analyzer + Sound Designer. Each agent publishes its OWN per-clip done
    # event the instant its call returns (not when gather() finishes), so the
    # three pipeline nodes each have real, independent network latency.
    await publish(job, {"type": "stage", "stage": "quality", "status": "running", "total": total})
    await publish(job, {"type": "stage", "stage": "scene", "status": "running", "total": total})
    await publish(job, {"type": "stage", "stage": "audio-detect", "status": "running", "total": total})

    clip_results: list[dict] = []
    for i, (clip_id, original_name, saved_path, metadata, frame_paths, thumbnail_path) in enumerate(extracted):
        # Run each agent sequentially per clip. This gives each pipeline node
        # a clean solo "running" window on the graph (no overlapping work) and
        # avoids OpenAI burst-rate retries. Per clip: ~9-12s real wall time.
        async def _run_agent(name, fn, extra=None):
            try:
                data = await fn(frame_paths, clip_id)
            except Exception as exc:
                print(f"agent {name} failed for {original_name}: {exc}")
                data = {}
            event = {
                "type": "agent_done",
                "agent": name,
                "clip_index": i,
                "total": total,
                "filename": original_name,
            }
            if extra:
                event.update({k: data.get(k, v) for k, v in extra.items()})
            await publish(job, event)
            return data

        quality_data = await _run_agent("quality", score_quality, {"quality_score": 0})
        scene_data = await _run_agent("scene", analyze_scene, None)
        sound_data = await _run_agent(
            "audio-detect",
            design_sound,
            {"has_audio": metadata["has_audio"]},
        )

        saved_filename = saved_path.name
        clip_payload = {
            "clip_id": clip_id,
            "filename": original_name,
            "duration": metadata["duration"],
            "resolution": metadata["resolution"],
            "has_audio": metadata["has_audio"],
            # Quality Scorer agent
            "quality_score": quality_data.get("quality_score", 0),
            "quality_issues": quality_data.get("quality_issues", []),
            "color_palette": quality_data.get("color_palette", ""),
            # Scene Analyzer agent
            "scene_description": scene_data.get("scene_description", ""),
            "environment": scene_data.get("environment", ""),
            "lighting": scene_data.get("lighting", ""),
            "mood": scene_data.get("mood", ""),
            "characters": scene_data.get("characters", []),
            "objects": scene_data.get("objects", []),
            # Sound Designer agent
            "sounds_needed": sound_data.get("sounds_needed", []),
            "ambient_type": sound_data.get("ambient_type", ""),
            "thumbnail_url": f"/processed/{os.path.basename(thumbnail_path)}",
            "video_url": f"/uploads/{saved_filename}",
        }
        clip_results.append(clip_payload)

    await publish(job, {"type": "stage", "stage": "quality", "status": "completed", "total": total})
    await publish(job, {"type": "stage", "stage": "scene", "status": "completed", "total": total})
    await publish(job, {"type": "stage", "stage": "audio-detect", "status": "completed", "total": total})

    # ---------- Stage 4: continuity (cross-clip LLM call) ----------
    await publish(job, {"type": "stage", "stage": "continuity", "status": "running", "total": total})
    continuity_input = [
        {
            "clip_id": c["clip_id"],
            "filename": c["filename"],
            "scene_description": c["scene_description"],
            "environment": c["environment"],
            "lighting": c["lighting"],
            "mood": c["mood"],
            "characters": c["characters"],
            "objects": c["objects"],
            "ambient_type": c["ambient_type"],
            "color_palette": c["color_palette"],
        }
        for c in clip_results
    ]
    try:
        continuity_data = await check_continuity(continuity_input)
    except Exception as exc:
        await publish(job, {"type": "error", "message": str(exc)})
        raise HTTPException(status_code=502, detail=f"Continuity analysis failed: {exc}")

    await publish(
        job,
        {
            "type": "stage",
            "stage": "continuity",
            "status": "completed",
            "breaks": len(continuity_data.get("continuity_breaks", [])),
            "missing": len(continuity_data.get("missing_shots", [])),
            "score": continuity_data.get("overall_coherence_score", 0),
        },
    )
    await publish(job, {"type": "done"})

    return {
        "clips": clip_results,
        "continuity_breaks": continuity_data.get("continuity_breaks", []),
        "missing_shots": continuity_data.get("missing_shots", []),
        "suggested_order": continuity_data.get(
            "suggested_order", [c["clip_id"] for c in clip_results]
        ),
        "overall_coherence_score": continuity_data.get("overall_coherence_score", 0),
    }
