# RUSHES — Project Handoff Document

**Last updated:** 2026-05-09
**Author:** Himanshu Agarwal (`himanshu@tilt.app`)
**Project root:** `/Users/himanshuagarwal/rushes`
**Status at handoff:** All four backend endpoints working end-to-end against real APIs. Full frontend complete with cinematic UI, animations, and a fully-mocked demo mode. Ready to demo. Not yet committed to git, not yet deployed.

---

## 0. The 60-second TL;DR

RUSHES is a hackathon project for **Big Screen Hack London 2026 (Builder Track)**. It's an AI post-production suite for AI filmmakers — they generate clips with Veo / Kling / Runway / Seedance / Popcorn and end up with a messy folder of disconnected files (some silent, some with audio, styles drift, nothing matches). RUSHES analyzes every frame, scores quality, flags continuity breaks, generates sound design and music, and assembles the final film in ~30 seconds.

**Architecture:** FastAPI backend (Python 3.11) + Vite/React/TypeScript frontend. Talks to OpenAI Vision (gpt-4o-mini), ElevenLabs Sound Effects API, and uses ffmpeg/ffprobe locally for media processing.

**State:**
- Backend: 4 endpoints all live and tested with real APIs (`/api/analyze`, `/api/generate-audio`, `/api/generate-music`, `/api/assemble`)
- Frontend: full cinematic dashboard built, animations done, demo mode (⌘D) works fully offline
- No database (filesystem-only — `uploads/`, `processed/`, `output/`)
- Two API keys live in `backend/.env` (OpenAI + ElevenLabs)
- Servers were running on ports 8000 (backend) and 5173 (frontend) before restart

---

## 1. The problem

AI filmmakers today work across 5+ AI video generation tools. Each tool produces a clip in isolation. The filmmaker ends up with:

- Disconnected files in a messy folder
- Some clips have audio, some are silent
- Visual styles drift across tools (color, lighting, character consistency)
- Wardrobe or environment continuity breaks between clips that should be consecutive
- No music, no transitions, no coherent assembly
- The "post-production" step (assembling these into one film) takes longer than generating the clips themselves

## 2. The concept (5-step pipeline)

Drop clips into RUSHES → in ~30 seconds:

1. **Analyze every clip** with OpenAI Vision (3 keyframes per clip, gpt-4o-mini, low detail) — extract scene description, environment, lighting, mood, characters, objects, sounds_needed, ambient_type, quality_score (0-100), quality_issues, color_palette
2. **Cross-clip continuity check** — second LLM call compares all clip analyses and returns continuity_breaks (clothing/environment/lighting mismatches) + missing_shots (with suggested Runway/Kling prompts) + suggested_order + overall_coherence_score (0-100)
3. **Sound design** — for each silent clip, ElevenLabs generates 3 SFX from `sounds_needed` + 1 ambient bed (mapped from `ambient_type`); ffmpeg mixes (ambient at 0.25 volume, SFX at 0.7) and overlays onto the silent video
4. **Music bed** — ElevenLabs generates a cinematic music bed using a templated prompt (subtle/moderate/intense × dominant mood from clips); capped at 22s and looped at assembly time
5. **Final assembly** — loudnorm pass on every clip, xfade/acrossfade for 2-clip case or concat-demuxer for 3+ clips, optional music overlay at 0.12 volume with 2s fade-out

---

## 3. Tech stack

### Backend
- **Python 3.11** (homebrew `/opt/homebrew/bin/python3.11`) — system Python is 3.9.6 but venv uses 3.11
- **FastAPI 0.115.0** + **uvicorn[standard] 0.32.0**
- **pydantic 2.10.0** + **pydantic-settings 2.6.0**
- **httpx 0.28.0** (async HTTP for OpenAI + ElevenLabs)
- **aiofiles 24.1.0** (streaming uploads)
- **Pillow 11.0.0** (declared, not actively used — placeholder)
- **ffmpeg / ffprobe** version 8.0 (homebrew, `/opt/homebrew/bin/`) — required on `$PATH`

### Frontend
- **React 19.2.5** + **TypeScript ~6.0.2**
- **Vite 8.0.11** with **@vitejs/plugin-react** + **@tailwindcss/vite**
- **Tailwind CSS v4** (uses `@theme` block in CSS instead of config file)
- **Framer Motion** (all animations)
- **react-dropzone** (drag-and-drop upload)
- **lucide-react** (icons)
- **axios 1.x** (API client)
- **@dnd-kit/core / sortable / utilities** (installed for future timeline drag-reorder, not yet used)

### AI / external
- **OpenAI** `gpt-4o-mini` — for vision + continuity (one model for both)
- **ElevenLabs Sound Effects API** (`POST /v1/sound-generation`) — for SFX, ambient beds, AND music (the SFX endpoint can generate music too)
- **No database** — filesystem only

---

## 4. Folder structure

```
/Users/himanshuagarwal/rushes/
├── README.md                        # Public README (setup, run, sponsor credits)
├── SUBMISSION.md                    # ~200-word hackathon submission write-up
├── HANDOFF.md                       # ← this file
├── .gitignore                       # Protects .env, node_modules, .venv, generated media
│
├── backend/
│   ├── .env                         # !!! contains live API keys — NEVER commit
│   ├── .venv/                       # Python virtualenv (Python 3.11) — NOT committed
│   ├── requirements.txt
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app, CORS, static mounts, startup hook
│   │   ├── config.py                # Settings (loads .env), get_settings() w/ lru_cache
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py           # Pydantic mirrors of TS interfaces
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── analyze.py           # POST /api/analyze
│   │   │   ├── audio.py             # POST /api/generate-audio
│   │   │   ├── music.py             # POST /api/generate-music
│   │   │   └── assemble.py          # POST /api/assemble
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── vision.py            # OpenAI Vision wrapper
│   │       ├── elevenlabs.py        # SFX + ambient bed generators
│   │       ├── ffmpeg_ops.py        # ffprobe metadata, keyframes, mix, overlay,
│   │       │                        #   normalize, assemble (1/2/3+ branches),
│   │       │                        #   music_bed overlay
│   │       └── continuity.py        # OpenAI cross-clip analyzer
│   ├── uploads/                     # raw user uploads, served as /uploads/*
│   ├── processed/                   # thumbnails, keyframes, generated SFX/audio,
│   │                                #   _with_audio.mp4, _loudnorm.mp4 — served at /processed/*
│   └── output/                      # final assembled mp4 + music_*.mp3 — served at /output/*
│
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── vite.config.ts               # React plugin + Tailwind plugin + proxy to :8000
│   ├── tailwind.config.ts           # rush-* color tokens + Syne/DM Sans/JetBrains Mono fonts
│   ├── eslint.config.js
│   ├── index.html                   # Google Fonts links for Syne, DM Sans, JetBrains Mono
│   ├── public/
│   │   ├── demo_film.mp4            # 187KB bundled video for the offline demo Play button
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── main.tsx                 # createRoot + StrictMode
│       ├── App.tsx                  # State machine, top bar, dashboard layout, modal,
│       │                            #   keyboard shortcuts (⌘D, Esc), Make Coherent
│       │                            #   orchestration (real + mocked)
│       ├── index.css                # Tailwind v4 @theme tokens, body, film-grain,
│       │                            #   focus-visible, scrollbar
│       ├── lib/
│       │   ├── api.ts               # analyzeClips, generateAudio, generateMusic,
│       │   │                        #   assembleClips axios calls
│       │   ├── demoData.ts          # 5 pre-baked clips, SVG gradient thumbnails,
│       │   │                        #   1 wardrobe break, 1 missing shot, score 72
│       │   └── types.ts             # ClipAnalysis, ContinuityBreak, MissingShot,
│       │                            #   AnalysisResult, AudioGenerationResult,
│       │                            #   AssemblyResult, AppStatus, AppState
│       ├── hooks/
│       │   ├── useClipAnalysis.ts   # Stub (state lives in App.tsx)
│       │   └── useAudioGeneration.ts # Stub
│       └── components/
│           ├── UploadZone.tsx       # Hero + drop zone + upload progress + analyzing
│           │                        #   anim + slow-hint + "Try demo" link
│           ├── ClipGallery.tsx      # Left 320px panel
│           ├── ClipCard.tsx         # Each clip thumbnail tile (hover/selected gold border)
│           ├── ScoreCircle.tsx      # Animated SVG dasharray + count-up number
│           ├── AnalysisPanel.tsx    # Overview + Detail mode container
│           ├── ContinuityWarning.tsx # Red-tinted card with severity pill
│           ├── MissingShot.tsx      # Gold-tinted card with prompt + copy button
│           ├── MakeCoherentButton.tsx # 3-state: idle gradient → 5-step process → "✓ FILM COHERENT"
│           ├── Timeline.tsx         # Bottom strip + play/export controls + music bar + waveform
│           ├── AudioWaveform.tsx    # 80 decorative bars, animated when active
│
└── docs/
    ├── .placeholder
    └── screenshots/
        ├── 01_upload_zone.png       # the gold RUSHES landing
        ├── 02_demo_overview.png     # post-⌘D dashboard with 72 coherence score
        ├── 03_demo_audio_step.png   # mid-pipeline (sound design step active)
        ├── 04_demo_complete.png     # green "✓ FILM COHERENT" + gold music bar + waveform
        └── 05_detail_mode.png       # clip detail with score circle + tag pills
```

---

## 5. Backend API contract

All endpoints are mounted under `/api`. The backend also serves static files from `/uploads/*`, `/processed/*`, `/output/*` directly.

Two health endpoints exist (one without prefix, one with) — both return `{"status":"ok"}`:
- `GET /health`
- `GET /api/health`

Plus four ping endpoints (no logic, just for sanity checks):
- `GET /api/analyze/ping`, `/api/audio/ping`, `/api/music/ping`, `/api/assemble/ping`

### `POST /api/analyze`

**Request:** multipart/form-data with one or more `files=@clip.mp4` parts (must be video/*)

**Pipeline per request:**
1. Stream each upload to `uploads/{uuid}.{ext}` via aiofiles
2. ffprobe → duration, resolution, has_audio, codec
3. ffmpeg extracts 3 keyframes (10/50/90% of duration) into `processed/{clip_id}_frame_{0,1,2}.jpg`
4. ffmpeg extracts 1 thumbnail at 0.5s, scaled to 320px wide, into `processed/{clip_id}_thumb.jpg`
5. OpenAI Vision (gpt-4o-mini, detail: low, base64-encoded JPEGs, max 1000 tokens, temp 0.3) → returns clip JSON
6. After all clips: cross-clip OpenAI call (gpt-4o-mini, max 1500 tokens, temp 0.3) → continuity breaks, missing shots, suggested_order, overall_coherence_score

**Response (200):**
```jsonc
{
  "clips": [
    {
      "clip_id": "1e111dc1b5844bf3b4a4f5d2ba743db3",
      "filename": "test_with_audio.mp4",
      "duration": 5.0,
      "resolution": "1280x720",
      "has_audio": true,
      "scene_description": "...",
      "environment": "...",
      "lighting": "...",
      "mood": "neutral and technical",
      "characters": [{ "description": "...", "clothing": "..." }],
      "objects": ["...", "..."],
      "sounds_needed": ["static noise", "beeping test tones", "..."],
      "ambient_type": "indoor-room",
      "quality_score": 95,
      "quality_issues": [],
      "color_palette": "...",
      "thumbnail_url": "/processed/1e111dc1b5844bf3b4a4f5d2ba743db3_thumb.jpg",
      "video_url": "/uploads/1e111dc1b5844bf3b4a4f5d2ba743db3.mp4"
    }
  ],
  "continuity_breaks": [
    { "clip_a": 0, "clip_b": 1, "issue": "...", "severity": "high" }
  ],
  "missing_shots": [
    { "description": "...", "suggested_prompt": "..." }
  ],
  "suggested_order": ["1e111dc1...", "9f144be8..."],
  "overall_coherence_score": 40
}
```

**Errors:** 400 if no files, 502 if Vision/continuity LLM call fails. Real test on 2× 5s test clips: HTTP 200 in ~14s.

### `POST /api/generate-audio`

**Request body (JSON):**
```jsonc
{
  "clip_id": "9f144be822f743ba8e92638c28e2a016",
  "sounds_needed": ["footsteps on wooden floor", "door creaking open slowly"],
  "ambient_type": "indoor-room",
  "mood": "mysterious",
  "duration_seconds": 5.0
}
```

**Pipeline:**
1. Look up source video at `uploads/{clip_id}.*` (404 if missing)
2. **Mock fallback:** if `ELEVENLABS_API_KEY` is empty, copy original to `processed/{clip_id}_with_audio.mp4`, return `mock: true`
3. Top-3 of `sounds_needed` fired in parallel via `asyncio.gather` → ElevenLabs SFX (each capped to 10s)
4. Ambient mapped from `ambient_type` via 11-entry dict (forest/cave/ocean-beach/etc.) with fallback to a generic prompt for unknown types
5. ffmpeg `amix` filter — ambient at volume=0.25, SFX at volume=0.7
6. ffmpeg overlays the mix onto source video: `-c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest`

**Response (200):**
```jsonc
{
  "clip_id": "9f144be8...",
  "video_with_audio_url": "/processed/9f144be8..._with_audio.mp4",
  "audio_url": "/processed/9f144be8..._mix.mp3",
  "sounds_generated": ["footsteps...", "door creaking...", "quiet indoor room tone..."],
  "mock": false
}
```

**Real test:** 2 SFX + 1 ambient generated, full mp4 with stereo aac at 192kbps in ~4.6s.

### `POST /api/generate-music`

**Request body (JSON):**
```jsonc
{
  "mood": "mysterious",
  "duration_seconds": 12.0,
  "intensity": "subtle"  // "subtle" | "moderate" | "intense"
}
```

**Pipeline:** templated prompt (3 templates × `{mood}`) → ElevenLabs SFX endpoint (yes, the SFX API generates music too) → save to `output/music_{uuid}.mp3`. Caps at 22s API max; sets `truncated: true` if request was longer.

**Response (200):**
```jsonc
{
  "music_url": "/output/music_c8a2f562adea496f8b4bac43a1492ed4.mp3",
  "mood": "mysterious",
  "intensity": "subtle",
  "duration": 12.0,
  "prompt": "very quiet, minimal cinematic ambient music, mysterious tone, ...",
  "truncated": false,
  "mock": false
}
```

Mock fallback returns `mock: true` with `music_url: null` when key is empty.

**Real test:** HTTP 200 in ~3.2s.

### `POST /api/assemble`

**Request body (JSON):**
```jsonc
{
  "clip_ids": ["clip_1_id", "clip_2_id", "..."],
  "music_url": "/output/music_xxx.mp3",   // optional
  "crossfade_seconds": 0.5
}
```

**Pipeline:**
1. Per clip_id: prefer `processed/{id}_with_audio.mp4`, else fall back to `uploads/{id}.*` (404 if neither)
2. Loudnorm pass on every clip → `processed/{id}_loudnorm.mp4` (`I=-23:TP=-1.5:LRA=11`)
3. **1 clip:** simple copy. **2 clips:** xfade=fade + acrossfade. **3+ clips:** re-encode all to `1280x720@30fps` then concat-demuxer.
4. If `music_url` provided: `overlay_music_bed` with `-stream_loop -1`, music at 0.12 volume, `afade out` over last 2s, `amix duration=first`
5. Final mp4 lands in `output/final_{uuid}.mp4` (with music) or `output/assembled_{uuid}.mp4` (no music)

**Response (200):**
```jsonc
{
  "output_url": "/output/final_aa0b988d64d04bfa9495ac4e3fbd1301.mp4",
  "duration": 9.557,
  "clips_used": 2,
  "music_applied": true,
  "music_status": "applied"
}
```

**Real test:** 2×5s clips with 0.5s crossfade + music → 9.557s output, h264 1280x720@30fps + aac stereo 178kbps, HTTP 200 in ~4.7s.

---

## 6. Frontend state machine

`AppState` (in `frontend/src/lib/types.ts`):
```ts
type AppStatus =
  | 'idle'             // upload zone visible
  | 'uploading'        // multipart upload in progress (gold progress bar)
  | 'analyzing'        // /api/analyze running (cycling 4-message animation)
  | 'ready'            // dashboard visible, Make Coherent button gold/idle
  | 'generating-audio' // step 3 of pipeline
  | 'generating-music' // step 4
  | 'assembling'       // step 5
  | 'complete';        // green "✓ FILM COHERENT" + Play/Export glowing
```

State transitions:
- `idle` → `uploading` on file drop
- `uploading` → `analyzing` when upload progress hits 100%
- `analyzing` → `ready` when `/api/analyze` resolves
- `ready` → `generating-audio` on Make Coherent click
- `generating-audio` → `generating-music` → `assembling` → `complete`
- Any failure during pipeline → back to `ready` with `pipelineError` set

### Demo mode (⌘D / Ctrl+D)
- Bypasses `/api/analyze` entirely; loads `DEMO_ANALYSIS` from `lib/demoData.ts`
- Make Coherent runs a *mocked* version of the pipeline with realistic timing (3.5s + 2.8s + 2.6s = ~9s)
- Renders a teal "✨ DEMO" badge in the top bar so it's obvious you're in mock mode
- Bundled `frontend/public/demo_film.mp4` (187KB) powers the Play button

### Top-bar reset (`+ UPLOAD MORE CLIPS`)
- Wipes ALL state back to `INITIAL_STATE`
- Cancels the slow-hint timer
- Clears generating-audio + audio-ready sets
- Closes the playback modal

### Keyboard shortcuts
- `⌘D` / `Ctrl+D` — load demo
- `Escape` — close playback modal (when open)

---

## 7. What's REAL data vs DEMO data

### Real-data path (production-style)
- Backend: ALL FOUR endpoints hit real APIs and produce real files
  - OpenAI Vision actually analyzes the keyframes
  - ElevenLabs actually generates SFX, ambient beds, and music
  - ffmpeg actually mixes/overlays/assembles
- Files persist in `backend/uploads/`, `backend/processed/`, `backend/output/` — these are gitignored but live on disk
- Both API keys in `backend/.env` are real keys provided by the user during this session:
  - `OPENAI_API_KEY` — provided 2026-05-09
  - `ELEVENLABS_API_KEY` — provided 2026-05-09
- The two test clips at `/tmp/rushes-test/test_with_audio.mp4` and `test_silent.mp4` were generated with `ffmpeg -f lavfi -i testsrc...` — colored test patterns. **`/tmp` clears on restart, so they will be GONE after restart. Regenerate them if needed (command in §11.4).**
- Sample real outputs from this session (still on disk in `backend/processed/` and `backend/output/`):
  - 2 analyzed clips (1e111dc1... and 9f144be8...)
  - 1 with-audio version (9f144be8..._with_audio.mp4 — 187KB)
  - 1 music bed (music_c8a2f562adea496f8b4bac43a1492ed4.mp3 — 193KB)
  - 1 final assembled (final_aa0b988d..._mp4 — 391KB)

### Demo-data path (mocked, no backend needed)
- Triggered by ⌘D on upload screen
- 5 fictional clips telling a moody noir vignette ("a stranger arrives at a rainy-night cafe")
- Inline SVG gradient thumbnails (no files on disk needed)
- 1 high-severity wardrobe-mismatch break, 1 missing establishing wide shot, coherence 72
- Make Coherent runs a fake `setTimeout`-based pipeline with the same UI animations
- Play button uses `/demo_film.mp4` from `frontend/public/`
- Backend doesn't need to be running for demo mode

---

## 8. Status of each piece (checklist)

| Piece | State | Notes |
|---|---|---|
| Backend `POST /api/analyze` | ✅ Working with real OpenAI | 14s for 2 clips |
| Backend `POST /api/generate-audio` | ✅ Working with real ElevenLabs | 4.6s for 1 clip; mock fallback in place |
| Backend `POST /api/generate-music` | ✅ Working with real ElevenLabs | 3.2s for 12s clip |
| Backend `POST /api/assemble` | ✅ Working | 4.7s for 2 clips with music |
| Backend health checks | ✅ `/health` and `/api/health` both return `{"status":"ok"}` |
| Backend static file serving | ✅ `/uploads/*`, `/processed/*`, `/output/*` all serve HTTP 200 |
| Frontend upload zone | ✅ Drag-drop + click-to-browse + animations |
| Frontend upload progress | ✅ Per-file progress bars (gold), aggregate % |
| Frontend analyzing animation | ✅ 3 pulsing dots + cycling 4-message text |
| Frontend dashboard | ✅ Top bar + 320px Clips gallery + AnalysisPanel + Timeline |
| Frontend ClipCard | ✅ Thumbnail, score circle, duration, audio indicator, mood pill, hover/selected gold |
| Frontend AnalysisPanel overview | ✅ Coherence hero, stat cards, continuity, missing shots, audio status |
| Frontend AnalysisPanel detail | ✅ Back link, video player, score circle, tag pills, sounds needed, quality issues |
| Frontend MakeCoherentButton | ✅ 3 states: idle (gold gradient + pulse) / processing (5-step list) / complete (green) |
| Frontend Timeline | ✅ Clip strip + Play + Export + Music bar + Animated waveform |
| Frontend playback modal | ✅ Backdrop blur, close on click-outside / Esc / X button, autoplay video |
| Demo mode (⌘D) | ✅ 5 clips, 1 break, 1 missing, mocked pipeline, no backend needed |
| Real Make-Coherent end-to-end | ✅ Verified via headless Chrome — pipeline completes, video plays |
| Demo Make-Coherent end-to-end | ✅ Verified — green button, gold music bar, waveform active |
| TypeScript type-check | ✅ `tsc --noEmit` clean |
| Production build | ✅ `npm run build` 0 errors / 0 warnings — 32KB CSS / 483KB JS (152KB gzipped) |
| Database | ⛔ Not needed — filesystem only |
| Git commits | ⛔ Nothing committed yet |
| Deployment | ⛔ Not deployed (Vercel was mentioned in submission, not actually deployed yet) |
| Tests (unit) | ⛔ None written — hackathon project, manual + headless-Chrome testing only |

---

## 9. What's pending / nice-to-haves

These were not built — none are required for the demo:

- **Multi-file per-file progress bars**: currently all files in one upload show the same percentage (axios `onUploadProgress` reports total request progress, not per-file). Would require splitting into N requests.
- **Drag-to-reorder timeline**: `@dnd-kit/core/sortable/utilities` are installed but not wired up. Currently the timeline shows `suggested_order` from the LLM; users can't manually reorder.
- **Real "Fix All Silent Clips" button**: per-clip "Fix Audio" works but there's no batch action separate from Make Coherent
- **Git init + first commit**: nothing has been committed. The .gitignore is in place; `git init && git add . && git commit` is safe whenever ready
- **Vercel deployment**: the submission mentions Vercel; not actually deployed
- **Unit tests**
- **Better error UX for ElevenLabs quota exhaustion**: currently shows raw error message
- **Audio waveform from real audio data**: the `AudioWaveform.tsx` is decorative bars, not real FFT analysis

---

## 10. Environment / secrets state

`backend/.env` (DO NOT COMMIT — already in `.gitignore`):
```
OPENAI_API_KEY=sk-proj-...        # required for vision + continuity + critic
ELEVENLABS_API_KEY=sk_...         # required for sound design + music
RUNWARE_API_KEY=...               # required for /api/generate-shot
ANTHROPIC_API_KEY=                # unused, remove from .env safely
```

Real keys live in your local `backend/.env` (which is gitignored). See `backend/.env.example` for the template. ANTHROPIC_API_KEY is unused.

If keys leak / need rotation: just edit `backend/.env`, then **restart uvicorn** (settings are cached at import time via `@lru_cache`).

---

## 11. How to start everything from scratch (post-restart)

### 11.1 Prerequisites that should already be installed (verify after restart)

```bash
# Python 3.11
/opt/homebrew/bin/python3.11 --version    # expect 3.11.15

# ffmpeg / ffprobe
/opt/homebrew/bin/ffmpeg -version | head -1   # expect 8.0
/opt/homebrew/bin/ffprobe -version | head -1  # expect 8.0

# Node + npm
node --version
npm --version

# If any are missing:
brew install python@3.11 ffmpeg node
```

### 11.2 Backend: install (only if .venv is missing)

```bash
cd /Users/himanshuagarwal/rushes/backend

# If .venv already exists from the previous session, skip these two lines:
/opt/homebrew/bin/python3.11 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install websocket-client    # for the headless-Chrome test scripts
```

### 11.3 Backend: run

```bash
cd /Users/himanshuagarwal/rushes/backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

You should see `INFO: Uvicorn running on http://127.0.0.1:8000`. Health check:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 11.4 Test clips (regenerate after restart since /tmp clears)

```bash
mkdir -p /tmp/rushes-test
cd /tmp/rushes-test
ffmpeg -y -loglevel error -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 \
  -f lavfi -i anullsrc=r=44100:cl=stereo -t 5 test_with_audio.mp4
ffmpeg -y -loglevel error -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 \
  -t 5 -an test_silent.mp4
```

Then a real end-to-end test from terminal:
```bash
curl -s -X POST http://localhost:8000/api/analyze \
  -F "files=@/tmp/rushes-test/test_with_audio.mp4" \
  -F "files=@/tmp/rushes-test/test_silent.mp4" | python3 -m json.tool
```

### 11.5 Frontend: install (only if node_modules is missing)

```bash
cd /Users/himanshuagarwal/rushes/frontend
npm install
```

### 11.6 Frontend: run

```bash
cd /Users/himanshuagarwal/rushes/frontend
npm run dev
```

You should see `VITE v8.0.11 ready in ... ms` and `Local: http://localhost:5173/`. Open that URL in your browser.

### 11.7 Verify everything works

| Check | Expected |
|---|---|
| `curl http://localhost:8000/health` | `{"status":"ok"}` |
| `curl http://localhost:8000/api/health` | `{"status":"ok"}` |
| `curl http://localhost:5173/api/health` (proxy) | `{"status":"ok"}` |
| Open http://localhost:5173 | Gold "RUSHES" landing |
| Press **⌘D** on the landing | Demo dashboard with 5 clips, score 72, wardrobe break |
| Click **MAKE COHERENT** in demo | 3-step animation, ~9s, ends with green "✓ FILM COHERENT" |
| Click **Play** | Modal opens with `demo_film.mp4` autoplaying |
| Press **Esc** | Modal closes |
| Drop real videos | Upload bar → analyzing → real dashboard |

### 11.8 Stop the servers

```bash
# kill uvicorn
kill $(lsof -tiTCP:8000 -sTCP:LISTEN) 2>/dev/null

# kill vite
kill $(lsof -tiTCP:5173 -sTCP:LISTEN) 2>/dev/null
```

---

## 12. Resume the Claude Code session

After your system restart, from any terminal:

```bash
claude --continue
# OR
claude --resume    # then pick this conversation from the list
```

Conversation transcripts live in `~/.claude/projects/-Users-himanshuagarwal/` and persist across reboots. The directory should still contain this conversation's transcript.

If for some reason `--continue` doesn't pick up this session, just open Claude Code in `/Users/himanshuagarwal/rushes/` and tell it to read `HANDOFF.md` — that's why this file exists.

---

## 13. Demo runbook for the judges (the actual presentation)

**Backup path first** (do this if you have any doubt about WiFi or APIs):
1. Open http://localhost:5173 — see gold RUSHES landing
2. Press **⌘D** — instant dashboard, 5 clips, score 72, wardrobe-mismatch story
3. Click **MAKE COHERENT** — 9-second animated pipeline
4. Click **Play** — assembled film plays in modal
5. Click **Export** — downloads `rushes-final.mp4` (the bundled demo file)

**Live path** (the impressive version):
1. Open http://localhost:5173
2. Drop 2-4 AI-generated clips into the drop zone
3. Watch the upload progress + cycling analyzing animation (~12-15s)
4. Dashboard appears: clip cards on left with scores, coherence score on right, suggested-order timeline at bottom
5. Click on individual clips to see detail mode (scene description, mood, sounds_needed)
6. Click **MAKE COHERENT** — watch the 5-step pipeline run for ~30-60s
7. Final state: green button, gold music bar showing the dominant mood, animated waveform
8. Click **Play** → assembled film with generated SFX + ambient + music plays
9. Click **Export** → downloads the final mp4

**Talking points for the demo:**
- "AI filmmakers use 5+ tools. They end up with disconnected clips. RUSHES is the missing post-production step."
- "Every clip is analyzed by AI Vision. RUSHES sees what a script supervisor would see."
- "It catches things humans miss — wardrobe mismatches, environment drift, missing establishing shots."
- "Sound design is auto-generated by ElevenLabs based on what each scene actually needs — footsteps, room tone, rain, neon hum."
- "One click. 30 seconds. A coherent film."

---

## 14. Sponsor / submission boilerplate

For the Builder Track submission (Big Screen Hack London 2026):
- Sponsors: ElevenLabs, Runware, Vercel, Cursor
- Built with Cursor
- Submission write-up: see `SUBMISSION.md` (the full ~200-word version)
- Stack reference: see §3 above

---

## 15. Known gotchas

1. **Settings caching**: `backend/app/config.py` caches Settings via `@lru_cache`, so changing `.env` requires an uvicorn restart (uvicorn `--reload` only watches `.py` files)
2. **`/tmp` clears on macOS restart**: `/tmp/rushes-test/test_*.mp4` will be gone after restart. Regenerate via §11.4
3. **Real test clips are colored test patterns, not real footage**: when running through real APIs they get analyzed as "TV calibration patterns". For an impressive live demo, use actual AI-generated short clips (5-15s)
4. **ElevenLabs SFX max 22s**: longer requests get truncated. The music endpoint sets `truncated: true` and the assemble step uses `-stream_loop -1` to loop the music if shorter than the video
5. **Headless Chrome `<video>` elements crash the renderer in some cases**: the test scripts replace videos with placeholder divs before screenshotting. Real Chrome users won't hit this
6. **Tailwind v4**: uses `@theme` block in `frontend/src/index.css`, NOT the `tailwind.config.ts` file (that file is harmless but unused). Color tokens live in CSS, not JS
7. **Make Coherent button uses CSS `text-transform: uppercase`** so `innerText` returns the original case ("Make Coherent" / "Film Coherent"). For text checks on the live DOM, use `.toLowerCase().includes(...)`

---

## 16. One-paragraph summary for a fresh Claude session

> "I'm Himanshu and I'm building RUSHES, an AI post-production suite for AI filmmakers, for the Big Screen Hack London 2026 (Builder Track). The project lives at `/Users/himanshuagarwal/rushes`. It's a FastAPI backend + Vite/React/TypeScript frontend. Four backend endpoints (`/api/analyze`, `/api/generate-audio`, `/api/generate-music`, `/api/assemble`) all work end-to-end against OpenAI Vision and ElevenLabs APIs. The frontend has a fully cinematic dashboard with Tailwind v4 + Framer Motion, plus a fully-mocked ⌘D demo mode. Both servers ran on ports 8000 and 5173 before my system restart. My API keys are in `backend/.env`. Read `HANDOFF.md` in the project root for the full state of every file, every endpoint contract, and how to start everything back up."

---

## End of handoff
