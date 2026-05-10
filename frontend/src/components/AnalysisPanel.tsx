import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Film,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  AppStatus,
  ClipAnalysis,
  ContinuityBreak,
  Critique,
  Improvement,
  MissingShot as MissingShotType,
} from '../lib/types'
import ContinuityWarning from './ContinuityWarning'
import DirectorsReview from './DirectorsReview'
import MakeCoherentButton from './MakeCoherentButton'
import MissingShotCard from './MissingShot'
import ScoreCircle from './ScoreCircle'

interface Props {
  clips: ClipAnalysis[]
  selectedClip: ClipAnalysis | null
  continuityBreaks: ContinuityBreak[]
  missingShots: MissingShotType[]
  overallCoherenceScore: number
  status: AppStatus
  onClearSelection: () => void
  onMakeCoherent: () => void
  onGenerateAudioForClip: (clipId: string) => void
  generatingAudioFor: Set<string>
  audioReadyFor: Set<string>
  pipelineError?: string | null
  musicApplied: boolean
  assembledReady: boolean
  onGenerateShot?: (
    shot: MissingShotType,
    mode: 'image' | 'video',
  ) => Promise<void> | void
  shotGenStatus?: Record<
    string,
    { status: 'running' | 'done' | 'error'; message?: string }
  >
  critique: Critique | null
  critiqueStatus: 'idle' | 'running' | 'done' | 'error'
  critiqueError?: string | null
  onFixImprovement?: (improvement: Improvement) => void | Promise<void>
  fixingKey?: string | null
  fixedKeys?: Set<string>
}

interface PolishBreakdown {
  total: number
  audioBonus: number
  musicBonus: number
  transitionsBonus: number
  loudnormBonus: number
  silentFixed: number
}

function computePolish(
  coherenceScore: number,
  silentFixed: number,
  musicApplied: boolean,
  assembledReady: boolean,
  totalClips: number,
): PolishBreakdown {
  const audioBonus = silentFixed * 5
  const musicBonus = musicApplied ? 10 : 0
  const transitionsBonus = assembledReady && totalClips >= 2 ? 5 : 0
  const loudnormBonus = assembledReady ? 5 : 0
  const total = Math.min(
    100,
    coherenceScore + audioBonus + musicBonus + transitionsBonus + loudnormBonus,
  )
  return {
    total,
    audioBonus,
    musicBonus,
    transitionsBonus,
    loudnormBonus,
    silentFixed,
  }
}

function colorForScore(score: number): string {
  if (score >= 80) return '#51CF66'
  if (score >= 60) return '#E8C547'
  return '#FF6B6B'
}

function moodAccent(mood: string): string {
  const m = (mood || '').toLowerCase()
  if (/myster|tense|dark|ominous|suspense/.test(m)) return '#C4B5FD'
  if (/peace|calm|serene|gentle|tranquil/.test(m)) return '#4ECDC4'
  if (/joy|happy|bright|playful|cheerful/.test(m)) return '#E8C547'
  if (/sad|melanchol|somber|wistful/.test(m)) return '#8FB7E0'
  if (/anger|aggress|fier|rage|intens/.test(m)) return '#FF6B6B'
  return '#8B8B9E'
}

function CountUpNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v).toString())
  const [text, setText] = useState('0')
  useEffect(() => {
    const c = animate(mv, value, { duration, ease: 'easeOut' })
    const u = rounded.on('change', (v) => setText(v))
    return () => {
      c.stop()
      u()
    }
  }, [value, duration, mv, rounded])
  return <>{text}</>
}

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div
      className="rounded-[10px] border border-rush-border p-4"
      style={{ background: '#12121A' }}
    >
      <div className="font-display text-[28px] font-bold text-rush-text-primary tabular-nums">
        {value}
      </div>
      <div className="mt-1 font-body text-[12px] text-rush-text-secondary">
        {label}
      </div>
    </div>
  )
}

function SectionHeader({
  icon,
  children,
  trailing,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="flex items-center gap-2 font-display text-[16px] font-bold tracking-wide text-rush-text-primary">
        <span className="text-rush-text-secondary">{icon}</span>
        {children}
      </h3>
      {trailing}
    </div>
  )
}

function OverviewMode({
  clips,
  continuityBreaks,
  missingShots,
  overallCoherenceScore,
  status,
  onMakeCoherent,
  onGenerateAudioForClip,
  generatingAudioFor,
  audioReadyFor,
  pipelineError,
  musicApplied,
  assembledReady,
  onGenerateShot,
  shotGenStatus,
  critique,
  critiqueStatus,
  critiqueError,
  onFixImprovement,
  fixingKey,
  fixedKeys,
}: Omit<Props, 'selectedClip' | 'onClearSelection'>) {
  const total = clips.length
  const withAudio = clips.filter(
    (c) => c.has_audio || audioReadyFor.has(c.clip_id),
  ).length
  const silent = total - withAudio
  const avgQuality =
    total > 0
      ? Math.round(
          clips.reduce((s, c) => s + (c.quality_score || 0), 0) / total,
        )
      : 0
  const scoreColor = colorForScore(overallCoherenceScore)
  const silentClips = clips.filter(
    (c) => !c.has_audio && !audioReadyFor.has(c.clip_id),
  )

  const showPolishHero = status === 'complete' && assembledReady
  const polish = computePolish(
    overallCoherenceScore,
    audioReadyFor.size,
    musicApplied,
    assembledReady,
    total,
  )
  const polishColor = colorForScore(polish.total)

  return (
    <div className="space-y-8">
      {/* Make-coherent button at top */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[20px] font-bold text-rush-text-primary">
            Project Overview
          </h2>
          <p className="mt-1 font-body text-[13px] text-rush-text-secondary">
            Review the analysis, then make your footage coherent in one click.
          </p>
        </div>
        <div className="w-[280px] flex-shrink-0">
          <MakeCoherentButton
            status={status}
            onTrigger={onMakeCoherent}
            errorMessage={pipelineError}
          />
        </div>
      </div>

      {/* Hero score(s) — single Coherence card before Make Coherent;
          dual Source/Polish cards after. */}
      {!showPolishHero ? (
        <div
          className="rounded-2xl border border-rush-border p-8"
          style={{ background: '#12121A' }}
        >
          <div className="text-center">
            <div
              className="font-display font-extrabold tabular-nums"
              style={{ fontSize: 72, color: scoreColor, lineHeight: 1 }}
            >
              <CountUpNumber value={overallCoherenceScore} />
            </div>
            <div className="mt-2 font-body text-[14px] text-rush-text-secondary">
              Coherence Score
            </div>
            <div className="mt-1 font-body text-[11px] text-rush-text-muted">
              measured on your source clips
            </div>
            <div className="mx-auto mt-5 h-1 w-full max-w-md overflow-hidden rounded-full bg-rush-border">
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreColor }}
                initial={{ width: 0 }}
                animate={{ width: `${overallCoherenceScore}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-4"
        >
          {/* LEFT — source coherence */}
          <div
            className="flex flex-col rounded-2xl border border-rush-border p-6 text-center"
            style={{ background: '#12121A' }}
          >
            <div className="font-display text-[10px] uppercase tracking-[0.3em] text-rush-text-muted">
              Source Coherence
            </div>
            <div
              className="mt-2 font-display font-extrabold tabular-nums"
              style={{ fontSize: 56, color: scoreColor, lineHeight: 1 }}
            >
              {overallCoherenceScore}
            </div>
            <div className="mx-auto mt-3 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-rush-border">
              <div
                className="h-full rounded-full"
                style={{
                  background: scoreColor,
                  width: `${overallCoherenceScore}%`,
                }}
              />
            </div>
            <div className="mt-3 font-body text-[11px] text-rush-text-muted">
              {continuityBreaks.length === 0
                ? 'no continuity issues in source'
                : `${continuityBreaks.length} continuity issue${continuityBreaks.length === 1 ? '' : 's'} unchanged`}
            </div>
          </div>

          {/* ARROW */}
          <div className="flex items-center px-2">
            <motion.div
              initial={{ x: -6, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background:
                  'linear-gradient(135deg, rgba(232,197,71,0.25), rgba(78,205,196,0.18))',
                border: '1px solid rgba(232,197,71,0.4)',
              }}
            >
              <ArrowRight size={16} className="text-rush-accent-gold" />
            </motion.div>
          </div>

          {/* RIGHT — production polish */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-col rounded-2xl p-6 text-center"
            style={{
              background:
                'linear-gradient(135deg, rgba(78,205,196,0.08), rgba(232,197,71,0.06))',
              border: `1px solid ${polishColor}55`,
              boxShadow: `0 0 24px ${polishColor}22`,
            }}
          >
            <div className="flex items-center justify-center gap-1 font-display text-[10px] uppercase tracking-[0.3em] text-rush-accent-gold">
              <Sparkles size={11} />
              Production Polish
            </div>
            <div
              className="mt-2 font-display font-extrabold tabular-nums"
              style={{ fontSize: 56, color: polishColor, lineHeight: 1 }}
            >
              <CountUpNumber value={polish.total} duration={1.4} />
            </div>
            <div className="mx-auto mt-3 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-rush-border">
              <motion.div
                className="h-full rounded-full"
                style={{ background: polishColor }}
                initial={{ width: 0 }}
                animate={{ width: `${polish.total}%` }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
              />
            </div>
            <ul className="mt-3 space-y-0.5 font-body text-[11px] text-rush-text-secondary">
              {polish.audioBonus > 0 && (
                <li>
                  <span className="text-rush-accent-success">+{polish.audioBonus}</span>{' '}
                  · sound design on {polish.silentFixed} silent clip
                  {polish.silentFixed === 1 ? '' : 's'}
                </li>
              )}
              {polish.musicBonus > 0 && (
                <li>
                  <span className="text-rush-accent-success">+{polish.musicBonus}</span>{' '}
                  · cinematic music bed
                </li>
              )}
              {polish.transitionsBonus > 0 && (
                <li>
                  <span className="text-rush-accent-success">+{polish.transitionsBonus}</span>{' '}
                  · crossfade transitions
                </li>
              )}
              {polish.loudnormBonus > 0 && (
                <li>
                  <span className="text-rush-accent-success">+{polish.loudnormBonus}</span>{' '}
                  · loudnorm audio levels
                </li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}

      {/* Director's Review (Critic Agent output) — only after assembly */}
      {(critiqueStatus === 'running' || critique) && (
        <DirectorsReview
          critique={critique}
          status={critiqueStatus}
          errorMessage={critiqueError}
          onFix={onFixImprovement}
          fixingKey={fixingKey}
          fixedKeys={fixedKeys}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard value={total} label="Total Clips" />
        <StatCard value={withAudio} label="With Audio" />
        <StatCard value={silent} label="Silent" />
        <StatCard value={`${avgQuality}`} label="Avg Quality" />
      </div>

      {/* Continuity */}
      <section>
        <SectionHeader icon={<AlertTriangle size={14} />}>
          Continuity Issues
          <span className="ml-2 rounded-full border border-rush-border px-1.5 py-0.5 font-mono text-[10px] text-rush-text-secondary">
            {continuityBreaks.length}
          </span>
        </SectionHeader>
        {continuityBreaks.length === 0 ? (
          <div
            className="flex items-center gap-2 rounded-lg border border-rush-accent-success/30 p-3"
            style={{ background: 'rgba(81,207,102,0.06)' }}
          >
            <CheckCircle2 size={14} className="text-rush-accent-success" />
            <span className="font-body text-[13px] text-rush-accent-success">
              No continuity issues detected.
            </span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {continuityBreaks.map((b, i) => (
              <ContinuityWarning
                key={i}
                index={i}
                break_={b}
                clipA={clips[b.clip_a]}
                clipB={clips[b.clip_b]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Missing shots */}
      <section>
        <SectionHeader icon={<Film size={14} />}>
          Missing Shots
          <span className="ml-2 rounded-full border border-rush-border px-1.5 py-0.5 font-mono text-[10px] text-rush-text-secondary">
            {missingShots.length}
          </span>
        </SectionHeader>
        {missingShots.length === 0 ? (
          <div
            className="flex items-center gap-2 rounded-lg border border-rush-accent-success/30 p-3"
            style={{ background: 'rgba(81,207,102,0.06)' }}
          >
            <CheckCircle2 size={14} className="text-rush-accent-success" />
            <span className="font-body text-[13px] text-rush-accent-success">
              The sequence feels complete.
            </span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {missingShots.map((s, i) => {
              const gs = shotGenStatus?.[s.suggested_prompt]
              return (
                <MissingShotCard
                  key={i}
                  index={i}
                  shot={s}
                  onGenerate={onGenerateShot}
                  generationStatus={gs?.status ?? 'idle'}
                  generationMessage={gs?.message}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Audio status */}
      <section>
        <SectionHeader icon={<Volume2 size={14} />}>
          Audio Status
        </SectionHeader>
        <div
          className="rounded-lg border border-rush-border p-4"
          style={{ background: '#12121A' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[14px] font-bold text-rush-text-primary">
                {withAudio} of {total} clips have audio
              </div>
              <div className="mt-0.5 font-body text-[12px] text-rush-text-secondary">
                {silent === 0
                  ? 'Every clip already has a soundtrack.'
                  : 'Generate sound design for the silent clips below, or use Make Coherent.'}
              </div>
            </div>
            <div className="font-mono text-[12px] tabular-nums text-rush-text-secondary">
              {Math.round((withAudio / Math.max(total, 1)) * 100)}%
            </div>
          </div>

          {silentClips.length > 0 && (
            <ul className="mt-4 space-y-2">
              {silentClips.map((c) => {
                const isGen = generatingAudioFor.has(c.clip_id)
                return (
                  <li
                    key={c.clip_id}
                    className="flex items-center justify-between rounded-md border border-rush-border bg-rush-bg-tertiary/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <VolumeX size={13} className="text-rush-accent-danger" />
                      <span className="truncate font-body text-[13px] text-rush-text-primary">
                        {c.filename}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isGen || status === 'generating-audio'}
                      onClick={() => onGenerateAudioForClip(c.clip_id)}
                      className="rounded-md border border-rush-accent-gold/50 bg-rush-accent-gold/10 px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-wider text-rush-accent-gold transition-colors hover:bg-rush-accent-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGen ? 'Working…' : 'Fix Audio'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function DetailMode({
  clip,
  onClearSelection,
  onGenerateAudioForClip,
  generatingAudioFor,
  audioReadyFor,
  status,
}: {
  clip: ClipAnalysis
  onClearSelection: () => void
  onGenerateAudioForClip: (clipId: string) => void
  generatingAudioFor: Set<string>
  audioReadyFor: Set<string>
  status: AppStatus
}) {
  const isGen = generatingAudioFor.has(clip.clip_id)
  const audioReady = clip.has_audio || audioReadyFor.has(clip.clip_id)

  return (
    <motion.div
      key={clip.clip_id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <button
        type="button"
        onClick={onClearSelection}
        className="inline-flex items-center gap-1.5 font-body text-[12px] text-rush-text-secondary transition-colors hover:text-rush-accent-gold"
      >
        <ArrowLeft size={12} />
        Back to Overview
      </button>

      {/* Header */}
      <div className="flex items-start gap-5">
        <div className="aspect-video w-72 flex-shrink-0 overflow-hidden rounded-lg border border-rush-border bg-black">
          <video
            key={clip.video_url}
            src={clip.video_url}
            controls
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <ScoreCircle score={clip.quality_score} size={48} strokeWidth={3} />
            <h2 className="min-w-0 truncate font-display text-[20px] font-bold text-rush-text-primary">
              {clip.filename}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: `${colorForScore(clip.quality_score)}22`,
                color: colorForScore(clip.quality_score),
                border: `1px solid ${colorForScore(clip.quality_score)}55`,
              }}
            >
              Score {clip.quality_score}
            </span>
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: audioReady
                  ? 'rgba(81,207,102,0.14)'
                  : 'rgba(255,107,107,0.14)',
                color: audioReady ? '#51CF66' : '#FF6B6B',
                border: `1px solid ${audioReady ? '#51CF66' : '#FF6B6B'}55`,
              }}
            >
              {audioReady ? <Volume2 size={10} /> : <VolumeX size={10} />}
              {audioReady ? 'Has Audio' : 'Silent'}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-rush-text-muted">
              {clip.resolution} · {clip.duration.toFixed(2)}s
            </span>
          </div>
          <p className="mt-4 font-body text-[14px] italic leading-relaxed text-rush-text-primary">
            {clip.scene_description}
          </p>
        </div>
      </div>

      {/* Tag pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Environment', value: clip.environment, accent: '#8B8B9E' },
          { label: 'Lighting', value: clip.lighting, accent: '#8B8B9E' },
          { label: 'Mood', value: clip.mood, accent: moodAccent(clip.mood) },
          {
            label: 'Color',
            value: clip.color_palette,
            accent: '#8B8B9E',
          },
        ]
          .filter((p) => p.value)
          .map((p) => (
            <div
              key={p.label}
              className="flex items-center gap-2 rounded-full border border-rush-border px-3 py-1"
              style={{
                background: '#1A1A2E',
                borderLeft: `3px solid ${p.accent}`,
              }}
            >
              <span className="font-display text-[10px] uppercase tracking-[0.2em] text-rush-text-muted">
                {p.label}
              </span>
              <span className="font-body text-[12px] text-rush-text-primary">
                {p.value}
              </span>
            </div>
          ))}
      </div>

      {/* Characters */}
      {clip.characters && clip.characters.length > 0 && (
        <section>
          <SectionHeader icon={<User size={14} />}>
            Characters Detected
          </SectionHeader>
          <div className="space-y-2">
            {clip.characters.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-rush-border p-3"
                style={{ background: '#12121A' }}
              >
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-rush-bg-tertiary text-rush-text-secondary">
                  <User size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-body text-[13px] text-rush-text-primary">
                    {c.description}
                  </div>
                  <div className="mt-0.5 font-body text-[12px] text-rush-text-secondary">
                    {c.clothing}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sounds needed */}
      <section>
        <SectionHeader
          icon={<Volume2 size={14} />}
          trailing={
            !audioReady && (
              <button
                type="button"
                disabled={isGen || status === 'generating-audio'}
                onClick={() => onGenerateAudioForClip(clip.clip_id)}
                className="rounded-lg px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-[#0A0A0F] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background:
                    'linear-gradient(135deg, #E8C547 0%, #D4A730 100%)',
                  boxShadow: '0 2px 12px rgba(232,197,71,0.3)',
                }}
              >
                {isGen ? 'Generating…' : 'Generate Audio'}
              </button>
            )
          }
        >
          Sounds Needed
        </SectionHeader>
        {clip.sounds_needed && clip.sounds_needed.length > 0 ? (
          <ul className="space-y-1.5">
            {clip.sounds_needed.map((s, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 rounded-md border border-rush-accent-teal/25 px-3 py-2"
                style={{ background: 'rgba(78,205,196,0.06)' }}
              >
                <Volume2 size={12} className="text-rush-accent-teal" />
                <span className="font-body text-[13px] text-rush-text-primary">
                  {s}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-[13px] text-rush-text-muted">
            No sound suggestions identified.
          </p>
        )}
      </section>

      {/* Quality issues */}
      <section>
        <SectionHeader icon={<AlertTriangle size={14} />}>
          Quality Issues
        </SectionHeader>
        {clip.quality_issues && clip.quality_issues.length > 0 ? (
          <ul className="space-y-1.5">
            {clip.quality_issues.map((q, i) => (
              <li
                key={i}
                className="rounded-md p-2.5 font-body text-[13px] text-rush-accent-danger"
                style={{
                  background: 'rgba(255,107,107,0.06)',
                  borderLeft: '3px solid #FF6B6B',
                }}
              >
                {q}
              </li>
            ))}
          </ul>
        ) : (
          <div
            className="flex items-center gap-2 rounded-lg border border-rush-accent-success/30 p-3"
            style={{ background: 'rgba(81,207,102,0.06)' }}
          >
            <CheckCircle2 size={14} className="text-rush-accent-success" />
            <span className="font-body text-[13px] text-rush-accent-success">
              No quality issues detected.
            </span>
          </div>
        )}
      </section>
    </motion.div>
  )
}

export default function AnalysisPanel(props: Props) {
  const { selectedClip } = props
  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      style={{ background: '#0A0A0F' }}
    >
      {selectedClip ? (
        <DetailMode
          clip={selectedClip}
          onClearSelection={props.onClearSelection}
          onGenerateAudioForClip={props.onGenerateAudioForClip}
          generatingAudioFor={props.generatingAudioFor}
          audioReadyFor={props.audioReadyFor}
          status={props.status}
        />
      ) : (
        <OverviewMode
          clips={props.clips}
          continuityBreaks={props.continuityBreaks}
          missingShots={props.missingShots}
          overallCoherenceScore={props.overallCoherenceScore}
          status={props.status}
          onMakeCoherent={props.onMakeCoherent}
          onGenerateAudioForClip={props.onGenerateAudioForClip}
          generatingAudioFor={props.generatingAudioFor}
          audioReadyFor={props.audioReadyFor}
          pipelineError={props.pipelineError}
          musicApplied={props.musicApplied}
          assembledReady={props.assembledReady}
          onGenerateShot={props.onGenerateShot}
          shotGenStatus={props.shotGenStatus}
          critique={props.critique}
          critiqueStatus={props.critiqueStatus}
          critiqueError={props.critiqueError}
          onFixImprovement={props.onFixImprovement}
          fixingKey={props.fixingKey}
          fixedKeys={props.fixedKeys}
        />
      )}
    </div>
  )
}
