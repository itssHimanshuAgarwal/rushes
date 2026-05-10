"""Lightweight in-memory pub-sub for SSE progress events.

Each job_id has zero or more subscribers (asyncio.Queue). The analyze pipeline
publishes per-stage events; an SSE route subscribes a queue and streams events
to the browser. No external broker; this only works for single-process uvicorn
(which is what we run).
"""

import asyncio
import json
from collections import defaultdict
from typing import AsyncIterator


_queues: dict[str, list[asyncio.Queue]] = defaultdict(list)


async def publish(job_id: str, event: dict) -> None:
    """Fan out an event to every subscriber of this job_id."""
    if not job_id:
        return
    for q in list(_queues.get(job_id, [])):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            # If a subscriber is slow, drop the event rather than blocking.
            pass


async def subscribe(job_id: str) -> AsyncIterator[dict]:
    """Yield events as they arrive. Closes when a `done` or `error` event arrives."""
    q: asyncio.Queue[dict] = asyncio.Queue(maxsize=200)
    _queues[job_id].append(q)
    try:
        while True:
            try:
                ev = await asyncio.wait_for(q.get(), timeout=120.0)
            except asyncio.TimeoutError:
                # Idle keepalive — emit a comment-only line so the connection stays open.
                yield {"type": "ping"}
                continue
            yield ev
            if ev.get("type") in ("done", "error"):
                break
    finally:
        try:
            _queues[job_id].remove(q)
        except ValueError:
            pass
        if not _queues[job_id]:
            _queues.pop(job_id, None)


def encode_sse(event: dict) -> bytes:
    """Encode a dict as an SSE `data:` payload."""
    return f"data: {json.dumps(event)}\n\n".encode("utf-8")
