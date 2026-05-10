import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Film,
  Loader2,
  Music,
  Search,
  Sparkles,
  Volume2,
  Wand2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppStatus } from '../lib/types'

interface Props {
  status: AppStatus
  onTrigger: () => void
  errorMessage?: string | null
}

type StepStatus = 'pending' | 'active' | 'done'

interface Step {
  id: 'analyze' | 'continuity' | 'audio' | 'music' | 'assemble'
  label: string
  icon: ReactNode
}

const STEPS: Step[] = [
  { id: 'analyze', label: 'Analyzing footage...', icon: <Wand2 size={14} /> },
  {
    id: 'continuity',
    label: 'Detecting continuity issues...',
    icon: <Search size={14} />,
  },
  {
    id: 'audio',
    label: 'Generating sound design...',
    icon: <Volume2 size={14} />,
  },
  { id: 'music', label: 'Creating music bed...', icon: <Music size={14} /> },
  {
    id: 'assemble',
    label: 'Assembling your film...',
    icon: <Film size={14} />,
  },
]

function statusFor(stepId: Step['id'], app: AppStatus): StepStatus {
  if (stepId === 'analyze' || stepId === 'continuity') {
    if (
      app === 'ready' ||
      app === 'generating-audio' ||
      app === 'generating-music' ||
      app === 'assembling' ||
      app === 'complete'
    )
      return 'done'
    return 'pending'
  }
  if (stepId === 'audio') {
    if (app === 'generating-audio') return 'active'
    if (
      app === 'generating-music' ||
      app === 'assembling' ||
      app === 'complete'
    )
      return 'done'
    return 'pending'
  }
  if (stepId === 'music') {
    if (app === 'generating-music') return 'active'
    if (app === 'assembling' || app === 'complete') return 'done'
    return 'pending'
  }
  if (stepId === 'assemble') {
    if (app === 'assembling') return 'active'
    if (app === 'complete') return 'done'
    return 'pending'
  }
  return 'pending'
}

export default function MakeCoherentButton({
  status,
  onTrigger,
  errorMessage,
}: Props) {
  const isProcessing =
    status === 'generating-audio' ||
    status === 'generating-music' ||
    status === 'assembling'

  const isComplete = status === 'complete'
  const isReady = status === 'ready'

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" initial={false}>
        {isReady && (
          <motion.button
            key="idle"
            type="button"
            onClick={onTrigger}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.99 }}
            className="group relative flex h-[52px] w-full min-w-[240px] items-center justify-center gap-2 overflow-hidden rounded-xl px-6 font-display text-[16px] font-bold uppercase tracking-[0.18em] text-[#0A0A0F]"
            style={{
              background: 'linear-gradient(135deg, #E8C547 0%, #D4A730 100%)',
              boxShadow: '0 4px 20px rgba(232, 197, 71, 0.3)',
              cursor: 'pointer',
            }}
          >
            <motion.span
              aria-hidden
              className="absolute inset-0"
              animate={{
                boxShadow: [
                  '0 0 0px rgba(232,197,71,0)',
                  '0 0 30px rgba(232,197,71,0.45)',
                  '0 0 0px rgba(232,197,71,0)',
                ],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ borderRadius: 12, pointerEvents: 'none' }}
            />
            <Sparkles size={16} className="relative z-10" />
            <span className="relative z-10">Make Coherent</span>
          </motion.button>
        )}

        {isProcessing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-rush-accent-gold/40 px-5 py-4"
            style={{
              background:
                'linear-gradient(135deg, rgba(232,197,71,0.08), rgba(78,205,196,0.04))',
            }}
          >
            <div className="mb-3 flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.3em] text-rush-accent-gold">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="inline-flex"
              >
                <Loader2 size={12} />
              </motion.span>
              Making it coherent
            </div>
            <ol className="space-y-1.5">
              {STEPS.map((step) => {
                const ss = statusFor(step.id, status)
                return (
                  <li
                    key={step.id}
                    className="flex items-center gap-2.5 font-body text-[13px]"
                  >
                    <span
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        background:
                          ss === 'done'
                            ? 'rgba(81, 207, 102, 0.16)'
                            : ss === 'active'
                            ? 'rgba(232, 197, 71, 0.2)'
                            : 'rgba(90, 90, 110, 0.18)',
                        color:
                          ss === 'done'
                            ? '#51CF66'
                            : ss === 'active'
                            ? '#E8C547'
                            : '#5A5A6E',
                      }}
                    >
                      {ss === 'done' ? (
                        <Check size={11} />
                      ) : ss === 'active' ? (
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1.4,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                          className="inline-flex"
                        >
                          <Loader2 size={11} />
                        </motion.span>
                      ) : (
                        step.icon
                      )}
                    </span>
                    <span
                      className={
                        ss === 'pending'
                          ? 'text-rush-text-muted'
                          : ss === 'done'
                          ? 'text-rush-text-secondary line-through decoration-rush-text-muted/40'
                          : 'text-rush-text-primary'
                      }
                    >
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </motion.div>
        )}

        {isComplete && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="flex h-[52px] w-full min-w-[240px] items-center justify-center gap-2 rounded-xl font-display text-[15px] font-bold uppercase tracking-[0.18em] text-[#0A0A0F]"
            style={{
              background: 'linear-gradient(135deg, #51CF66, #2DB94A)',
              boxShadow: '0 4px 20px rgba(81, 207, 102, 0.35)',
            }}
          >
            <Check size={18} strokeWidth={3} />
            Film Coherent
          </motion.div>
        )}
      </AnimatePresence>
      {errorMessage && (
        <p className="mt-2 font-body text-[12px] text-rush-accent-danger">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
