# RUSHES — AI Post-Production Suite for AI Filmmakers

AI filmmakers generate clips from five different tools — Veo, Kling, Runway, Seedance, Popcorn. They end up with a messy folder of disconnected files. Some have audio. Some are silent. Styles drift. Nothing matches. Assembling these into one coherent film takes longer than generating the clips themselves.

RUSHES solves this. Upload all your clips. In 30 seconds, RUSHES:

- Analyzes every frame using AI vision to understand scenes, characters, and mood
- Scores each clip on quality and flags AI artifacts
- Detects continuity breaks across clips (clothing mismatches, environment changes)
- Identifies missing shots and suggests ready-to-use generation prompts
- Generates complete sound design for silent clips using ElevenLabs
- Creates a mood-matched music bed
- Normalizes audio across all clips
- Assembles everything into one coherent sequence with crossfade transitions

Built solo by Himanshu Agarwal in 48 hours.

Stack: React + TypeScript + Vite (frontend), FastAPI + Python (backend), OpenAI Vision API (analysis), ElevenLabs (sound design), ffmpeg (audio/video processing). Deployed on Vercel.

RUSHES uses ElevenLabs for intelligent sound design, Runware for multimodal analysis, and Vercel for deployment. Built with Cursor.
