from typing import Literal

from pydantic import BaseModel


class Character(BaseModel):
    description: str
    clothing: str


class ClipAnalysis(BaseModel):
    clip_id: str
    filename: str
    duration: float
    resolution: str
    has_audio: bool
    scene_description: str
    environment: str
    lighting: str
    mood: str
    characters: list[Character]
    objects: list[str]
    sounds_needed: list[str]
    ambient_type: str
    quality_score: float
    quality_issues: list[str]
    color_palette: str
    thumbnail_url: str
    video_url: str


class ContinuityBreak(BaseModel):
    clip_a: int
    clip_b: int
    issue: str
    severity: Literal["high", "medium", "low"]


class MissingShot(BaseModel):
    description: str
    suggested_prompt: str


class AnalysisResult(BaseModel):
    clips: list[ClipAnalysis]
    continuity_breaks: list[ContinuityBreak]
    missing_shots: list[MissingShot]
    suggested_order: list[str]
    overall_coherence_score: float


class AudioGenerationResult(BaseModel):
    clip_id: str
    audio_url: str
    video_with_audio_url: str
    sounds_generated: list[str]


class AssemblyResult(BaseModel):
    output_url: str
    duration: float
    clips_used: int
