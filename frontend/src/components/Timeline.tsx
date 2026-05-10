import { motion } from 'framer-motion'
import { ChevronRight, Download, Music, Play } from 'lucide-react'
import type { ClipAnalysis } from '../lib/types'
import AudioWaveform from './AudioWaveform'

interface Props {
  clips: ClipAnalysis[]
  suggestedOrder: string[]
  selectedClipId: string | null
  onSelect: (clipId: string) => void
  musicUrl: string | null
  musicMood: string | null
  assembledVideoUrl: string | null
  onPlay: () => void
}

export default function Timeline({
  clips,
  suggestedOrder,
  selectedClipId,
  onSelect,
  musicUrl,
  musicMood,
  assembledVideoUrl,
  onPlay,
}: Props) {
  const ordered = suggestedOrder.length
    ? suggestedOrder
        .map((id) => clips.find((c) => c.clip_id === id))
        .filter((c): c is ClipAnalysis => Boolean(c))
    : clips

  if (ordered.length === 0) return null

  const canPlay = Boolean(assembledVideoUrl)

  return (
    <div
      className="flex h-[160px] flex-shrink-0 flex-col border-t border-rush-border px-5 py-3"
      style={{ background: '#12121A' }}
    >
      {/* Top label row */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[14px] font-bold tracking-wide text-rush-text-primary">
            Timeline
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-rush-text-muted">
            Suggested order · {ordered.length} clips
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            disabled={!canPlay}
            onClick={onPlay}
            whileHover={canPlay ? { scale: 1.05 } : {}}
            whileTap={canPlay ? { scale: 0.97 } : {}}
            className="flex h-9 w-9 items-center justify-center rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              borderColor: canPlay ? '#E8C547' : '#2A2A3E',
              boxShadow: canPlay
                ? '0 0 16px rgba(232,197,71,0.45)'
                : 'none',
              background: canPlay ? 'rgba(232,197,71,0.08)' : 'transparent',
            }}
            aria-label="Play assembled film"
          >
            <Play
              size={13}
              className={canPlay ? 'text-rush-accent-gold' : 'text-rush-text-muted'}
              fill={canPlay ? '#E8C547' : 'transparent'}
            />
          </motion.button>
          <a
            href={canPlay ? (assembledVideoUrl ?? '#') : undefined}
            download={canPlay ? 'rushes-final.mp4' : undefined}
            aria-disabled={!canPlay}
            onClick={(e) => {
              if (!canPlay) e.preventDefault()
            }}
            className={[
              'flex h-9 items-center gap-1.5 rounded-lg px-3 font-display text-[11px] font-bold uppercase tracking-[0.18em] transition-all',
              canPlay
                ? 'text-[#0A0A0F]'
                : 'cursor-not-allowed text-rush-text-muted',
            ].join(' ')}
            style={{
              background: canPlay
                ? 'linear-gradient(135deg, #E8C547 0%, #D4A730 100%)'
                : 'transparent',
              border: canPlay ? 'none' : '1px solid #2A2A3E',
              boxShadow: canPlay ? '0 4px 16px rgba(232,197,71,0.25)' : 'none',
              opacity: canPlay ? 1 : 0.5,
            }}
          >
            <Download size={12} strokeWidth={canPlay ? 2.5 : 2} />
            Export
          </a>
        </div>
      </div>

      {/* Clip strip */}
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-1">
        {ordered.map((clip, i) => {
          const selected = clip.clip_id === selectedClipId
          return (
            <div key={clip.clip_id} className="flex flex-shrink-0 items-center">
              <motion.button
                type="button"
                onClick={() => onSelect(clip.clip_id)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className={[
                  'relative flex flex-shrink-0 overflow-hidden rounded',
                  'transition-shadow duration-200',
                  selected
                    ? 'ring-2 ring-[#E8C547] shadow-[0_0_18px_rgba(232,197,71,0.4)]'
                    : 'ring-1 ring-rush-border hover:ring-[#E8C547]/60',
                ].join(' ')}
                style={{
                  width: 60,
                  height: 34,
                  background: clip.thumbnail_url
                    ? `url(${clip.thumbnail_url}) center/cover`
                    : '#1A1A2E',
                  cursor: 'pointer',
                }}
              >
                <div className="absolute left-0.5 top-0.5 rounded-sm bg-black/70 px-1 font-mono text-[8px] font-bold text-rush-accent-gold">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-0.5">
                  <div className="text-right font-mono text-[7px] text-white/90 tabular-nums">
                    {clip.duration.toFixed(1)}s
                  </div>
                </div>
              </motion.button>
              {i < ordered.length - 1 && (
                <ChevronRight size={12} className="mx-0.5 text-rush-text-muted" />
              )}
            </div>
          )
        })}
      </div>

      {/* Music bar + waveform */}
      <div className="mt-2 space-y-1">
        <div
          className="flex h-5 items-center gap-2 overflow-hidden rounded px-2 font-display text-[10px] uppercase tracking-[0.2em]"
          style={{
            background: musicUrl
              ? 'linear-gradient(90deg, rgba(232,197,71,0.18) 0%, rgba(232,197,71,0.06) 100%)'
              : 'rgba(42,42,62,0.4)',
            border: `1px solid ${musicUrl ? 'rgba(232,197,71,0.4)' : '#2A2A3E'}`,
            color: musicUrl ? '#E8C547' : '#5A5A6E',
          }}
        >
          <Music size={10} />
          {musicUrl ? (
            <span>
              Music · {musicMood ?? 'cinematic'}
            </span>
          ) : (
            <span>No music bed yet</span>
          )}
        </div>
        <AudioWaveform
          active={Boolean(assembledVideoUrl)}
          bars={80}
          height={20}
          color={assembledVideoUrl ? '#4ECDC4' : '#2A2A3E'}
        />
      </div>
    </div>
  )
}
