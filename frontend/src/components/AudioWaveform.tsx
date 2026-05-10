import { motion } from 'framer-motion'

interface Props {
  active?: boolean
  bars?: number
  height?: number
  color?: string
}

const SEED = [
  0.55, 0.42, 0.78, 0.36, 0.62, 0.49, 0.83, 0.31, 0.68, 0.4, 0.73, 0.45,
  0.58, 0.5, 0.79, 0.36, 0.61, 0.47, 0.7, 0.42, 0.59, 0.51, 0.74, 0.34,
  0.66, 0.45, 0.81, 0.38, 0.6, 0.5, 0.71, 0.44,
]

export default function AudioWaveform({
  active = false,
  bars = 64,
  height = 28,
  color = '#4ECDC4',
}: Props) {
  return (
    <div
      className="flex w-full items-end gap-[2px]"
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const base = SEED[i % SEED.length]
        return (
          <motion.span
            key={i}
            className="block flex-1 rounded-[1px]"
            style={{
              background: color,
              opacity: active ? 0.85 : 0.35,
            }}
            animate={
              active
                ? { height: [`${base * 60}%`, `${base * 100}%`, `${base * 50}%`] }
                : { height: `${base * 70}%` }
            }
            transition={
              active
                ? {
                    duration: 1.2 + (i % 5) * 0.1,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    ease: 'easeInOut',
                    delay: (i % 7) * 0.05,
                  }
                : { duration: 0.4 }
            }
          />
        )
      })}
    </div>
  )
}
