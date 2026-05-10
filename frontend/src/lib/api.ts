import axios, { AxiosError } from 'axios'
import type {
  AnalysisResult,
  AssemblyResult,
  AudioGenerationResult,
} from './types'

const api = axios.create({ baseURL: '/api' })

// Surface FastAPI's HTTPException.detail instead of axios's generic
// "Request failed with status code 502" message.
api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ detail?: string }>) => {
    const detail = error.response?.data?.detail
    if (detail) {
      const enriched = new Error(detail)
      // Preserve the original axios error metadata for debugging
      ;(enriched as any).response = error.response
      return Promise.reject(enriched)
    }
    return Promise.reject(error)
  },
)

export async function analyzeClips(
  files: File[],
  options?: {
    onUploadProgress?: (percent: number) => void
    jobId?: string
  },
): Promise<AnalysisResult> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  if (options?.jobId) formData.append('job_id', options.jobId)
  const { data } = await api.post<AnalysisResult>('/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
    onUploadProgress: (event) => {
      if (!options?.onUploadProgress || !event.total) return
      options.onUploadProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data
}

export async function generateAudio(params: {
  clip_id: string
  sounds_needed: string[]
  ambient_type: string
  mood: string
  duration_seconds: number
}): Promise<AudioGenerationResult> {
  const { data } = await api.post<AudioGenerationResult>(
    '/generate-audio',
    params,
    { timeout: 180_000 },
  )
  return data
}

export async function generateMusic(params: {
  mood: string
  duration_seconds: number
  intensity: string
}): Promise<{ music_url: string }> {
  const { data } = await api.post<{ music_url: string }>(
    '/generate-music',
    params,
    { timeout: 60_000 },
  )
  return data
}

export async function assembleClips(params: {
  clip_ids: string[]
  music_url?: string
  crossfade_seconds?: number
}): Promise<AssemblyResult> {
  const { data } = await api.post<AssemblyResult>('/assemble', params, {
    timeout: 180_000,
  })
  return data
}

import type { ClipAnalysis } from './types'

export interface GeneratedClip extends ClipAnalysis {
  generated: true
  generation_mode: 'image' | 'video'
}

export async function generateShot(params: {
  prompt: string
  mode: 'image' | 'video'
  description?: string
  job_id?: string
}): Promise<GeneratedClip> {
  const { data } = await api.post<GeneratedClip>('/generate-shot', params, {
    // Video mode polls Runware for ~3 min — give it room.
    timeout: 360_000,
  })
  return data
}

import type { Critique } from './types'

export async function critiqueFilm(params: {
  output_url: string
  job_id?: string
}): Promise<Critique> {
  const { data } = await api.post<Critique>('/critique', params, {
    timeout: 60_000,
  })
  return data
}
