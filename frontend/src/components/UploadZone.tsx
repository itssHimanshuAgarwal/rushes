import { AnimatePresence, motion } from 'framer-motion'
import { Clapperboard } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { AppStatus } from '../lib/types'

interface Props {
  status: AppStatus
  onFiles: (files: File[]) => void
  uploadProgress: number
  uploadingFiles: { name: string; size: number }[]
  errorMessage?: string | null
  onLoadDemo?: () => void
  slowHint?: boolean
  onRetry?: () => void
}

// ---------- Floating particles ----------

interface Particle {
  id: number
  left: number
  delay: number
  duration: number
  size: number
  opacity: number
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: 6 + Math.random() * 8,
    size: 1 + Math.random() * 2,
    opacity: 0.1 + Math.random() * 0.3,
  }))
}

function FloatingParticles({ particles, accelerated }: { particles: Particle[]; accelerated: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
      }}
      aria-hidden
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            bottom: '-5%',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `rgba(232, 197, 71, ${p.opacity})`,
            filter: 'blur(0.3px)',
          }}
          animate={{
            y: [0, -1200],
            opacity: [0, p.opacity, p.opacity, 0],
          }}
          transition={{
            duration: accelerated ? p.duration * 0.5 : p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  )
}

// ---------- Corner brackets (cinematic viewfinder) ----------

function CornerBrackets({ active }: { active: boolean }) {
  const color = active ? 'rgba(232,197,71,0.7)' : 'rgba(232,197,71,0.35)'
  const size = 18
  const t = 2
  const off = -1
  const corners: Array<[string, string, React.CSSProperties]> = [
    [
      'top-left',
      'TL',
      {
        top: off,
        left: off,
        borderTop: `${t}px solid ${color}`,
        borderLeft: `${t}px solid ${color}`,
        borderRadius: '4px 0 0 0',
      },
    ],
    [
      'top-right',
      'TR',
      {
        top: off,
        right: off,
        borderTop: `${t}px solid ${color}`,
        borderRight: `${t}px solid ${color}`,
        borderRadius: '0 4px 0 0',
      },
    ],
    [
      'bottom-left',
      'BL',
      {
        bottom: off,
        left: off,
        borderBottom: `${t}px solid ${color}`,
        borderLeft: `${t}px solid ${color}`,
        borderRadius: '0 0 0 4px',
      },
    ],
    [
      'bottom-right',
      'BR',
      {
        bottom: off,
        right: off,
        borderBottom: `${t}px solid ${color}`,
        borderRight: `${t}px solid ${color}`,
        borderRadius: '0 0 4px 0',
      },
    ],
  ]
  return (
    <>
      {corners.map(([key, , style]) => (
        <div
          key={key}
          aria-hidden
          style={{
            position: 'absolute',
            width: size,
            height: size,
            transition: 'border-color 0.25s ease',
            ...style,
          }}
        />
      ))}
    </>
  )
}

// ---------- Helpers ----------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SPONSORS = ['ElevenLabs', 'Runware', 'Vercel', 'Cursor']

// ---------- Main component ----------

export default function UploadZone({
  status,
  onFiles,
  uploadProgress,
  uploadingFiles,
  errorMessage,
  onLoadDemo,
  slowHint: _slowHint,
  onRetry: _onRetry,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const particles = useMemo(() => generateParticles(25), [])

  const isUploading = status === 'uploading' && uploadingFiles.length > 0
  const disabled = status !== 'idle'

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      if (disabled) return
      const dropped = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('video/'),
      )
      if (dropped.length) onFiles(dropped)
    },
    [onFiles, disabled],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || disabled) return
      const selected = Array.from(e.target.files).filter((f) =>
        f.type.startsWith('video/'),
      )
      if (selected.length) onFiles(selected)
    },
    [onFiles, disabled],
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0A0A0F',
        overflow: 'hidden',
      }}
    >
      {/* ─────── Background video layer (z=0) ─────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.55,
            filter: 'blur(2px) saturate(0.55) brightness(1.1)',
          }}
        >
          <source src="/bg-loop.mp4" type="video/mp4" />
        </video>
        {/* CSS gradient layer composites a warm/cool wash on top of the video */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 18% 60%, rgba(232,197,71,0.05) 0%, transparent 55%),' +
              'radial-gradient(ellipse at 82% 40%, rgba(78,205,196,0.04) 0%, transparent 55%),' +
              'linear-gradient(180deg, rgba(10,10,15,0.55) 0%, rgba(10,10,15,0.85) 100%)',
          }}
        />
      </div>

      {/* ─────── Animated film grain overlay (z=1) ─────── */}
      <div
        aria-hidden
        className="landing-grain"
        style={{
          position: 'fixed',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
          pointerEvents: 'none',
          zIndex: 1,
          mixBlendMode: 'overlay',
        }}
      />

      {/* ─────── Floating particles (z=2) ─────── */}
      <FloatingParticles particles={particles} accelerated={isUploading} />

      {/* ─────── Centered glass card (z=10) ─────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 640,
            padding: '48px 40px',
            background: 'rgba(12, 12, 20, 0.72)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(232, 197, 71, 0.12)',
            borderRadius: 24,
            boxShadow:
              '0 0 80px rgba(232, 197, 71, 0.06), 0 20px 60px rgba(0, 0, 0, 0.55)',
            overflow: 'hidden',
          }}
        >
          {/* Light sweep — framer-motion animated overlay */}
          <motion.div
            aria-hidden
            initial={{ x: '-50%' }}
            animate={{ x: '150%' }}
            transition={{
              duration: 6,
              repeat: Infinity,
              repeatDelay: 1.5,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '50%',
              height: '100%',
              background:
                'linear-gradient(90deg, transparent, rgba(232,197,71,0.06), transparent)',
              pointerEvents: 'none',
            }}
          />

          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.28em',
              color: '#5A5A6E',
              textTransform: 'uppercase',
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            AI Post-Production Suite
          </motion.p>

          {/* RUSHES title */}
          <motion.h1
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 'clamp(48px, 7vw, 72px)',
              fontWeight: 800,
              letterSpacing: '0.2em',
              color: '#E8C547',
              textAlign: 'center',
              marginBottom: 8,
              lineHeight: 1,
              textShadow:
                '0 0 40px rgba(232, 197, 71, 0.3), 0 0 80px rgba(232,197,71,0.1)',
            }}
          >
            RUSHES
          </motion.h1>

          {/* Decorative gold gradient line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            aria-hidden
            style={{
              width: 100,
              height: 1,
              margin: '14px auto 18px',
              background:
                'linear-gradient(90deg, transparent, #E8C547, transparent)',
            }}
          />

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 17,
              color: '#8B8B9E',
              textAlign: 'center',
              marginBottom: 36,
              lineHeight: 1.5,
            }}
          >
            Turn disconnected AI clips into a coherent film.
          </motion.p>

          {/* Drop zone OR upload progress */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            onDragOver={(e) => {
              e.preventDefault()
              if (!disabled) setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !disabled && !isUploading && inputRef.current?.click()}
            style={{
              position: 'relative',
              border: isDragOver
                ? '2px solid #E8C547'
                : '2px dashed rgba(232,197,71,0.22)',
              borderRadius: 16,
              padding: isUploading ? '32px 28px' : '44px 28px',
              textAlign: 'center',
              cursor: isUploading || disabled ? 'default' : 'pointer',
              transition: 'border 0.3s, background 0.3s, box-shadow 0.3s',
              background: isDragOver
                ? 'rgba(232,197,71,0.06)'
                : 'rgba(255,255,255,0.02)',
              boxShadow: isDragOver
                ? '0 0 40px rgba(232,197,71,0.12), inset 0 0 40px rgba(232,197,71,0.04)'
                : 'none',
              overflow: 'hidden',
            }}
          >
            <CornerBrackets active={isDragOver} />

            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              multiple
              disabled={disabled}
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />

            <AnimatePresence mode="wait">
              {!isUploading ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    animate={
                      isDragOver
                        ? { scale: 1.08, rotate: 4 }
                        : { scale: 1, rotate: 0 }
                    }
                    style={{ display: 'inline-flex', marginBottom: 14 }}
                  >
                    <Clapperboard
                      size={40}
                      color={isDragOver ? '#E8C547' : '#5A5A6E'}
                      strokeWidth={1.5}
                      style={{ transition: 'color 0.3s' }}
                    />
                  </motion.div>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                      color: isDragOver ? '#E8C547' : '#8B8B9E',
                      marginBottom: 6,
                      transition: 'color 0.3s',
                    }}
                  >
                    {isDragOver
                      ? 'Drop your clips here'
                      : 'Drag & drop your AI clips'}
                  </p>
                  <p
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      color: '#5A5A6E',
                      margin: 0,
                    }}
                  >
                    or{' '}
                    <span
                      style={{
                        color: '#E8C547',
                        textDecoration: 'underline',
                        textUnderlineOffset: 4,
                      }}
                    >
                      browse files
                    </span>
                  </p>
                  <p
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      color: '#3A3A4E',
                      letterSpacing: '0.05em',
                      marginTop: 18,
                      marginBottom: 0,
                    }}
                  >
                    MP4 · MOV · WebM · Up to 500 MB
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ textAlign: 'left' }}
                >
                  {uploadingFiles.map((f) => (
                    <div
                      key={f.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 13,
                              color: '#F0F0F0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '70%',
                            }}
                          >
                            {f.name}
                          </span>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              color: '#5A5A6E',
                            }}
                          >
                            {formatBytes(f.size)}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 2,
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <motion.div
                            initial={{ width: '0%' }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            style={{
                              height: '100%',
                              background:
                                'linear-gradient(90deg, #E8C547, #D4A730)',
                              boxShadow: '0 0 8px rgba(232,197,71,0.5)',
                            }}
                          />
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          color: '#E8C547',
                          minWidth: 36,
                          textAlign: 'right',
                        }}
                      >
                        {Math.round(uploadProgress)}%
                      </span>
                    </div>
                  ))}
                  <motion.p
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    style={{
                      marginTop: 14,
                      marginBottom: 0,
                      textAlign: 'center',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      color: '#E8C547',
                      textTransform: 'uppercase',
                    }}
                  >
                    Preparing your footage…
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,107,107,0.4)',
                background: 'rgba(255,107,107,0.08)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: '#FF6B6B',
              }}
            >
              {errorMessage}
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: '#8B8B9E',
                  marginTop: 4,
                }}
              >
                Try again, or press ⌘D for the demo.
              </div>
            </motion.div>
          )}

          {/* Sponsor row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            style={{ marginTop: 32, textAlign: 'center' }}
          >
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                color: '#3A3A4E',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                marginBottom: 12,
              }}
            >
              Powered by
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              {SPONSORS.map((name) => (
                <span
                  key={name}
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#8B8B9E',
                    padding: '5px 13px',
                    border: '1px solid rgba(232,197,71,0.18)',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.025)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Demo link */}
          {onLoadDemo && (
            <motion.button
              type="button"
              onClick={onLoadDemo}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.05, duration: 0.4 }}
              style={{
                display: 'block',
                margin: '20px auto 0',
                background: 'transparent',
                border: 'none',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#5A5A6E',
                cursor: 'pointer',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#E8C547'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#5A5A6E'
              }}
            >
              ✦ Try the demo · ⌘D
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* Bottom credits — outside card */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        style={{
          position: 'fixed',
          bottom: 22,
          left: 0,
          right: 0,
          zIndex: 10,
          textAlign: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          letterSpacing: '0.04em',
          color: '#3A3A4E',
          margin: 0,
        }}
      >
        Built for Big Screen Hack London 2026 ·{' '}
        <span style={{ color: '#5A5A6E' }}>Theme:</span>{' '}
        <span style={{ color: '#8B8B9E', letterSpacing: '0.16em' }}>
          INTO THE UNKNOWN
        </span>
      </motion.p>
    </div>
  )
}
