import asyncio
import base64
import json
import re

import httpx

from app.config import get_settings


GEMINI_MODEL = "gemini-2.5-flash-lite"  # vision-capable, free-tier friendly


async def _post_openai_chat(payload: dict, max_retries: int = 2) -> dict:
    """Dispatcher: route to Gemini or OpenAI based on settings.LLM_PROVIDER.

    Both branches return an OpenAI-shape envelope:
        {"choices": [{"message": {"content": "..."}}]}

    so callers (continuity.py, critic.py, the 3 vision agents) stay unchanged.
    The function name kept as `_post_openai_chat` for backwards compat with
    existing imports — it now dispatches to either provider.
    """
    settings = get_settings()
    provider = (settings.LLM_PROVIDER or "openai").lower()
    if provider == "gemini":
        return await _post_gemini(payload, max_retries=max_retries)
    return await _post_openai_direct(payload, max_retries=max_retries)


async def _post_openai_direct(payload: dict, max_retries: int = 2) -> dict:
    """The original OpenAI client. Same body, retry, and error shape as before."""
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

        if resp.status_code >= 500 and attempt < max_retries:
            await asyncio.sleep(2.0 * (attempt + 1))
            continue

        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        raise RuntimeError(f"OpenAI returned HTTP {resp.status_code}: {msg}")

    raise RuntimeError(
        f"OpenAI request failed after {max_retries + 1} attempts "
        f"(last status: {last_status}, body: {last_body[:200]})"
    )


def _openai_messages_to_gemini(messages: list[dict]) -> tuple[dict | None, list[dict]]:
    """Convert OpenAI-format messages to Gemini's contents + systemInstruction.

    Handles:
    - {"role": "system", "content": "..."}  →  systemInstruction
    - {"role": "user", "content": "..."}     →  contents.parts[0].text
    - {"role": "user", "content": [{"type": "text"}, {"type": "image_url"}]}
        →  parts: [{"text": ...}, {"inline_data": {"mime_type": "...", "data": base64}}]
    """
    system_msg = next((m for m in messages if m.get("role") == "system"), None)
    user_msgs = [m for m in messages if m.get("role") == "user"]

    parts: list[dict] = []
    for um in user_msgs:
        content = um.get("content")
        if isinstance(content, str):
            parts.append({"text": content})
            continue
        if not isinstance(content, list):
            continue
        for item in content:
            t = item.get("type")
            if t == "text":
                parts.append({"text": item.get("text", "")})
            elif t == "image_url":
                url = item.get("image_url", {}).get("url", "")
                if url.startswith("data:"):
                    # data:image/jpeg;base64,/9j/4...
                    header, _, b64 = url.partition(",")
                    mime = "image/jpeg"
                    if ";" in header:
                        mime = header.split(":", 1)[-1].split(";", 1)[0]
                    parts.append(
                        {"inline_data": {"mime_type": mime, "data": b64}}
                    )

    sys_instruction = (
        {"parts": [{"text": system_msg["content"]}]} if system_msg else None
    )
    return sys_instruction, parts


async def _post_gemini(payload: dict, max_retries: int = 2) -> dict:
    """POST to Gemini's generateContent with OpenAI→Gemini conversion + normalize."""
    settings = get_settings()
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not set but LLM_PROVIDER=gemini. "
            "Add it to backend/.env and restart uvicorn."
        )

    sys_instruction, parts = _openai_messages_to_gemini(payload.get("messages", []))
    body: dict = {
        "contents": [{"role": "user", "parts": parts or [{"text": ""}]}],
        "generationConfig": {
            "temperature": payload.get("temperature", 0.3),
            "maxOutputTokens": payload.get("max_tokens", 1000),
            # Gemini natively supports forcing JSON output — more reliable
            # than "Return ONLY JSON" prose in the system prompt.
            "responseMimeType": "application/json",
        },
    }
    if sys_instruction:
        body["systemInstruction"] = sys_instruction

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent"
    )

    last_status = None
    last_body = ""
    for attempt in range(max_retries + 1):
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                headers={
                    "x-goog-api-key": settings.GEMINI_API_KEY,
                    "Content-Type": "application/json",
                },
                json=body,
            )

        if resp.status_code == 200:
            data = resp.json()
            try:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError, TypeError) as e:
                raise RuntimeError(
                    f"Gemini returned an unexpected response shape: {data}"
                ) from e
            # Normalize to OpenAI envelope so callers don't change.
            return {"choices": [{"message": {"content": text}}]}

        last_status = resp.status_code
        last_body = resp.text

        if resp.status_code == 429 and attempt < max_retries:
            await asyncio.sleep(min(15.0 + attempt * 10, 30.0))
            continue
        if resp.status_code >= 500 and attempt < max_retries:
            await asyncio.sleep(2.0 * (attempt + 1))
            continue

        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        raise RuntimeError(
            f"Gemini returned HTTP {resp.status_code}: {msg}"
        )

    raise RuntimeError(
        f"Gemini request failed after {max_retries + 1} attempts "
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


SOUND_DESIGNER_PROMPT = """You are a film sound designer reviewing 3 keyframes from one AI-generated video clip. Your job: identify the TWO most cinematically essential sounds for this clip — sounds the viewer would notice if they were missing.

Return ONLY valid JSON (no markdown, no code blocks):
{
    "sounds_needed": [
        "Two short, concrete foley/SFX descriptions — 5-10 words each, specific enough to render correctly via a text-to-sound API"
    ],
    "ambient_type": "one of: forest, city-street, indoor-room, ocean-beach, mountain, desert, cave, space, underwater, restaurant, office"
}

Rules for sounds_needed:
- Return EXACTLY TWO entries (not three, not five — TWO)
- Each entry must be a single concrete sound event with a noun + qualifier:
  - GOOD: "single car horn honking from middle distance"
  - GOOD: "soft footsteps on wet asphalt, slow pace"
  - GOOD: "glass clink as cup placed on saucer"
  - BAD: "city sounds" (vague)
  - BAD: "background music" (not foley)
  - BAD: "ambient noise" (already covered by ambient_type)
- Prefer DIEGETIC sounds — things visibly happening on screen — over generic atmosphere. The ambient bed handles atmosphere.
- Avoid speech, dialogue, music, or anything copyrighted.

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
