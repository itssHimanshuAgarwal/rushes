from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.events import encode_sse, subscribe

router = APIRouter(tags=["events"])


@router.get("/events/{job_id}")
async def events_stream(job_id: str) -> StreamingResponse:
    """SSE stream of pipeline progress events for a given job_id.

    The frontend opens `new EventSource('/api/events/' + jobId)` BEFORE calling
    /api/analyze, so events fired during the analysis are caught.
    """

    async def gen():
        # Initial comment line keeps the connection alive while clients connect.
        yield b": rushes-events-stream\n\n"
        async for ev in subscribe(job_id):
            if ev.get("type") == "ping":
                yield b": ping\n\n"
                continue
            yield encode_sse(ev)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # disable nginx buffering if proxied
            "Connection": "keep-alive",
        },
    )
