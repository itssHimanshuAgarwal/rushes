import json

from app.services.vision import _post_openai_chat


SYSTEM_PROMPT = """You are an expert script supervisor for film production. You are reviewing AI-generated clips that are meant to be assembled into one short film.

Your job is to:
1. Identify continuity breaks between clips (clothing changes, environment mismatches, lighting inconsistencies, character appearance changes)
2. For EACH continuity break, propose a concrete fix: which clip is the anchor (ground truth), which clip needs to be regenerated, and a ready-to-use video-generation prompt that fixes the break.
3. Identify missing shots that would make the sequence feel complete (establishing shots, close-ups, transitions)
4. Suggest an optimal assembly order for the clips

Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
    "continuity_breaks": [
        {
            "clip_a": 0,
            "clip_b": 2,
            "issue": "Clear description of the continuity problem",
            "severity": "high",
            "anchor_clip_id": "<the clip_id of the clip treated as ground truth — usually the earlier clip in the sequence>",
            "fix_clip_id": "<the clip_id of the clip that should be regenerated to match the anchor>",
            "corrected_prompt": "A self-contained text-to-video prompt that re-describes the fix_clip's scene but adjusts ONLY the continuity-breaking element to match the anchor. Keep the same camera angle, framing, lighting style, environment, mood, and characters EXCEPT for the specific element being corrected. Phrase as a clean prompt (no JSON, no explanations, just the prompt a filmmaker would paste into Kling or Runway)."
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

Rules for continuity break fixes:
- anchor_clip_id should be the EARLIER clip in narrative order (the one that established the precedent)
- fix_clip_id should be the LATER clip (the one that drifted away)
- corrected_prompt should be ~2-3 sentences, cinematic, ready to paste into a video gen tool. Re-describe the fix_clip's scene with the corrected element. Example for a wardrobe break: "A medium shot of the same man from the previous scene stepping through a backlit doorway. He wears a long black wool overcoat with a charcoal scarf — exactly matching the wardrobe of the establishing shot. Warm amber light spills onto his face from the door behind him. 35mm anamorphic, cinematic noir."
- Do NOT include any words like "anchor", "fix", "regenerate" in corrected_prompt — it's a prompt for an AI video tool, not a description of what we're doing.

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
