import { motion } from 'framer-motion'
import {
  Check,
  Copy,
  Film,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import type { MissingShot as MissingShotType } from '../lib/types'

interface Props {
  shot: MissingShotType
  index: number
  onGenerate?: (
    shot: MissingShotType,
    mode: 'image' | 'video',
  ) => Promise<void> | void
  generationStatus?: 'idle' | 'running' | 'done' | 'error'
  generationMessage?: string
}

export default function MissingShot({
  shot,
  index,
  onGenerate,
  generationStatus = 'idle',
  generationMessage,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'image' | 'video'>('image')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shot.suggested_prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  const isRunning = generationStatus === 'running'
  const isDone = generationStatus === 'done'
  const isError = generationStatus === 'error'

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22, delay: index * 0.05 }}
      className="rounded-lg p-3.5"
      style={{
        background: 'rgba(232, 197, 71, 0.06)',
        borderLeft: '3px solid #E8C547',
      }}
    >
      <div className="flex items-start gap-2.5">
        <Film size={14} className="mt-0.5 flex-shrink-0 text-rush-accent-gold" />
        <div className="min-w-0 flex-1">
          <p className="font-body text-[13px] leading-snug text-rush-text-primary">
            {shot.description}
          </p>

          <div className="mt-3">
            <div className="mb-1 font-display text-[10px] uppercase tracking-[0.2em] text-rush-text-secondary">
              Suggested Prompt
            </div>
            <div
              className="relative rounded-md p-2 pr-10 font-mono text-[12px] leading-snug text-rush-accent-gold"
              style={{ background: '#1A1A2E' }}
            >
              {shot.suggested_prompt}
              <button
                type="button"
                onClick={copy}
                className="absolute right-1.5 top-1.5 rounded p-1.5 text-rush-text-secondary transition-colors hover:bg-white/5 hover:text-rush-accent-gold"
                aria-label="Copy prompt"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Generate controls */}
          {onGenerate && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Mode toggle */}
              <div
                className="inline-flex overflow-hidden rounded-md border border-rush-border"
                style={{ background: '#0F0F18' }}
              >
                <button
                  type="button"
                  onClick={() => setMode('image')}
                  disabled={isRunning}
                  className={[
                    'flex items-center gap-1 px-2.5 py-1 font-display text-[10px] font-medium uppercase tracking-wider transition-colors',
                    mode === 'image'
                      ? 'bg-rush-accent-gold/20 text-rush-accent-gold'
                      : 'text-rush-text-secondary hover:text-rush-text-primary',
                  ].join(' ')}
                  title="Generate a 4-second clip from a still image (~5s, fast)"
                >
                  <ImageIcon size={10} />
                  Quick · 5s
                </button>
                <button
                  type="button"
                  onClick={() => setMode('video')}
                  disabled={isRunning}
                  className={[
                    'flex items-center gap-1 px-2.5 py-1 font-display text-[10px] font-medium uppercase tracking-wider transition-colors',
                    mode === 'video'
                      ? 'bg-rush-accent-gold/20 text-rush-accent-gold'
                      : 'text-rush-text-secondary hover:text-rush-text-primary',
                  ].join(' ')}
                  title="Full text-to-video via Runware (~2-3 min)"
                >
                  <Video size={10} />
                  Full Video · ~3 min
                </button>
              </div>

              {/* Generate button */}
              <button
                type="button"
                disabled={isRunning || isDone}
                onClick={() => onGenerate(shot, mode)}
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
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-flex"
                    >
                      <Loader2 size={11} />
                    </motion.span>
                    Generating…
                  </>
                ) : isDone ? (
                  <>
                    <Check size={11} strokeWidth={3} />
                    Added to project
                  </>
                ) : (
                  <>
                    <Sparkles size={11} />
                    Generate Shot
                  </>
                )}
              </button>

              {generationMessage && (
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
                  {generationMessage}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
