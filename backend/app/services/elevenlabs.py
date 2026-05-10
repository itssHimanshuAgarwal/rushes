import asyncio
import os

import httpx

from app.config import get_settings


AMBIENT_DESCRIPTIONS = {
    "forest": "continuous ambient forest atmosphere, gentle wind through trees, distant bird calls, natural outdoor ambience",
    "city-street": "urban city street ambience, distant traffic, footsteps, gentle urban hum, city background noise",
    "indoor-room": "quiet indoor room tone, subtle air conditioning hum, muffled distant sounds, interior ambience",
    "ocean-beach": "ocean waves gently crashing on shore, seagulls in distance, coastal wind, beach ambience",
    "mountain": "mountain wind ambience, vast open space atmosphere, distant eagle cry, high altitude wind",
    "desert": "dry desert wind, vast emptiness ambience, occasional sand movement, arid landscape",
    "cave": "cave dripping water echoes, underground ambience, hollow reverberant space, dark cave atmosphere",
    "space": "deep space ambient drone, subtle electronic hum, vast emptiness, cosmic ambience",
    "underwater": "underwater muffled ambience, bubbles, water pressure, deep ocean sounds",
    "restaurant": "busy restaurant background chatter, clinking glasses, kitchen sounds, indoor dining ambience",
    "office": "quiet office ambience, keyboard typing in distance, air conditioning, office background",
}


async def generate_sound_effect(description: str, duration_seconds: float | None = None) -> bytes:
    """Generate a single sound effect using ElevenLabs Sound Effects API.

    Args:
        description: Natural language description of the sound.
        duration_seconds: Optional duration in seconds (0.5 to 22.0).

    Returns:
        Audio bytes in MP3 format.
    """
    settings = get_settings()

    payload: dict = {
        "text": description,
        "prompt_influence": 0.3,
    }

    if duration_seconds is not None:
        duration_seconds = max(0.5, min(22.0, duration_seconds))
        payload["duration_seconds"] = duration_seconds

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.elevenlabs.io/v1/sound-generation",
            headers={
                "xi-api-key": settings.ELEVENLABS_API_KEY or "",
                "Content-Type": "application/json",
            },
            json=payload,
        )

        if response.status_code != 200:
            print(f"ElevenLabs SFX error: {response.status_code} - {response.text}")
            raise Exception(f"ElevenLabs SFX generation failed: {response.status_code}")

        return response.content


async def generate_audio_layers(
    sounds_needed: list[str],
    ambient_type: str,
    mood: str,
    duration_seconds: float,
    output_dir: str,
    clip_id: str,
) -> dict:
    """Generate all audio layers for a clip: foley sounds + ambient bed."""
    os.makedirs(output_dir, exist_ok=True)

    generated_files: list[str] = []

    # Limit to 2 SFX (was 3): a busier mix amplifies any single
    # mis-synthesized sound. Two well-placed accents over the ambient bed
    # reads as intentional sound design.
    sfx_tasks = [
        generate_sound_effect(
            description=sound_desc,
            duration_seconds=min(duration_seconds, 10.0),
        )
        for sound_desc in sounds_needed[:2]
    ]

    sfx_results = await asyncio.gather(*sfx_tasks, return_exceptions=True)

    successful_sfx_descriptions: list[str] = []
    for i, result in enumerate(sfx_results):
        if isinstance(result, Exception):
            print(f"SFX generation failed for sound {i}: {result}")
            continue
        sfx_path = os.path.join(output_dir, f"{clip_id}_sfx_{i}.mp3")
        with open(sfx_path, "wb") as f:
            f.write(result)
        generated_files.append(sfx_path)
        successful_sfx_descriptions.append(sounds_needed[i])

    ambient_desc = AMBIENT_DESCRIPTIONS.get(
        ambient_type,
        f"ambient background atmosphere for {ambient_type} environment, continuous, {mood} mood",
    )

    ambient_path: str | None = None
    try:
        ambient_audio = await generate_sound_effect(
            description=ambient_desc,
            duration_seconds=min(duration_seconds, 22.0),
        )
        ambient_path = os.path.join(output_dir, f"{clip_id}_ambient.mp3")
        with open(ambient_path, "wb") as f:
            f.write(ambient_audio)
        generated_files.append(ambient_path)
    except Exception as e:
        print(f"Ambient generation failed: {e}")
        ambient_path = None

    return {
        "sfx_files": [f for f in generated_files if "_sfx_" in f],
        "ambient_file": ambient_path,
        "all_files": generated_files,
        "sounds_generated": successful_sfx_descriptions
        + ([ambient_desc] if ambient_path else []),
    }
