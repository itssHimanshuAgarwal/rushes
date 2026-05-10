import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import type { ClipAnalysis, ContinuityBreak } from '../lib/types'

interface Props {
  break_: ContinuityBreak
  clipA?: ClipAnalysis
  clipB?: ClipAnalysis
  index: number
  onRegenerate?: (
    breakItem: ContinuityBreak,
    mode: 'image' | 'video',
  ) => Promise<void> | void
  regenerationStatus?: 'idle' | 'running' | 'done' | 'error'
  regenerationMessage?: string
}

const SEVERITY_COLOR: Record<string, string> = {
  high: '#FF6B6B',
  medium: '#E8C547',
  low: '#8B8B9E',
}

export default function ContinuityWarning({
  break_,
  clipA,
  clipB,
  index,
  onRegenerate,
  regenerationStatus = 'idle',
  regenerationMessage,
}: Props) {
  const color = SEVERITY_COLOR[break_.severity] ?? '#FF6B6B'
  const labelA = clipA ? clipA.filename : `Clip ${break_.clip_a + 1}`
  const labelB = clipB ? clipB.filename : `Clip ${break_.clip_b + 1}`

  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'image' | 'video'>('image')

  const hasFix = Boolean(break_.corrected_prompt && break_.fix_clip_id)

  const copyPrompt = async () => {
    if (!break_.corrected_prompt) return
    try {
      await navigator.clipboard.writeText(break_.corrected_prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  const isRunning = regenerationStatus === 'running'
  const isDone = regenerationStatus === 'done'
  const isError = regenerationStatus === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22, delay: index * 0.05 }}
      className="rounded-lg p-3.5"
      style={{
        background: 'rgba(255, 107, 107, 0.08)',
        borderLeft: '3px solid #FF6B6B',
      }}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-rush-accent-danger" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate font-body text-[13px] font-semibold text-rush-accent-danger">
              {labelA} <span className="text-rush-text-muted">↔</span> {labelB}
            </div>
            <span
              className="flex-shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: `${color}22`,
                color,
                border: `1px solid ${color}55`,
              }}
            >
              {break_.severity}
            </span>
          </div>
          <p className="mt-1 font-body text-[13px] leading-snug text-rush-text-primary">
            {break_.issue}
          </p>

          {hasFix && (
            <>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-display text-[10px] uppercase tracking-[0.2em] text-rush-text-secondary">
                    Corrected prompt
                  </span>
                  {clipB && break_.fix_clip_id && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-rush-text-muted">
                      will replace {clipB.filename.slice(0, 24)}
                      {clipB.filename.length > 24 ? '…' : ''}
                    </span>
                  )}
                </div>
                <div
                  className="relative rounded-md p-2 pr-10 font-mono text-[12px] leading-snug text-rush-accent-gold"
                  style={{ background: '#1A1A2E' }}
                >
                  {break_.corrected_prompt}
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="absolute right-1.5 top-1.5 rounded p-1.5 text-rush-text-secondary transition-colors hover:bg-white/5 hover:text-rush-accent-gold"
                    aria-label="Copy corrected prompt"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {/* Regenerate controls */}
              {onRegenerate && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* Mode toggle */}
                  <div
                    className="inline-flex overflow-hidden rounded-md border border-rush-border"
                    style={{ background: '#0F0F18' }}
                  >
                    <button
                      type="button"
                      onClick={() => setMode('image')}
                      disabled={isRunning || isDone}
                      className={[
                        'flex items-center gap-1 px-2.5 py-1 font-display text-[10px] font-medium uppercase tracking-wider transition-colors',
                        mode === 'image'
                          ? 'bg-rush-accent-gold/20 text-rush-accent-gold'
                          : 'text-rush-text-secondary hover:text-rush-text-primary',
                      ].join(' ')}
                      title="Regenerate as 8s Ken Burns clip from a still image (~5s render)"
                    >
                      <ImageIcon size={10} />
                      Quick · 8s
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('video')}
                      disabled={isRunning || isDone}
                      className={[
                        'flex items-center gap-1 px-2.5 py-1 font-display text-[10px] font-medium uppercase tracking-wider transition-colors',
                        mode === 'video'
                          ? 'bg-rush-accent-gold/20 text-rush-accent-gold'
                          : 'text-rush-text-secondary hover:text-rush-text-primary',
                      ].join(' ')}
                      title="Regenerate as full Kling 2.5 video (~90-120s)"
                    >
                      <Video size={10} />
                      Full · ~2 min
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isRunning || isDone}
                    onClick={() => onRegenerate(break_, mode)}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-[#0A0A0F] transition-all disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background:
                        'linear-gradient(135deg, #E8C547 0%, #D4A730 100%)',
                      boxShadow: '0 2px 12px rgba(232,197,71,0.25)',
                    }}
                  >
                    {isRunning ? (
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
                          <Loader2 size={11} />
                        </motion.span>
                        Regenerating…
                      </>
                    ) : isDone ? (
                      <>
                        <Check size={11} strokeWidth={3} />
                        Replaced
                      </>
                    ) : (
                      <>
                        <Sparkles size={11} />
                        Regenerate with Runware
                      </>
                    )}
                  </button>

                  {regenerationMessage && (
                    <span
                      className="font-mono text-[10px] tabular-nums"
                      style={{
                        color: isError
                          ? '#FF6B6B'
                          : isDone
                          ? '#51CF66'
                          : '#E8C547',
                      }}
                    >
                      {regenerationMessage}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
