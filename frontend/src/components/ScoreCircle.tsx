import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useState } from 'react'

interface Props {
  score: number
  size?: number
  strokeWidth?: number
}

function colorForScore(score: number): string {
  if (score >= 80) return '#51CF66'
  if (score >= 60) return '#E8C547'
  return '#FF6B6B'
}

export default function ScoreCircle({
  score,
  size = 40,
  strokeWidth = 3,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const color = colorForScore(clamped)

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const targetOffset = circumference * (1 - clamped / 100)

  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v).toString())
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    const controls = animate(count, clamped, {
      duration: 1,
      ease: 'easeOut',
    })
    const unsubscribe = rounded.on('change', (v) => setDisplay(v))
    return () => {
      controls.stop()
      unsubscribe()
    }
  }, [clamped, count, rounded])

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        style={{ filter: `drop-shadow(0 0 6px ${color}33)` }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2A2A3E"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: targetOffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span
        className="absolute font-mono font-bold tabular-nums"
        style={{ color, fontSize: size * 0.3 }}
      >
        {display}
      </span>
    </div>
  )
}
