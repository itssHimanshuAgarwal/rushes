import json
import os
import re
import shutil
import subprocess

# Anything quieter than this counts as effectively silent. Real recordings sit
# in -3 to -25 dB; digital silence is at -91 dB; muted tracks read -inf.
SILENCE_THRESHOLD_DB = -50.0


def _measure_audio_max_db(video_path: str, sample_seconds: int = 30) -> float:
    """Returns max_volume in dB across the first `sample_seconds`.

    Returns float('-inf') when ffmpeg can't read audio at all. Used to
    distinguish "has an audio stream" from "actually has audible audio".
    """
    cmd = [
        "ffmpeg",
        "-t", str(sample_seconds),
        "-i", video_path,
        "-af", "volumedetect",
        "-vn", "-sn",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stderr or ""
    m = re.search(r"max_volume:\s*([-\d.]+)\s*dB", output)
    if m:
        return float(m.group(1))
    # No max_volume in output → either no audio stream reached the filter,
    # or it was -inf (totally silent). Treat as silent.
    return float("-inf")


async def get_video_metadata(video_path: str) -> dict:
    """Use ffprobe to extract duration, resolution, has_audio, codec."""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    probe_data = json.loads(result.stdout) if result.stdout else {}

    streams = probe_data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    duration = float(probe_data.get("format", {}).get("duration", 0) or 0)
    width = int(video_stream.get("width", 0)) if video_stream else 0
    height = int(video_stream.get("height", 0)) if video_stream else 0

    # has_audio = audio stream exists AND it's actually audible. A stream that's
    # all digital silence (max_volume <= -50dB) reads as silent so we generate
    # sound design for it during Make Coherent.
    has_audio = False
    audio_max_db: float | None = None
    if audio_stream is not None:
        audio_max_db = _measure_audio_max_db(video_path)
        has_audio = audio_max_db > SILENCE_THRESHOLD_DB

    return {
        "duration": duration,
        "resolution": f"{width}x{height}",
        "width": width,
        "height": height,
        "has_audio": has_audio,
        "audio_max_db": audio_max_db,
        "codec": video_stream.get("codec_name", "unknown") if video_stream else "unknown",
    }


async def extract_keyframes(
    video_path: str,
    output_dir: str,
    clip_id: str,
    num_frames: int = 3,
) -> list[str]:
    """Extract keyframes from start, middle, and end of video."""
    metadata = await get_video_metadata(video_path)
    duration = metadata["duration"] or 1.0

    timestamps = [duration * 0.1, duration * 0.5, duration * 0.9]
    frame_paths: list[str] = []

    for i, ts in enumerate(timestamps):
        output_path = os.path.join(output_dir, f"{clip_id}_frame_{i}.jpg")
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(ts),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            output_path,
        ]
        subprocess.run(cmd, capture_output=True)
        if os.path.exists(output_path):
            frame_paths.append(output_path)

    return frame_paths


async def extract_thumbnail(video_path: str, output_dir: str, clip_id: str) -> str:
    """Extract a single thumbnail for the clip card."""
    output_path = os.path.join(output_dir, f"{clip_id}_thumb.jpg")
    cmd = [
        "ffmpeg", "-y",
        "-ss", "0.5",
        "-i", video_path,
        "-vframes", "1",
        "-vf", "scale=320:-1",
        "-q:v", "3",
        output_path,
    ]
    subprocess.run(cmd, capture_output=True)
    return output_path


async def mix_audio_layers(
    audio_files: list[str], output_path: str, duration: float
) -> str | None:
    """Mix multiple audio files into one. Ambient gets lower volume; SFX get higher."""
    if not audio_files:
        return None

    if len(audio_files) == 1:
        shutil.copy2(audio_files[0], output_path)
        return output_path

    inputs: list[str] = []
    filter_parts: list[str] = []

    for i, audio_file in enumerate(audio_files):
        inputs.extend(["-i", audio_file])
        # Quieter, more atmospheric mix. Was SFX 0.7 / ambient 0.25 — too
        # aggressive when ElevenLabs misinterpreted a sound prompt. Now SFX
        # 0.45 / ambient 0.18 so the bed sets tone and SFX accent gently.
        if "_ambient" in audio_file:
            filter_parts.append(f"[{i}]volume=0.18[a{i}]")
        else:
            filter_parts.append(f"[{i}]volume=0.45[a{i}]")

    mix_inputs = "".join(f"[a{i}]" for i in range(len(audio_files)))
    filter_complex = (
        ";".join(filter_parts)
        + f";{mix_inputs}amix=inputs={len(audio_files)}:duration=longest:dropout_transition=2[out]"
    )

    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-t", str(duration),
        "-ac", "2",
        "-ar", "44100",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Audio mix error: {result.stderr}")
        shutil.copy2(audio_files[0], output_path)

    return output_path


async def overlay_audio_on_video(
    video_path: str, audio_path: str, output_path: str
) -> str:
    """Overlay generated audio mix onto a video file (replacing or adding audio)."""
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Audio overlay error: {result.stderr}")
        raise Exception(f"Failed to overlay audio: {result.stderr}")

    return output_path


def _normalize_to_canonical(input_path: str, output_path: str) -> bool:
    """Re-encode any clip to canonical 1280x720@30fps + aac stereo 44.1kHz.

    This ensures every clip in an assembly has matching dimensions, framerate,
    and audio format — required for xfade/acrossfade and concat-demuxer.
    Returns True on success, False on failure.
    """
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p",
        "-vf",
        "scale=1280:720:force_original_aspect_ratio=decrease,"
        "pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1",
        "-r", "30",
        "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "192k",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"normalize error for {input_path}:\n{result.stderr[-1500:]}")
        return False
    return True


async def assemble_clips(
    clip_paths: list[str], output_path: str, crossfade: float = 0.0
) -> str:
    """Assemble clips into one video with hard cuts (filmmaker-standard).

    Was using xfade for the 2-clip case which produced a 0.5–1s dark blend
    when adjacent clips had dark intros/outros (AI clips often do). Now
    every assembly uses the concat-demuxer regardless of clip count, with
    a brief fade-in at the very start and fade-out at the very end of the
    finished film for that "lights up / curtain falls" cinema feel.

    The `crossfade` parameter is kept for API compatibility but ignored.
    """
    del crossfade  # accepted for backwards compat, no longer used

    if len(clip_paths) == 1:
        shutil.copy2(clip_paths[0], output_path)
        return output_path

    # Normalize every clip to a common format so concat works cleanly
    normalized_clips: list[str] = []
    for i, clip in enumerate(clip_paths):
        norm_path = os.path.join(
            os.path.dirname(output_path), f".norm_{i}_{os.path.basename(clip)}"
        )
        if not _normalize_to_canonical(clip, norm_path):
            raise RuntimeError(
                f"Failed to normalize clip {i} ({os.path.basename(clip)}). "
                f"Check that the file is a valid video."
            )
        normalized_clips.append(norm_path)

    # Hard-cut concat (no crossfade artifacts, no dark blends)
    concat_file = os.path.join(
        os.path.dirname(output_path), "concat_list.txt"
    )
    with open(concat_file, "w") as f:
        for clip in normalized_clips:
            f.write(f"file '{os.path.abspath(clip)}'\n")

    # Use re-encode (not -c copy) so the optional final fade-in/fade-out can
    # be applied. Concat-demuxer + filter requires re-encoding anyway.
    concat_raw = output_path + ".concat.mp4"
    cmd_concat = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        concat_raw,
    ]
    result = subprocess.run(cmd_concat, capture_output=True, text=True)
    try:
        os.remove(concat_file)
    except OSError:
        pass
    if result.returncode != 0:
        print(f"concat error:\n{result.stderr[-1500:]}")
        for clip in normalized_clips:
            try:
                os.remove(clip)
            except OSError:
                pass
        raise RuntimeError("ffmpeg concat failed. Check the server log.")

    # Now apply gentle fade-in/fade-out for cinematic top + tail
    total_meta = await get_video_metadata(concat_raw)
    total_dur = total_meta["duration"]
    fade_in_dur = 0.4
    fade_out_dur = 0.6
    fade_out_start = max(0.0, total_dur - fade_out_dur)

    cmd_fade = [
        "ffmpeg", "-y",
        "-i", concat_raw,
        "-vf",
        f"fade=t=in:st=0:d={fade_in_dur},"
        f"fade=t=out:st={fade_out_start}:d={fade_out_dur}",
        "-af",
        f"afade=t=in:st=0:d={fade_in_dur},"
        f"afade=t=out:st={fade_out_start}:d={fade_out_dur}",
        "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        output_path,
    ]
    result = subprocess.run(cmd_fade, capture_output=True, text=True)
    try:
        os.remove(concat_raw)
    except OSError:
        pass
    for clip in normalized_clips:
        try:
            os.remove(clip)
        except OSError:
            pass
    if result.returncode != 0:
        print(f"fade error:\n{result.stderr[-1500:]}")
        raise RuntimeError("ffmpeg fade pass failed. Check the server log.")

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise RuntimeError("ffmpeg produced an empty assembled file.")

    return output_path


async def overlay_music_bed(
    video_path: str, music_path: str, output_path: str
) -> str:
    """Overlay background music at low volume across the assembled video."""
    video_metadata = await get_video_metadata(video_path)
    video_duration = video_metadata["duration"]
    fade_start = max(0.0, video_duration - 2.0)

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-stream_loop", "-1",
        "-i", music_path,
        "-filter_complex",
        f"[1:a]volume=0.12,afade=t=out:st={fade_start}:d=2[music];"
        f"[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[aout]",
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Music overlay error: {result.stderr}")
        shutil.copy2(video_path, output_path)

    return output_path


async def extract_evenly_spaced_keyframes(
    video_path: str,
    output_dir: str,
    label: str,
    num_frames: int = 5,
) -> list[str]:
    """Extract `num_frames` evenly spaced keyframes from a video.

    For the Critic Agent, which reviews the assembled output by sampling
    across its full duration (10/30/50/70/90% by default for 5 frames).
    """
    metadata = await get_video_metadata(video_path)
    duration = metadata["duration"] or 1.0

    # Even spacing inside the video, padded from the edges.
    if num_frames <= 1:
        timestamps = [duration * 0.5]
    else:
        # Pad 10% on each side so first/last frames aren't black/credits.
        start = duration * 0.1
        end = duration * 0.9
        step = (end - start) / (num_frames - 1)
        timestamps = [start + i * step for i in range(num_frames)]

    frame_paths: list[str] = []
    for i, ts in enumerate(timestamps):
        out = os.path.join(output_dir, f"{label}_review_{i}.jpg")
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(ts),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            out,
        ]
        subprocess.run(cmd, capture_output=True)
        if os.path.exists(out):
            frame_paths.append(out)
    return frame_paths


async def render_ken_burns_clip(
    image_path: str,
    output_path: str,
    duration_seconds: float = 4.0,
    width: int = 1280,
    height: int = 720,
) -> str:
    """Build a video clip from a still image with a slow zoom-in (Ken Burns)
    plus a silent audio track so it merges cleanly into the assembly pipeline.
    """
    fps = 30
    total_frames = int(duration_seconds * fps)
    # zoompan needs an oversized source so the zoom doesn't reveal black borders.
    big_w = width * 2
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-t", str(duration_seconds), "-i", image_path,
        "-f", "lavfi", "-t", str(duration_seconds),
        "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-filter_complex",
        (
            f"[0:v]scale={big_w}:-2:flags=lanczos,"
            f"zoompan=z='min(zoom+0.0008,1.18)':d={total_frames}:s={width}x{height}:fps={fps},"
            "format=yuv420p[v]"
        ),
        "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k",
        "-r", str(fps),
        "-shortest", "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Ken Burns render error:\n{result.stderr[-1500:]}")
        raise RuntimeError(
            "Failed to render Ken Burns clip from generated image."
        )
    return output_path


async def normalize_audio(video_path: str, output_path: str) -> str:
    """Normalize audio levels using loudnorm filter."""
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-af", "loudnorm=I=-23:TP=-1.5:LRA=11",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Normalize error: {result.stderr}")
        shutil.copy2(video_path, output_path)

    return output_path
