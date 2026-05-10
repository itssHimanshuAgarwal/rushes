export interface ClipAnalysis {
  clip_id: string;
  filename: string;
  duration: number;
  resolution: string;
  has_audio: boolean;
  scene_description: string;
  environment: string;
  lighting: string;
  mood: string;
  characters: Array<{ description: string; clothing: string }>;
  objects: string[];
  sounds_needed: string[];
  ambient_type: string;
  quality_score: number;
  quality_issues: string[];
  color_palette: string;
  thumbnail_url: string;
  video_url: string;
}

export interface ContinuityBreak {
  clip_a: number;
  clip_b: number;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  // The Critic LLM proposes a concrete fix: which clip is the ground truth,
  // which clip should be regenerated, and a ready-to-paste video-gen prompt
  // that corrects the break while keeping the rest of the scene intact.
  anchor_clip_id?: string;
  fix_clip_id?: string;
  corrected_prompt?: string;
}

export interface MissingShot {
  description: string;
  suggested_prompt: string;
}

export interface AnalysisResult {
  clips: ClipAnalysis[];
  continuity_breaks: ContinuityBreak[];
  missing_shots: MissingShot[];
  suggested_order: string[];
  overall_coherence_score: number;
}

export interface AudioGenerationResult {
  clip_id: string;
  audio_url: string;
  video_with_audio_url: string;
  sounds_generated: string[];
}

export interface AssemblyResult {
  output_url: string;
  duration: number;
  clips_used: number;
}

export type AppStatus =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'ready'
  | 'generating-audio'
  | 'generating-music'
  | 'assembling'
  | 'critiquing'
  | 'complete';

export interface SubScore {
  score: number;
  notes: string;
}

export type FixableAgent = 'sound-design' | 'music' | 'assembly' | 'none';

export interface Improvement {
  type: 'audio' | 'visual' | 'pacing' | 'mood';
  description: string;
  agent_to_rerun: FixableAgent;
  new_instruction: string;
}

export interface Critique {
  overall_score: number;
  verdict: string;
  audio_quality: SubScore;
  visual_continuity: SubScore;
  pacing: SubScore;
  mood_coherence: SubScore;
  improvements: Improvement[];
}

export interface AppState {
  status: AppStatus;
  clips: ClipAnalysis[];
  selectedClipId: string | null;
  continuityBreaks: ContinuityBreak[];
  missingShots: MissingShot[];
  suggestedOrder: string[];
  overallCoherenceScore: number;
  musicUrl: string | null;
  assembledVideoUrl: string | null;
  critique: Critique | null;
}
