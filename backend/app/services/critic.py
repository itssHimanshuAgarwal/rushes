"""Critic Agent: reviews the final assembled film and returns scored critique
+ actionable improvement suggestions. This is what makes the system agentic —
it creates a feedback loop where the agent evaluates other agents' output.
"""

import base64
import json

from app.services.vision import _post_openai_chat


CRITIC_SYSTEM_PROMPT = """You are a harsh but constructive film critic and director reviewing an assembled AI-generated short film. You are looking at 5 frames evenly spaced across the final edit.

Evaluate the assembled film and return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "overall_score": 1-100,
  "verdict": "one sentence overall assessment",
  "audio_quality": {
    "score": 1-100,
    "notes": "assessment of sound design coherence (you cannot hear, but infer from visual cues whether the sound design seems appropriate to the scenes)"
  },
  "visual_continuity": {
    "score": 1-100,
    "notes": "assessment of visual consistency across scenes — wardrobe, lighting, environment"
  },
  "pacing": {
    "score": 1-100,
    "notes": "assessment of scene transitions and rhythm based on what changes between frames"
  },
  "mood_coherence": {
    "score": 1-100,
    "notes": "does the film feel like one unified piece"
  },
  "improvements": [
    {
      "type": "audio" | "visual" | "pacing" | "mood",
      "description": "specific actionable improvement",
      "agent_to_rerun": "sound-design" | "music" | "assembly" | "none",
      "new_instruction": "specific instruction for that agent if it reruns"
    }
  ]
}

Return AT LEAST 2 improvements. Be genuinely harsh — find real problems. Score below 70 if there are clear issues. The improvements list should be concrete and actionable, not vague critique. Each improvement MUST map to one of: sound-design, music, assembly, or none.

Return ONLY the JSON object."""


async def critique_film(frame_paths: list[str]) -> dict:
    """Send 5 evenly-spaced frames of the assembled film to the critic LLM."""
    if not frame_paths:
        raise RuntimeError("No frames provided to critic.")

    image_contents = []
    for fp in frame_paths:
        with open(fp, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        image_contents.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{b64}",
                    "detail": "low",
                },
            }
        )

    messages = [
        {"role": "system", "content": CRITIC_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"You are reviewing an assembled film. {len(frame_paths)} "
                        "frames are attached, evenly spaced from start to end. "
                        "Return only JSON."
                    ),
                },
                *image_contents,
            ],
        },
    ]

    result = await _post_openai_chat(
        {
            "model": "gpt-4o-mini",
            "messages": messages,
            "max_tokens": 1500,
            "temperature": 0.4,
        }
    )
    content = result["choices"][0]["message"]["content"].strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]
    return json.loads(content)
