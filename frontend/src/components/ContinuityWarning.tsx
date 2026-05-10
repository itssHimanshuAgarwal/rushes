import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import type { ClipAnalysis, ContinuityBreak } from '../lib/types'

interface Props {
  break_: ContinuityBreak
  clipA?: ClipAnalysis
  clipB?: ClipAnalysis
  index: number
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
}: Props) {
  const color = SEVERITY_COLOR[break_.severity] ?? '#FF6B6B'
  const labelA = clipA ? clipA.filename : `Clip ${break_.clip_a + 1}`
  const labelB = clipB ? clipB.filename : `Clip ${break_.clip_b + 1}`

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
        </div>
      </div>
    </motion.div>
  )
}
