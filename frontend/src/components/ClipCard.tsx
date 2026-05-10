import { motion } from 'framer-motion'
import { Volume2, VolumeX } from 'lucide-react'
import type { ClipAnalysis } from '../lib/types'
import ScoreCircle from './ScoreCircle'

interface Props {
  clip: ClipAnalysis
  selected: boolean
  onSelect: (clipId: string) => void
  index: number
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function moodPillStyle(mood: string): { bg: string; fg: string } {
  const m = (mood || '').toLowerCase()
  if (/myster|tense|dark|ominous|suspense/.test(m))
    return { bg: 'rgba(139, 92, 246, 0.18)', fg: '#C4B5FD' }
  if (/peace|calm|serene|gentle|tranquil/.test(m))
    return { bg: 'rgba(78, 205, 196, 0.18)', fg: '#4ECDC4' }
  if (/joy|happy|bright|playful|cheerful/.test(m))
    return { bg: 'rgba(232, 197, 71, 0.18)', fg: '#E8C547' }
  if (/sad|melanchol|somber|wistful/.test(m))
    return { bg: 'rgba(90, 143, 181, 0.22)', fg: '#8FB7E0' }
  if (/anger|aggress|fier|rage|intens/.test(m))
    return { bg: 'rgba(255, 107, 107, 0.18)', fg: '#FF8A8A' }
  return { bg: 'rgba(90, 90, 110, 0.25)', fg: '#B0B0C2' }
}

export default function ClipCard({ clip, selected, onSelect, index }: Props) {
  const mood = moodPillStyle(clip.mood)

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(clip.clip_id)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 280,
        damping: 26,
        delay: index * 0.05,
      }}
      whileHover={{ scale: 1.02 }}
      className={[
        'group relative block w-full overflow-hidden rounded-xl text-left',
        'transition-[border-color,box-shadow] duration-200',
        'cursor-pointer',
        selected
          ? 'border-2 border-[#E8C547] shadow-[0_0_24px_rgba(232,197,71,0.25)]'
          : 'border border-[#2A2A3E] hover:border-[#E8C547] hover:shadow-[0_0_20px_rgba(232,197,71,0.10)]',
      ].join(' ')}
      style={{ background: '#1A1A2E' }}
    >
      {/* Thumbnail area: 16:9 */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: '16 / 9',
          backgroundImage: `url(${clip.thumbnail_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#0A0A0F',
        }}
      >
        {/* Bottom gradient for legibility */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, transparent 55%, rgba(10,10,15,0.85) 100%)',
          }}
        />

        {/* Score badge */}
        <div className="absolute right-2 top-2">
          <ScoreCircle score={clip.quality_score} size={40} />
        </div>

        {/* Duration pill */}
        <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
          <span className="font-mono text-[11px] font-medium text-white tabular-nums">
            {formatDuration(clip.duration)}
          </span>
        </div>

        {/* Audio indicator */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
          {clip.has_audio ? (
            <>
              <span className="block h-1.5 w-1.5 rounded-full bg-[#51CF66]" />
              <Volume2 size={10} className="text-[#51CF66]" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#51CF66]">
                Audio
              </span>
            </>
          ) : (
            <>
              <motion.span
                className="block h-1.5 w-1.5 rounded-full bg-[#FF6B6B]"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <VolumeX size={10} className="text-[#FF6B6B]" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#FF6B6B]">
                Silent
              </span>
            </>
          )}
        </div>
      </div>

      {/* Info section */}
      <div className="px-3 py-2.5">
        <div className="truncate font-body text-[13px] font-medium text-rush-text-primary">
          {clip.filename}
        </div>
        <div className="mt-0.5 truncate font-body text-[11px] text-rush-text-secondary">
          {clip.scene_description || '—'}
        </div>
        {clip.mood && (
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{ background: mood.bg, color: mood.fg }}
            >
              {clip.mood.split(/[,.]/)[0].trim()}
            </span>
            {clip.resolution && (
              <span className="font-mono text-[10px] text-rush-text-muted">
                {clip.resolution}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  )
}
