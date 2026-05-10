# RUSHES

**AI Post-Production Suite for AI Filmmakers.** Drop a folder of AI-generated clips. RUSHES analyzes every frame, scores quality, flags continuity breaks, generates sound design and music, and assembles the final film all in about 30 seconds.

![RUSHES dashboard](docs/screenshot.png)

## Setup

### 1. Backend (FastAPI + Python 3.11)

```bash
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Copy your API keys into `backend/.env`:

```
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=sk_...
RUNWARE_API_KEY=
ANTHROPIC_API_KEY=
```

Only `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` are required for the live pipeline. The frontend has a fully-mocked demo mode that needs neither.

You also need `ffmpeg` and `ffprobe` on your `$PATH`:

```bash
brew install ffmpeg
```

### 2. Frontend (Vite + React + TypeScript)

```bash
cd frontend
npm install
```

## Run

In two terminals:

```bash
# terminal 1
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
# terminal 2
cd frontend
npm run dev
```

Then open http://localhost:5173.

The Vite dev server proxies `/api`, `/uploads`, `/processed`, and `/output` to the backend.

## Demo mode

Press **⌘D** (or **Ctrl+D**) on the upload screen — or click "Try the demo without uploading" — to load 5 pre-analyzed clips with a wardrobe-mismatch continuity break and a missing-shot suggestion. Make Coherent runs a fully-mocked pipeline so you can demo the experience even without API keys or backend running.

## API endpoints

| Method · Path | Purpose |
|---|---|
| `POST /api/analyze` | Multipart upload → ffprobe + 3-keyframe vision analysis + cross-clip continuity check |
| `POST /api/generate-audio` | Per-clip ElevenLabs SFX + ambient bed → ffmpeg overlay |
| `POST /api/generate-music` | ElevenLabs SFX API used for cinematic music bed (subtle / moderate / intense) |
| `POST /api/assemble` | Loudnorm + crossfade concatenation + optional music overlay → final mp4 |
| `GET /health`, `GET /api/health` | Health checks |

## Tech stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind v4, Framer Motion, Lucide icons, react-dropzone
- **Backend**: FastAPI, Pydantic v2, httpx, aiofiles
- **AI**: OpenAI Vision API (gpt-4o-mini) for clip analysis and continuity checking; ElevenLabs Sound Effects API for sound design and music
- **Media**: ffmpeg / ffprobe for keyframe extraction, audio mixing, loudnorm, crossfade assembly

## Sponsor credits

Built with **ElevenLabs**, **Runware**, **Vercel**, and **Cursor**.
