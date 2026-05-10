"""Runware integration: text-to-image (synchronous) and text-to-video (async polling)."""

import asyncio
import uuid
from typing import Awaitable, Callable

import httpx

from app.config import get_settings


RUNWARE_URL = "https://api.runware.ai/v1"

# Conservative defaults — multiples of 64 are required for image, fixed sizes for video.
IMAGE_WIDTH = 1024
IMAGE_HEIGHT = 576  # 16:9
IMAGE_MODEL = "runware:101@1"  # FLUX-Schnell, ~2-5s

VIDEO_MODEL = "klingai:6@1"  # Kling 2.5, ~100s for 5s video at 1080p (was Kling 2.1 Master ~165s)
VIDEO_WIDTH = 1920
VIDEO_HEIGHT = 1080
VIDEO_DURATION_SECONDS = 5


def _auth_headers() -> dict:
    settings = get_settings()
    if not settings.RUNWARE_API_KEY:
        raise RuntimeError(
            "RUNWARE_API_KEY is not set. Add it to backend/.env and restart uvicorn."
        )
    return {
        "Authorization": f"Bearer {settings.RUNWARE_API_KEY}",
        "Content-Type": "application/json",
    }


async def text_to_image(prompt: str) -> str:
    """Synchronous text-to-image. Returns the image URL on success."""
    task_uuid = str(uuid.uuid4())
    body = [
        {
            "taskType": "imageInference",
            "taskUUID": task_uuid,
            "positivePrompt": prompt,
            "model": IMAGE_MODEL,
            "width": IMAGE_WIDTH,
            "height": IMAGE_HEIGHT,
            "steps": 4,
            "numberResults": 1,
            "outputType": "URL",
            "outputFormat": "JPEG",
        }
    ]
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(RUNWARE_URL, headers=_auth_headers(), json=body)
    if r.status_code != 200:
        raise RuntimeError(f"Runware image error HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    if data.get("errors"):
        raise RuntimeError(f"Runware image error: {data['errors'][0].get('message', data)}")
    items = data.get("data", [])
    if not items or not items[0].get("imageURL"):
        raise RuntimeError(f"Runware image returned no URL: {data}")
    return items[0]["imageURL"]


async def text_to_video(
    prompt: str,
    on_progress: Callable[[int], Awaitable[None]] | None = None,
    poll_interval: float = 5.0,
    timeout_seconds: float = 360.0,
) -> str:
    """Async text-to-video via submit + getResponse polling.

    Calls `on_progress(elapsed_seconds)` every `poll_interval` while waiting.
    Raises RuntimeError on timeout or upstream error.
    """
    task_uuid = str(uuid.uuid4())

    # Submit
    submit_body = [
        {
            "taskType": "videoInference",
            "taskUUID": task_uuid,
            "positivePrompt": prompt,
            "model": VIDEO_MODEL,
            "duration": VIDEO_DURATION_SECONDS,
            "width": VIDEO_WIDTH,
            "height": VIDEO_HEIGHT,
            "outputType": "URL",
            "outputFormat": "MP4",
            "numberResults": 1,
        }
    ]
    async with httpx.AsyncClient(timeout=30.0) as client:
        sub = await client.post(RUNWARE_URL, headers=_auth_headers(), json=submit_body)
    if sub.status_code != 200:
        raise RuntimeError(f"Runware video submit HTTP {sub.status_code}: {sub.text[:400]}")
    sub_json = sub.json()
    if sub_json.get("errors"):
        raise RuntimeError(
            f"Runware video submit error: {sub_json['errors'][0].get('message', sub_json)}"
        )

    # Poll
    deadline = asyncio.get_event_loop().time() + timeout_seconds
    elapsed = 0
    while asyncio.get_event_loop().time() < deadline:
        await asyncio.sleep(poll_interval)
        elapsed += int(poll_interval)
        if on_progress:
            try:
                await on_progress(elapsed)
            except Exception:
                pass
        async with httpx.AsyncClient(timeout=30.0) as client:
            poll = await client.post(
                RUNWARE_URL,
                headers=_auth_headers(),
                json=[{"taskType": "getResponse", "taskUUID": task_uuid}],
            )
        if poll.status_code != 200:
            continue
        body = poll.json()
        for item in body.get("data", []) or []:
            status = item.get("status")
            video_url = item.get("videoURL")
            if status == "success" and video_url:
                return video_url
            if status in ("failed", "error"):
                raise RuntimeError(
                    f"Runware video task failed: {item.get('error', item)}"
                )
    raise RuntimeError(
        f"Runware video timed out after {int(timeout_seconds)}s. "
        f"Try image mode for a faster fallback."
    )


async def download(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.get(url)
    if r.status_code != 200:
        raise RuntimeError(f"Download failed HTTP {r.status_code}: {url}")
    return r.content
