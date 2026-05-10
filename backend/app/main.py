from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes import (
    analyze,
    assemble,
    audio,
    critique,
    events,
    generate_shot,
    music,
)

app = FastAPI(
    title="RUSHES API",
    description="AI Post-Production Suite for AI Filmmakers",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"
OUTPUT_DIR = BASE_DIR / "output"


@app.on_event("startup")
async def ensure_directories() -> None:
    for directory in (UPLOADS_DIR, PROCESSED_DIR, OUTPUT_DIR):
        directory.mkdir(parents=True, exist_ok=True)


app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/processed", StaticFiles(directory=str(PROCESSED_DIR)), name="processed")
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

app.include_router(analyze.router, prefix="/api")
app.include_router(audio.router, prefix="/api")
app.include_router(music.router, prefix="/api")
app.include_router(assemble.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(generate_shot.router, prefix="/api")
app.include_router(critique.router, prefix="/api")


@app.get("/health")
@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
