import json

from app.services.vision import _post_openai_chat


SYSTEM_PROMPT = """You are an expert script supervisor for film production. You are reviewing AI-generated clips that are meant to be assembled into one short film.

Your job is to:
1. Identify continuity breaks between clips (clothing changes, environment mismatches, lighting inconsistencies, character appearance changes)
2. Identify missing shots that would make the sequence feel complete (establishing shots, close-ups, transitions)
3. Suggest an optimal assembly order for the clips

Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
    "continuity_breaks": [
        {
            "clip_a": 0,
            "clip_b": 2,
            "issue": "Clear description of the continuity problem",
            "severity": "high"
        }
    ],
    "missing_shots": [
        {
            "description": "What type of shot is missing and why it matters",
            "suggested_prompt": "A ready-to-use text prompt to generate this missing shot using an AI video tool like Runway or Kling"
        }
    ],
    "suggested_order": ["clip_id_1", "clip_id_3", "clip_id_2"],
    "overall_coherence_score": 65
}

Be genuinely critical. Find at least 1 continuity break if one exists. Suggest at least 1 missing shot. The coherence score should reflect how well these clips would work as one film (0-100).

If clips have very different environments or characters, that's a major coherence issue. If lighting or color palette shifts dramatically between clips that should be in the same scene, flag it.

Return ONLY the JSON object."""


async def check_continuity(clip_analyses: list[dict]) -> dict:
    """Compare all clip analyses to find continuity breaks and missing shots."""
    analyses_text = json.dumps(clip_analyses, indent=2)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Here are the analyses of {len(clip_analyses)} clips. "
                f"Review them for continuity and coherence:\n\n{analyses_text}"
            ),
        },
    ]

    result = await _post_openai_chat(
        {
            "model": "gpt-4o-mini",
            "messages": messages,
            "max_tokens": 1500,
            "temperature": 0.3,
        }
    )
    content = result["choices"][0]["message"]["content"].strip()

    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]

    return json.loads(content)
