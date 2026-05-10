import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AnalysisPanel from './components/AnalysisPanel'
import ClipGallery from './components/ClipGallery'
import ProcessingPipeline from './components/ProcessingPipeline'
import Timeline from './components/Timeline'
import UploadZone from './components/UploadZone'
import {
  analyzeClips,
  assembleClips,
  critiqueFilm,
  generateAudio,
  generateMusic,
  generateShot,
} from './lib/api'
import type { Improvement, MissingShot } from './lib/types'
import {
  DEMO_ANALYSIS,
  DEMO_ASSEMBLED_VIDEO_URL,
  DEMO_CRITIQUE,
  DEMO_MUSIC_MOOD,
} from './lib/demoData'
import type { AppState, ClipAnalysis } from './lib/types'

const INITIAL_STATE: AppState = {
  status: 'idle',
  clips: [],
  selectedClipId: null,
  continuityBreaks: [],
  missingShots: [],
  suggestedOrder: [],
  overallCoherenceScore: 0,
  musicUrl: null,
  assembledVideoUrl: null,
  critique: null,
}

function dominantMood(clips: ClipAnalysis[]): string {
  if (clips.length === 0) return 'cinematic neutral'
  const counts = new Map<string, number>()
  for (const c of clips) {
    const key = (c.mood || '').toLowerCase().split(/[,.]/)[0].trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [k, v] of counts) {
    if (v > bestCount) {
      best = k
      bestCount = v
    }
  }
  return best || clips[0].mood || 'cinematic neutral'
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFiles, setUploadingFiles] = useState<
    { name: string; size: number }[]
  >([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [generatingAudioFor, setGeneratingAudioFor] = useState<Set<string>>(
    new Set(),
  )
  const [audioReadyFor, setAudioReadyFor] = useState<Set<string>>(new Set())
  const [playbackOpen, setPlaybackOpen] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [slowHint, setSlowHint] = useState(false)
  const slowTimerRef = useRef<number | null>(null)
  const [analyzeJobId, setAnalyzeJobId] = useState<string | null>(null)
  const [shotGenStatus, setShotGenStatus] = useState<
    Record<string, { status: 'running' | 'done' | 'error'; message?: string }>
  >({})
  const [critiqueStatus, setCritiqueStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle')
  const [critiqueError, setCritiqueError] = useState<string | null>(null)
  const [fixingKey, setFixingKey] = useState<string | null>(null)
  const [fixedKeys, setFixedKeys] = useState<Set<string>>(new Set())
  const [fixingAgent, setFixingAgent] = useState<
    'sound-design' | 'music' | 'assembly' | null
  >(null)

  const selectedClip = useMemo(
    () =>
      state.clips.find((c) => c.clip_id === state.selectedClipId) ?? null,
    [state.clips, state.selectedClipId],
  )

  const armSlowHint = useCallback((ms = 25_000) => {
    setSlowHint(false)
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    slowTimerRef.current = window.setTimeout(() => setSlowHint(true), ms)
  }, [])

  const clearSlowHint = useCallback(() => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    slowTimerRef.current = null
    setSlowHint(false)
  }, [])

  // Demo shortcut: Cmd/Ctrl + D loads pre-baked analysis state.
  const loadDemo = useCallback(() => {
    setDemoMode(true)
    setErrorMessage(null)
    setPipelineError(null)
    setUploadingFiles([])
    setUploadProgress(0)
    setGeneratingAudioFor(new Set())
    setAudioReadyFor(new Set())
    setPlaybackOpen(false)
    setState({
      status: 'ready',
      clips: DEMO_ANALYSIS.clips,
      selectedClipId: null,
      continuityBreaks: DEMO_ANALYSIS.continuity_breaks,
      missingShots: DEMO_ANALYSIS.missing_shots,
      suggestedOrder: DEMO_ANALYSIS.suggested_order,
      overallCoherenceScore: DEMO_ANALYSIS.overall_coherence_score,
      musicUrl: null,
      assembledVideoUrl: null,
      critique: null,
    })
    setCritiqueStatus('idle')
    setCritiqueError(null)
    setFixingKey(null)
    setFixedKeys(new Set())
    setFixingAgent(null)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        loadDemo()
        return
      }
      if (e.key === 'Escape' && playbackOpen) {
        setPlaybackOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loadDemo, playbackOpen])

  useEffect(() => {
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    }
  }, [])

  const handleFiles = useCallback(
    async (files: File[]) => {
      setErrorMessage(null)
      setPipelineError(null)
      setDemoMode(false)
      setUploadingFiles(files.map((f) => ({ name: f.name, size: f.size })))
      setUploadProgress(0)
      setAudioReadyFor(new Set())
      setState((s) => ({ ...s, status: 'uploading' }))
      armSlowHint(35_000)

      // Generate a job_id for this analyze run so the SSE stream can correlate.
      const jobId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      setAnalyzeJobId(jobId)

      try {
        const result = await analyzeClips(files, {
          jobId,
          onUploadProgress: (percent) => {
            setUploadProgress(percent)
            if (percent >= 100) {
              setState((s) =>
                s.status === 'uploading' ? { ...s, status: 'analyzing' } : s,
              )
            }
          },
        })

        clearSlowHint()
        setState({
          status: 'ready',
          clips: result.clips,
          selectedClipId: null,
          continuityBreaks: result.continuity_breaks,
          missingShots: result.missing_shots,
          suggestedOrder: result.suggested_order,
          overallCoherenceScore: result.overall_coherence_score,
          musicUrl: null,
          assembledVideoUrl: null,
          critique: null,
        })
        setCritiqueStatus('idle')
        setCritiqueError(null)
        setFixedKeys(new Set())
      } catch (err) {
        clearSlowHint()
        const message =
          err instanceof Error ? err.message : 'Analysis failed unexpectedly.'
        setErrorMessage(message)
        setState(INITIAL_STATE)
        setUploadingFiles([])
        setUploadProgress(0)
      }
    },
    [armSlowHint, clearSlowHint],
  )

  // Generate a missing shot via Runware → drop the new clip into the project.
  const handleGenerateShot = useCallback(
    async (shot: MissingShot, mode: 'image' | 'video') => {
      const key = shot.suggested_prompt
      setShotGenStatus((prev) => ({
        ...prev,
        [key]: {
          status: 'running',
          message:
            mode === 'video'
              ? 'Submitting to Runware (Kling 2.1) — ~2-3 min'
              : 'Generating image + Ken Burns — ~10s',
        },
      }))
      try {
        if (demoMode) {
          // In demo mode just simulate — append a synthetic clip after a delay
          await new Promise((r) => setTimeout(r, mode === 'video' ? 4000 : 2000))
          const fakeClip = {
            clip_id: `gen_${Math.random().toString(36).slice(2, 10)}`,
            filename: `GENERATED_${shot.description.slice(0, 16).replace(/\W+/g, '_').toUpperCase()}_v1.mp4`,
            duration: mode === 'video' ? 5.0 : 4.0,
            resolution: mode === 'video' ? '1920x1080' : '1280x720',
            has_audio: true,
            scene_description: shot.description,
            environment: 'AI-generated',
            lighting: 'matched to prompt',
            mood: 'generated',
            characters: [],
            objects: [],
            sounds_needed: [],
            ambient_type: 'indoor-room',
            quality_score: mode === 'video' ? 80 : 70,
            quality_issues: [],
            color_palette: 'matched',
            thumbnail_url: '/demo_film.mp4', // Will fail to render, but it's demo
            video_url: '/demo_film.mp4',
          }
          setState((s) => ({
            ...s,
            clips: [...s.clips, fakeClip],
            suggestedOrder: [...s.suggestedOrder, fakeClip.clip_id],
            missingShots: s.missingShots.filter(
              (m) => m.suggested_prompt !== shot.suggested_prompt,
            ),
          }))
          setShotGenStatus((prev) => ({
            ...prev,
            [key]: { status: 'done', message: 'Added (demo)' },
          }))
          return
        }

        const newClip = await generateShot({
          prompt: shot.suggested_prompt,
          mode,
          description: shot.description,
          job_id: analyzeJobId ?? undefined,
        })
        setState((s) => ({
          ...s,
          clips: [...s.clips, newClip],
          // Append to the suggested order so it shows up in the timeline strip
          suggestedOrder: [...s.suggestedOrder, newClip.clip_id],
          missingShots: s.missingShots.filter(
            (m) => m.suggested_prompt !== shot.suggested_prompt,
          ),
        }))
        setShotGenStatus((prev) => ({
          ...prev,
          [key]: {
            status: 'done',
            message: `+1 clip · ${newClip.duration.toFixed(1)}s`,
          },
        }))
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Generation failed.'
        setShotGenStatus((prev) => ({
          ...prev,
          [key]: { status: 'error', message: msg },
        }))
      }
    },
    [demoMode, analyzeJobId],
  )

  // FEEDBACK LOOP: Critic suggests a fix → user clicks "Fix This" → we re-run
  // the targeted agent with the critic's new_instruction. The feedback edge in
  // the React Flow graph animates while this runs.
  const handleFixImprovement = useCallback(
    async (imp: Improvement) => {
      if (imp.agent_to_rerun === 'none') return
      const key = `${imp.type}::${imp.description.slice(0, 40)}`
      setFixingKey(key)
      setFixingAgent(imp.agent_to_rerun)
      setPipelineError(null)
      try {
        if (demoMode) {
          // Mock the rerun for the live demo
          await wait(2400)
        } else if (imp.agent_to_rerun === 'sound-design') {
          // Re-run audio generation on the first silent (or first overall) clip,
          // appending the critic's new_instruction as an extra sounds_needed entry.
          const target =
            state.clips.find(
              (c) => !c.has_audio && !audioReadyFor.has(c.clip_id),
            ) ?? state.clips[0]
          if (!target) throw new Error('No clip available to fix.')
          await generateAudio({
            clip_id: target.clip_id,
            sounds_needed: [...target.sounds_needed, imp.new_instruction],
            ambient_type: target.ambient_type,
            mood: target.mood,
            duration_seconds: target.duration,
          })
          setAudioReadyFor((prev) => new Set(prev).add(target.clip_id))
        } else if (imp.agent_to_rerun === 'music') {
          // Regenerate music with the critic's mood instruction
          const totalDuration = state.clips.reduce(
            (s, c) => s + (c.duration || 0),
            0,
          )
          const fresh = await generateMusic({
            mood: imp.new_instruction,
            duration_seconds: Math.max(totalDuration + 2, 10),
            intensity: /intense|powerful/i.test(imp.new_instruction)
              ? 'intense'
              : /subtle|quiet|gentle/i.test(imp.new_instruction)
                ? 'subtle'
                : 'moderate',
          })
          setState((s) => ({ ...s, musicUrl: fresh.music_url ?? s.musicUrl }))
        } else if (imp.agent_to_rerun === 'assembly') {
          // Re-run assembly with possibly tighter crossfade
          const orderedIds = state.suggestedOrder.length
            ? state.suggestedOrder.filter((id) =>
                state.clips.some((c) => c.clip_id === id),
              )
            : state.clips.map((c) => c.clip_id)
          const tightenCrossfade = /tighten|faster|trim|shorter/i.test(
            imp.new_instruction,
          )
          const fresh = await assembleClips({
            clip_ids: orderedIds,
            music_url: state.musicUrl ?? undefined,
            crossfade_seconds: tightenCrossfade ? 0.3 : 0.5,
          })
          setState((s) => ({
            ...s,
            assembledVideoUrl: fresh.output_url,
          }))
        }
        // Mark this improvement as fixed
        setFixedKeys((prev) => new Set(prev).add(key))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Fix failed.'
        setPipelineError(msg)
      } finally {
        setFixingKey(null)
        setFixingAgent(null)
      }
    },
    [demoMode, state.clips, state.suggestedOrder, state.musicUrl, audioReadyFor],
  )

  const handleSelectClip = (clipId: string) => {
    setState((s) => ({
      ...s,
      selectedClipId: s.selectedClipId === clipId ? null : clipId,
    }))
  }

  const handleClearSelection = () => {
    setState((s) => ({ ...s, selectedClipId: null }))
  }

  const handleReset = () => {
    clearSlowHint()
    setState(INITIAL_STATE)
    setUploadingFiles([])
    setUploadProgress(0)
    setErrorMessage(null)
    setPipelineError(null)
    setGeneratingAudioFor(new Set())
    setAudioReadyFor(new Set())
    setPlaybackOpen(false)
    setDemoMode(false)
    setCritiqueStatus('idle')
    setCritiqueError(null)
    setFixingKey(null)
    setFixedKeys(new Set())
    setFixingAgent(null)
  }

  const handleGenerateAudioForClip = useCallback(
    async (clipId: string) => {
      const clip = state.clips.find((c) => c.clip_id === clipId)
      if (!clip) return
      if (demoMode) {
        setGeneratingAudioFor((prev) => new Set(prev).add(clipId))
        await wait(1400)
        setAudioReadyFor((prev) => new Set(prev).add(clipId))
        setGeneratingAudioFor((prev) => {
          const next = new Set(prev)
          next.delete(clipId)
          return next
        })
        return
      }
      setGeneratingAudioFor((prev) => new Set(prev).add(clipId))
      try {
        await generateAudio({
          clip_id: clip.clip_id,
          sounds_needed: clip.sounds_needed,
          ambient_type: clip.ambient_type,
          mood: clip.mood,
          duration_seconds: clip.duration,
        })
        setAudioReadyFor((prev) => new Set(prev).add(clipId))
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Audio generation unavailable for this clip.'
        setPipelineError(msg)
      } finally {
        setGeneratingAudioFor((prev) => {
          const next = new Set(prev)
          next.delete(clipId)
          return next
        })
      }
    },
    [state.clips, demoMode],
  )

  const handleMakeCoherent = useCallback(async () => {
    if (state.clips.length === 0) return
    setPipelineError(null)

    if (demoMode) {
      // Mocked pipeline with realistic timing for the live demo.
      const silentIds = state.clips
        .filter((c) => !c.has_audio && !audioReadyFor.has(c.clip_id))
        .map((c) => c.clip_id)
      setState((s) => ({ ...s, status: 'generating-audio' }))
      setGeneratingAudioFor(new Set(silentIds))
      await wait(3500)
      setAudioReadyFor((prev) => {
        const next = new Set(prev)
        silentIds.forEach((id) => next.add(id))
        return next
      })
      setGeneratingAudioFor(new Set())

      setState((s) => ({ ...s, status: 'generating-music' }))
      await wait(2800)
      setState((s) => ({ ...s, musicUrl: '/demo_film.mp4' }))

      setState((s) => ({ ...s, status: 'assembling' }))
      await wait(2600)
      setState((s) => ({
        ...s,
        status: 'critiquing',
        assembledVideoUrl: DEMO_ASSEMBLED_VIDEO_URL,
      }))
      // Critic agent (mocked) — use the demo critique
      setCritiqueStatus('running')
      await wait(2400)
      setState((s) => ({ ...s, status: 'complete', critique: DEMO_CRITIQUE }))
      setCritiqueStatus('done')
      return
    }

    const silentClips = state.clips.filter(
      (c) => !c.has_audio && !audioReadyFor.has(c.clip_id),
    )

    armSlowHint(45_000)
    try {
      setState((s) => ({ ...s, status: 'generating-audio' }))
      if (silentClips.length > 0) {
        setGeneratingAudioFor(new Set(silentClips.map((c) => c.clip_id)))
        const results = await Promise.allSettled(
          silentClips.map((c) =>
            generateAudio({
              clip_id: c.clip_id,
              sounds_needed: c.sounds_needed,
              ambient_type: c.ambient_type,
              mood: c.mood,
              duration_seconds: c.duration,
            }),
          ),
        )
        const succeeded = results
          .map((r, i) =>
            r.status === 'fulfilled' ? silentClips[i].clip_id : null,
          )
          .filter((x): x is string => Boolean(x))
        setAudioReadyFor((prev) => {
          const next = new Set(prev)
          succeeded.forEach((id) => next.add(id))
          return next
        })
        setGeneratingAudioFor(new Set())
        const failed = results.length - succeeded.length
        if (failed > 0) {
          setPipelineError(
            `Audio generation unavailable for ${failed} clip${failed > 1 ? 's' : ''}; continuing with the rest.`,
          )
        }
      }

      setState((s) => ({ ...s, status: 'generating-music' }))
      const totalDuration = state.clips.reduce(
        (sum, c) => sum + (c.duration || 0),
        0,
      )
      const mood = dominantMood(state.clips)
      let musicUrl: string | null = null
      try {
        const music = await generateMusic({
          mood,
          duration_seconds: Math.max(totalDuration + 2, 10),
          intensity: 'subtle',
        })
        musicUrl = music.music_url ?? null
        setState((s) => ({ ...s, musicUrl }))
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Music generation skipped.'
        setPipelineError(msg)
      }

      setState((s) => ({ ...s, status: 'assembling' }))
      const orderedIds = state.suggestedOrder.length
        ? state.suggestedOrder.filter((id) =>
            state.clips.some((c) => c.clip_id === id),
          )
        : state.clips.map((c) => c.clip_id)
      const assembly = await assembleClips({
        clip_ids: orderedIds.length
          ? orderedIds
          : state.clips.map((c) => c.clip_id),
        music_url: musicUrl ?? undefined,
        crossfade_seconds: 0.5,
      })

      clearSlowHint()
      setState((s) => ({
        ...s,
        status: 'critiquing',
        assembledVideoUrl: assembly.output_url,
      }))

      // Critic Agent — closes the loop. Sample 5 frames of the assembled film
      // and ask gpt-4o-mini to grade it. Failures are non-fatal.
      setCritiqueStatus('running')
      setCritiqueError(null)
      try {
        const c = await critiqueFilm({
          output_url: assembly.output_url,
          job_id: analyzeJobId ?? undefined,
        })
        setState((s) => ({ ...s, status: 'complete', critique: c }))
        setCritiqueStatus('done')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Critic failed.'
        setCritiqueError(msg)
        setCritiqueStatus('error')
        // Still mark the pipeline as complete — the film is assembled even if
        // the critic couldn't review it.
        setState((s) => ({ ...s, status: 'complete' }))
      }
    } catch (err) {
      clearSlowHint()
      const msg =
        err instanceof Error
          ? err.message
          : 'Assembly failed. Please try again.'
      setPipelineError(msg)
      setGeneratingAudioFor(new Set())
      setState((s) => ({
        ...s,
        status: state.clips.length > 0 ? 'ready' : 'idle',
      }))
    }
  }, [
    state.clips,
    state.suggestedOrder,
    audioReadyFor,
    demoMode,
    armSlowHint,
    clearSlowHint,
  ])

  // Show the upload zone for idle + uploading. The "analyzing" state now
  // shows the React Flow pipeline (full takeover) instead of the dot animation.
  const showUpload = state.status === 'idle' || state.status === 'uploading'

  const isMakeCoherentPhase =
    state.status === 'generating-audio' ||
    state.status === 'generating-music' ||
    state.status === 'assembling' ||
    state.status === 'critiquing'

  // Hold the pipeline on screen briefly when the pipeline reaches "complete"
  // so the user actually SEES every node go green before fading to dashboard.
  const [holdComplete, setHoldComplete] = useState(false)
  useEffect(() => {
    if (state.status === 'complete') {
      setHoldComplete(true)
      const t = setTimeout(() => setHoldComplete(false), 1800)
      return () => clearTimeout(t)
    }
    setHoldComplete(false)
  }, [state.status])

  const showPipeline =
    state.status === 'analyzing' || isMakeCoherentPhase || holdComplete

  return (
    <div className="film-grain min-h-screen bg-rush-bg-primary text-rush-text-primary">
      <AnimatePresence mode="wait">
        {showUpload ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          >
            <UploadZone
              status={state.status}
              onFiles={handleFiles}
              uploadProgress={uploadProgress}
              uploadingFiles={uploadingFiles}
              errorMessage={errorMessage}
              onLoadDemo={loadDemo}
              slowHint={slowHint && state.status === 'analyzing'}
              onRetry={handleReset}
            />
          </motion.div>
        ) : showPipeline ? (
          <motion.div
            key="pipeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="film-grain flex h-screen w-screen flex-col items-center justify-center px-8"
          >
            <div className="mb-6 flex flex-col items-center text-center">
              <h2
                className="font-display font-extrabold text-[#E8C547]"
                style={{ fontSize: 36, letterSpacing: '0.16em' }}
              >
                {state.status === 'analyzing'
                  ? 'ANALYZING'
                  : state.status === 'critiquing'
                  ? "DIRECTOR'S REVIEW"
                  : state.status === 'complete'
                  ? 'COMPLETE'
                  : 'MAKING IT COHERENT'}
              </h2>
              <p className="mt-2 font-body text-[14px] text-rush-text-secondary">
                {state.status === 'analyzing'
                  ? 'Vision AI is reading every frame, scoring quality, and checking continuity across your clips.'
                  : state.status === 'critiquing'
                  ? 'The Critic Agent is screening your assembled film and grading audio, continuity, pacing, and mood.'
                  : state.status === 'complete'
                  ? 'Your film is assembled. Press play in the timeline.'
                  : 'ElevenLabs is generating sound design and music while ffmpeg assembles your film.'}
              </p>
            </div>
            <div style={{ width: 'min(95vw, 1480px)' }}>
              <ProcessingPipeline
                appStatus={state.status}
                totalClips={state.clips.length}
                silentCount={
                  state.clips.filter(
                    (c) => !c.has_audio && !audioReadyFor.has(c.clip_id),
                  ).length
                }
                breakCount={state.continuityBreaks.length}
                missingCount={state.missingShots.length}
                jobId={state.status === 'analyzing' ? analyzeJobId : null}
                fixingAgent={fixingAgent}
              />
            </div>
            {pipelineError && (
              <p className="mt-4 max-w-[600px] text-center font-body text-[12px] text-rush-accent-danger">
                {pipelineError}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="flex h-screen w-screen flex-col"
          >
            {/* Top bar */}
            <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-rush-border px-6">
              <div className="flex items-baseline gap-4">
                <h1
                  className="font-display font-extrabold text-[#E8C547]"
                  style={{ fontSize: 22, letterSpacing: '0.18em' }}
                >
                  RUSHES
                </h1>
                <span className="font-display text-[10px] uppercase tracking-[0.4em] text-rush-text-muted">
                  Cinematic Command Center
                </span>
                {demoMode && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-rush-accent-teal/40 bg-rush-accent-teal/10 px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.25em] text-rush-accent-teal">
                    <Sparkles size={9} />
                    Demo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2 font-mono text-[11px] text-rush-text-secondary">
                  <span>{state.clips.length} clips</span>
                  <span className="text-rush-text-muted">·</span>
                  <span>{state.continuityBreaks.length} breaks</span>
                  <span className="text-rush-text-muted">·</span>
                  <span>{state.missingShots.length} missing</span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-rush-border px-3 font-display text-[11px] font-medium uppercase tracking-[0.18em] text-rush-text-secondary transition-colors hover:border-rush-accent-gold hover:text-rush-accent-gold"
                >
                  <Plus size={12} />
                  Upload More Clips
                </button>
              </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
              <ClipGallery
                clips={state.clips}
                selectedClipId={state.selectedClipId}
                onSelect={handleSelectClip}
              />
              <main className="flex flex-1 flex-col overflow-hidden">
                <AnalysisPanel
                  clips={state.clips}
                  selectedClip={selectedClip}
                  continuityBreaks={state.continuityBreaks}
                  missingShots={state.missingShots}
                  overallCoherenceScore={state.overallCoherenceScore}
                  status={state.status}
                  onClearSelection={handleClearSelection}
                  onMakeCoherent={handleMakeCoherent}
                  onGenerateAudioForClip={handleGenerateAudioForClip}
                  generatingAudioFor={generatingAudioFor}
                  audioReadyFor={audioReadyFor}
                  pipelineError={pipelineError}
                  musicApplied={Boolean(state.musicUrl)}
                  assembledReady={Boolean(state.assembledVideoUrl)}
                  onGenerateShot={handleGenerateShot}
                  shotGenStatus={shotGenStatus}
                  critique={state.critique}
                  critiqueStatus={critiqueStatus}
                  critiqueError={critiqueError}
                  onFixImprovement={handleFixImprovement}
                  fixingKey={fixingKey}
                  fixedKeys={fixedKeys}
                />
                <Timeline
                  clips={state.clips}
                  suggestedOrder={state.suggestedOrder}
                  selectedClipId={state.selectedClipId}
                  onSelect={handleSelectClip}
                  musicUrl={state.musicUrl}
                  musicMood={
                    demoMode ? DEMO_MUSIC_MOOD : dominantMood(state.clips)
                  }
                  assembledVideoUrl={state.assembledVideoUrl}
                  onPlay={() => setPlaybackOpen(true)}
                />
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playback modal */}
      <AnimatePresence>
        {playbackOpen && state.assembledVideoUrl && (
          <motion.div
            key="playback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setPlaybackOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              background: 'rgba(5, 5, 8, 0.85)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[min(90vw,1100px)] overflow-hidden rounded-2xl border border-rush-border bg-black"
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}
            >
              <button
                type="button"
                onClick={() => setPlaybackOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-rush-border bg-black/60 text-rush-text-secondary transition-colors hover:text-rush-accent-gold"
              >
                <X size={16} />
              </button>
              <video
                src={state.assembledVideoUrl}
                controls
                autoPlay
                className="block h-auto w-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
