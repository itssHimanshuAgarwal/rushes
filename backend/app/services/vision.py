import asyncio
import base64
import json
import re

import httpx

from app.config import get_settings


async def _post_openai_chat(payload: dict, max_retries: int = 2) -> dict:
    """POST to OpenAI chat/completions with rate-limit-aware retry.

    Raises a runtime error with a human-readable message if non-200 after retries.
    """
    settings = get_settings()
    if not settings.OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to backend/.env and restart uvicorn."
        )

    last_status = None
    last_body = ""
    for attempt in range(max_retries + 1):
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if resp.status_code == 200:
            return resp.json()

        last_status = resp.status_code
        last_body = resp.text

        if resp.status_code == 429:
            wait_s = 20.0
            ra = resp.headers.get("retry-after")
            if ra:
                try:
                    wait_s = float(ra)
                except ValueError:
                    pass
            else:
                m = re.search(r"try again in (\d+(?:\.\d+)?)s", resp.text)
                if m:
                    wait_s = float(m.group(1))
            wait_s = min(max(wait_s, 1.0), 30.0)
            if attempt < max_retries:
                await asyncio.sleep(wait_s + 1.0)
                continue
            try:
                msg = resp.json()["error"]["message"]
            except Exception:
                msg = resp.text
            raise RuntimeError(
                f"OpenAI rate limit hit and exhausted retries. {msg} "
                f"Add a payment method at https://platform.openai.com/account/billing "
                f"to lift the free-tier 3 RPM cap, or press ⌘D in the UI for demo mode."
            )

        # 5xx — one retry with short backoff
        if resp.status_code >= 500 and attempt < max_retries:
            await asyncio.sleep(2.0 * (attempt + 1))
            continue

        # Other non-200 — surface the message immediately
        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        raise RuntimeError(f"OpenAI returned HTTP {resp.status_code}: {msg}")

    raise RuntimeError(
        f"OpenAI request failed after {max_retries + 1} attempts "
        f"(last status: {last_status}, body: {last_body[:200]})"
    )


QUALITY_PROMPT = """You are a film quality-control specialist evaluating AI-generated video clips. You are looking at 3 keyframes from one clip.

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
    "quality_score": 1-100,
    "quality_issues": ["list any visual artifacts, morphing, character drift, or AI generation tells you can see"],
    "color_palette": "dominant colors and overall tone (e.g., 'cool blues and grays with warm amber highlights')"
}

Score guide:
- 90-100: Photorealistic, no artifacts, motion looks smooth between frames
- 70-89: Good quality, minor issues
- 50-69: Noticeable artifacts or inconsistencies
- Below 50: Significant problems

Return ONLY the JSON object."""


SCENE_PROMPT = """You are a film script supervisor analyzing AI-generated video clips. You are looking at 3 keyframes from one clip.

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
    "scene_description": "2-3 sentence description of what is happening in this clip",
    "environment": "specific setting (e.g., 'rain-soaked alley with neon storefronts')",
    "lighting": "description of lighting (e.g., 'warm golden hour sunlight from left', 'harsh overhead fluorescent')",
    "mood": "emotional tone (e.g., 'tense and mysterious', 'peaceful and contemplative')",
    "characters": [
        {"description": "physical appearance details (age, gender, hair, features)", "clothing": "detailed clothing description with colors"}
    ],
    "objects": ["notable", "objects", "in", "scene"]
}

Be specific. Return ONLY the JSON object."""


SOUND_DESIGNER_PROMPT = """You are a film sound designer reviewing AI-generated video clips. You are looking at 3 keyframes from one clip.

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
    "sounds_needed": ["3-5 specific foley and ambient sounds a sound designer would add to this scene"],
    "ambient_type": "one of: forest, city-street, indoor-room, ocean-beach, mountain, desert, cave, space, underwater, restaurant, office"
}

Be SPECIFIC about sounds. Use concrete things like 'footsteps on wet asphalt', 'distant thunder rolling', 'fluorescent light hum', 'car door closing softly'. Avoid vague things like 'background music' or 'ambient sound'. Think about what a viewer would EXPECT to hear in this exact moment.

Return ONLY the JSON object."""


def _frames_as_image_payload(frame_paths: list[str]) -> list[dict]:
    out: list[dict] = []
    for fp in frame_paths:
        with open(fp, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        out.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{b64}",
                    "detail": "low",
                },
            }
        )
    return out


async def _run_vision_agent(
    system_prompt: str, user_text: str, frame_paths: list[str]
) -> dict:
    """One-shot vision call: system prompt + frames → parsed JSON."""
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_text},
                *_frames_as_image_payload(frame_paths),
            ],
        },
    ]
    result = await _post_openai_chat(
        {
            "model": "gpt-4o-mini",
            "messages": messages,
            "max_tokens": 700,
            "temperature": 0.3,
        }
    )
    content = result["choices"][0]["message"]["content"].strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]
    return json.loads(content)


# ---------- Three parallel vision agents (one OpenAI call each) ----------

async def score_quality(frame_paths: list[str], clip_id: str) -> dict:
    return await _run_vision_agent(
        QUALITY_PROMPT,
        f"Score the visual quality of clip '{clip_id}' from these 3 keyframes. Return only JSON.",
        frame_paths,
    )


async def analyze_scene(frame_paths: list[str], clip_id: str) -> dict:
    return await _run_vision_agent(
        SCENE_PROMPT,
        f"Analyze the scene in clip '{clip_id}' from these 3 keyframes. Return only JSON.",
        frame_paths,
    )


async def design_sound(frame_paths: list[str], clip_id: str) -> dict:
    return await _run_vision_agent(
        SOUND_DESIGNER_PROMPT,
        f"Identify the sounds needed for clip '{clip_id}' from these 3 keyframes. Return only JSON.",
        frame_paths,
    )
