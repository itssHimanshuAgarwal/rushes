import { motion } from 'framer-motion'
import {
  Award,
  Check,
  Clapperboard,
  Loader2,
  Music,
  Paintbrush,
  Volume2,
  Wand2,
} from 'lucide-react'
import type { Critique, FixableAgent, Improvement } from '../lib/types'

interface Props {
  critique: Critique | null
  status: 'idle' | 'running' | 'done' | 'error'
  errorMessage?: string | null
  onFix?: (improvement: Improvement) => void | Promise<void>
  fixingKey?: string | null
  fixedKeys?: Set<string>
}

function colorForScore(score: number): string {
  if (score >= 80) return '#51CF66'
  if (score >= 60) return '#E8C547'
  return '#FF6B6B'
}

const TYPE_ICON: Record<Improvement['type'], typeof Volume2> = {
  audio: Volume2,
  visual: Paintbrush,
  pacing: Clapperboard,
  mood: Music,
}

function AgentTag({ agent }: { agent: FixableAgent }) {
  if (agent === 'none') {
    return (
      <span className="rounded border border-rush-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-rush-text-muted">
        manual
      </span>
    )
  }
  return (
    <span className="rounded border border-rush-accent-gold/40 bg-rush-accent-gold/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-rush-accent-gold">
      → {agent}
    </span>
  )
}

function SubScoreBar({
  label,
  score,
  notes,
}: {
  label: string
  score: number
  notes: string
}) {
  const color = colorForScore(score)
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[10px] uppercase tracking-[0.22em] text-rush-text-secondary">
          {label}
        </span>
        <span
          className="font-mono text-[14px] font-bold tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-rush-border">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
        />
      </div>
      <p className="mt-1.5 font-body text-[12px] leading-snug text-rush-text-secondary">
        {notes}
      </p>
    </div>
  )
}

export default function DirectorsReview({
  critique,
  status,
  errorMessage,
  onFix,
  fixingKey,
  fixedKeys,
}: Props) {
  if (status === 'running') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-rush-border p-6"
        style={{
          background:
            'linear-gradient(135deg, rgba(232,197,71,0.08), rgba(78,205,196,0.04))',
        }}
      >
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            className="inline-flex"
          >
            <Loader2 size={18} className="text-rush-accent-gold" />
          </motion.span>
          <div>
            <div className="font-display text-[14px] font-bold uppercase tracking-[0.18em] text-rush-accent-gold">
              Director is reviewing the cut…
            </div>
            <div className="mt-1 font-body text-[12px] text-rush-text-secondary">
              The Critic Agent is sampling 5 keyframes and grading audio,
              continuity, pacing, and mood coherence.
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (status === 'error') {
    return (
      <div
        className="rounded-2xl border border-rush-accent-danger/40 p-4 text-[13px] text-rush-accent-danger"
        style={{ background: 'rgba(255,107,107,0.06)' }}
      >
        Critic failed: {errorMessage ?? 'unknown error.'}
      </div>
    )
  }

  if (!critique) return null

  const overallColor = colorForScore(critique.overall_score)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border p-6"
      style={{
        background:
          'linear-gradient(135deg, rgba(232,197,71,0.06) 0%, rgba(255,149,0,0.04) 100%)',
        borderColor: 'rgba(232,197,71,0.35)',
        boxShadow: '0 0 24px rgba(232,197,71,0.12)',
      }}
    >
      <div className="flex items-start gap-5">
        {/* Big score */}
        <div className="flex flex-col items-center">
          <div
            className="font-display font-extrabold tabular-nums"
            style={{ fontSize: 56, color: overallColor, lineHeight: 1 }}
          >
            {critique.overall_score}
          </div>
          <div className="mt-1 font-display text-[10px] uppercase tracking-[0.25em] text-rush-text-secondary">
            Director's Score
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.25em] text-rush-accent-gold">
            <Award size={14} />
            Director's Review
          </div>
          <p className="mt-2 font-body text-[14px] italic leading-snug text-rush-text-primary">
            “{critique.verdict}”
          </p>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
        <SubScoreBar
          label="Audio Quality"
          score={critique.audio_quality.score}
          notes={critique.audio_quality.notes}
        />
        <SubScoreBar
          label="Visual Continuity"
          score={critique.visual_continuity.score}
          notes={critique.visual_continuity.notes}
        />
        <SubScoreBar
          label="Pacing"
          score={critique.pacing.score}
          notes={critique.pacing.notes}
        />
        <SubScoreBar
          label="Mood Coherence"
          score={critique.mood_coherence.score}
          notes={critique.mood_coherence.notes}
        />
      </div>

      {/* Improvements */}
      {critique.improvements.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.25em] text-rush-text-secondary">
            <Wand2 size={12} />
            Improvements · {critique.improvements.length}
          </div>
          <div className="space-y-2.5">
            {critique.improvements.map((imp, i) => {
              const Icon = TYPE_ICON[imp.type] ?? Wand2
              const fixable = imp.agent_to_rerun !== 'none'
              const key = `${imp.type}::${imp.description.slice(0, 40)}`
              const isFixing = fixingKey === key
              const isFixed = fixedKeys?.has(key)

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-lg border border-rush-border p-3.5"
                  style={{ background: '#12121A' }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: 'rgba(232,197,71,0.12)',
                        color: '#E8C547',
                      }}
                    >
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-display text-[10px] uppercase tracking-[0.22em] text-rush-text-secondary">
                          {imp.type}
                        </span>
                        <AgentTag agent={imp.agent_to_rerun} />
                      </div>
                      <p className="font-body text-[13px] text-rush-text-primary">
                        {imp.description}
                      </p>
                      <p className="mt-1.5 font-mono text-[11px] leading-snug text-rush-accent-gold/80">
                        ↺ {imp.new_instruction}
                      </p>
                    </div>
                    {fixable && (
                      <button
                        type="button"
                        disabled={isFixing || isFixed || !onFix}
                        onClick={() => onFix?.(imp)}
                        className="flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-[#0A0A0F] transition-all disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          background: isFixed
                            ? 'linear-gradient(135deg, #51CF66, #2DB94A)'
                            : 'linear-gradient(135deg, #FF9500, #E8C547)',
                          boxShadow: isFixed
                            ? '0 0 14px rgba(81,207,102,0.3)'
                            : '0 0 14px rgba(255,149,0,0.25)',
                        }}
                      >
                        {isFixing ? (
                          <>
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: 'linear',
                              }}
                              className="inline-flex"
                            >
                              <Loader2 size={10} />
                            </motion.span>
                            Fixing
                          </>
                        ) : isFixed ? (
                          <>
                            <Check size={11} strokeWidth={3} />
                            Fixed
                          </>
                        ) : (
                          'Fix This'
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </motion.section>
  )
}
