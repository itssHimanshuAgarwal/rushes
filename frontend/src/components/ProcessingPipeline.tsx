import {
  Background,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  Position,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import {
  Award,
  CheckCircle2,
  Clapperboard,
  FileVideo,
  Film,
  GitCompareArrows,
  Loader2,
  Music,
  Sparkles,
  Star,
  Video,
  Volume2,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { AppStatus } from '../lib/types'

type NodeStatus = 'idle' | 'running' | 'completed'

interface PipelineNodeData {
  label: string
  Icon: ComponentType<{ size?: number; className?: string }>
  description: string
  status: NodeStatus
  detail?: string
  bottomHandle?: 'source' | 'target' // for feedback-loop edges
  [key: string]: unknown
}

const STATUS_COLORS = {
  idle: { bg: '#1A1A2E', border: '#2A2A3E', text: '#5A5A6E', glow: 'none' },
  running: {
    bg: '#1A1A2E',
    border: '#E8C547',
    text: '#E8C547',
    glow:
      '0 0 20px rgba(232,197,71,0.3), 0 0 40px rgba(232,197,71,0.1)',
  },
  completed: {
    bg: '#0D2818',
    border: '#51CF66',
    text: '#51CF66',
    glow: '0 0 14px rgba(81,207,102,0.18)',
  },
} as const

// React Flow custom node — adapted from the spec, using Lucide icons + framer-motion glow
function PipelineNode({ data }: { data: PipelineNodeData }) {
  const c = STATUS_COLORS[data.status]
  const Icon = data.Icon

  return (
    <motion.div
      animate={{
        boxShadow:
          data.status === 'running'
            ? [
                '0 0 18px rgba(232,197,71,0.20)',
                '0 0 36px rgba(232,197,71,0.45)',
                '0 0 18px rgba(232,197,71,0.20)',
              ]
            : c.glow,
        borderColor: c.border,
      }}
      transition={
        data.status === 'running'
          ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.3 }
      }
      style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        borderRadius: 12,
        padding: '14px 18px 12px',
        minWidth: 168,
        textAlign: 'center',
        position: 'relative',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Required for edges to render — invisible handles on left + right */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'transparent', border: 'none', width: 1, height: 1 }}
      />
      {/* Optional bottom handle for the feedback loop (Critic → other agents) */}
      {data.bottomHandle === 'source' && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="feedback-out"
          style={{ background: 'transparent', border: 'none', width: 1, height: 1 }}
        />
      )}
      {data.bottomHandle === 'target' && (
        <Handle
          type="target"
          position={Position.Bottom}
          id="feedback-in"
          style={{ background: 'transparent', border: 'none', width: 1, height: 1 }}
        />
      )}

      {/* Status indicator dot (top-right) */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background:
            data.status === 'running'
              ? '#E8C547'
              : data.status === 'completed'
              ? '#51CF66'
              : '#3A3A4E',
        }}
      >
        {data.status === 'running' && (
          <motion.div
            animate={{ scale: [1, 2.2, 1], opacity: [1, 0, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: '#E8C547',
            }}
          />
        )}
      </div>

      {/* Icon */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <Icon size={22} className="" />
      </div>

      {/* Label */}
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          color: c.text,
          marginBottom: 3,
          letterSpacing: '0.02em',
        }}
      >
        {data.label}
      </div>

      {/* Description */}
      <div
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 11,
          color: '#5A5A6E',
          lineHeight: 1.3,
        }}
      >
        {data.description}
      </div>

      {/* Detail pill */}
      {data.detail && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            display: 'inline-block',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: c.text,
            marginTop: 6,
            background: 'rgba(0,0,0,0.35)',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {data.detail}
        </motion.div>
      )}

      {/* Spinner OR checkmark */}
      <div style={{ height: 16, marginTop: 6, display: 'flex', justifyContent: 'center' }}>
        {data.status === 'running' && (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'inline-flex' }}
          >
            <Loader2 size={14} color="#E8C547" />
          </motion.span>
        )}
        {data.status === 'completed' && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 16 }}
            style={{ display: 'inline-flex' }}
          >
            <CheckCircle2 size={14} color="#51CF66" />
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}

const nodeTypes = { pipelineNode: PipelineNode }

// ---------- Layout (left → right with branching) ----------

const NODE_DEFS: Array<{
  id: string
  position: { x: number; y: number }
  label: string
  description: string
  Icon: ComponentType<{ size?: number; className?: string }>
  bottomHandle?: 'source' | 'target'
}> = [
  { id: 'upload', position: { x: 0, y: 200 }, label: 'Upload Clips', description: 'Receiving files', Icon: FileVideo },
  { id: 'frames', position: { x: 250, y: 200 }, label: 'Frame Extraction', description: 'Extracting keyframes', Icon: Clapperboard },
  { id: 'quality', position: { x: 510, y: 50 }, label: 'Quality Scoring', description: 'AI quality analysis', Icon: Star },
  { id: 'scene', position: { x: 510, y: 200 }, label: 'Scene Analysis', description: 'Understanding scenes', Icon: Video },
  { id: 'audio-detect', position: { x: 510, y: 350 }, label: 'Audio Detection', description: 'Checking audio tracks', Icon: Volume2 },
  { id: 'continuity', position: { x: 790, y: 200 }, label: 'Continuity Check', description: 'Cross-clip comparison', Icon: GitCompareArrows },
  // Bottom-target on sound-design + assembly so feedback edges can land there
  { id: 'sound-design', position: { x: 1060, y: 130 }, label: 'Sound Design', description: 'ElevenLabs audio', Icon: Music, bottomHandle: 'target' },
  { id: 'music', position: { x: 1060, y: 300 }, label: 'Music Score', description: 'Generating soundtrack', Icon: Sparkles },
  { id: 'assembly', position: { x: 1340, y: 200 }, label: 'Final Assembly', description: 'Building your film', Icon: Film, bottomHandle: 'target' },
  // Critic agent — the loop closer
  { id: 'critic', position: { x: 1620, y: 200 }, label: 'Film Critic', description: "Director's review", Icon: Award, bottomHandle: 'source' },
]

const EDGE_DEFS: Array<{ id: string; source: string; target: string }> = [
  { id: 'e-upload-frames', source: 'upload', target: 'frames' },
  { id: 'e-frames-quality', source: 'frames', target: 'quality' },
  { id: 'e-frames-scene', source: 'frames', target: 'scene' },
  { id: 'e-frames-audio', source: 'frames', target: 'audio-detect' },
  { id: 'e-quality-continuity', source: 'quality', target: 'continuity' },
  { id: 'e-scene-continuity', source: 'scene', target: 'continuity' },
  { id: 'e-audio-continuity', source: 'audio-detect', target: 'continuity' },
  { id: 'e-continuity-sound', source: 'continuity', target: 'sound-design' },
  { id: 'e-continuity-music', source: 'continuity', target: 'music' },
  { id: 'e-sound-assembly', source: 'sound-design', target: 'assembly' },
  { id: 'e-music-assembly', source: 'music', target: 'assembly' },
  { id: 'e-assembly-critic', source: 'assembly', target: 'critic' },
]

// Dashed amber feedback edges — drawn separately from forward edges because
// they have their own visual style (dashed, amber, persistent) and only
// animate when the user clicks "Fix This" on a critic-suggested improvement.
interface FeedbackEdgeDef {
  id: string
  source: string
  target: string
  agent: 'sound-design' | 'music' | 'assembly'
}

const FEEDBACK_EDGE_DEFS: FeedbackEdgeDef[] = [
  {
    id: 'e-feedback-critic-sound',
    source: 'critic',
    target: 'sound-design',
    agent: 'sound-design',
  },
  {
    id: 'e-feedback-critic-assembly',
    source: 'critic',
    target: 'assembly',
    agent: 'assembly',
  },
]

// ---------- Status derivation ----------

interface Props {
  appStatus: AppStatus
  totalClips?: number
  silentCount?: number
  breakCount?: number
  missingCount?: number
  jobId?: string | null
  // The critic creates a feedback loop. When the user clicks "Fix This" on a
  // critic-suggested improvement, the corresponding feedback edge animates and
  // the target agent's node lights back up to "running" — proving on the graph
  // itself that the agents iterate, not just run linearly.
  fixingAgent?: 'sound-design' | 'music' | 'assembly' | null
  criticVisible?: boolean
}

// Event payloads streamed by the backend over SSE.
type SSEStageName =
  | 'upload'
  | 'frames'
  | 'quality'
  | 'scene'
  | 'audio-detect'
  | 'continuity'
  | 'critic'

type SSEEvent =
  | { type: 'stage'; stage: SSEStageName; status: 'running' | 'completed'; total?: number; overall_score?: number; breaks?: number; missing?: number; score?: number }
  | { type: 'clip_upload_done'; clip_index: number; total: number; filename: string }
  | { type: 'clip_frames_done'; clip_index: number; total: number; filename: string }
  | { type: 'agent_done'; agent: 'quality' | 'scene' | 'audio-detect'; clip_index: number; total: number; filename: string; quality_score?: number; has_audio?: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'ping' }

interface AgentProgress {
  done: number
  total: number
  silentCount?: number
}

// Subscribe to /api/events/:jobId and translate each event into per-node detail
// + status overrides. Each of the three vision agents (quality / scene /
// audio-detect) is now independently tracked: each has its own "stage" event,
// and per-clip "agent_done" events fire the moment that one agent's OpenAI
// call returns — even if its sibling agents are still in flight.
function useSSEEvents(jobId: string | null | undefined) {
  const [progress, setProgress] = useState<{
    upload: AgentProgress | null
    frames: AgentProgress | null
    quality: AgentProgress | null
    scene: AgentProgress | null
    'audio-detect': AgentProgress | null
    completedStages: Set<string>
    activeStages: Set<string>
    error: string | null
  }>({
    upload: null,
    frames: null,
    quality: null,
    scene: null,
    'audio-detect': null,
    completedStages: new Set(),
    activeStages: new Set(),
    error: null,
  })

  useEffect(() => {
    if (!jobId) return
    const es = new EventSource(`/api/events/${jobId}`)

    es.onmessage = (e) => {
      let ev: SSEEvent
      try {
        ev = JSON.parse(e.data)
      } catch {
        return
      }

      setProgress((prev) => {
        const active = new Set(prev.activeStages)
        const done = new Set(prev.completedStages)

        if (ev.type === 'stage') {
          if (ev.status === 'running') active.add(ev.stage)
          if (ev.status === 'completed') {
            active.delete(ev.stage)
            done.add(ev.stage)
          }
          return { ...prev, activeStages: active, completedStages: done }
        }
        if (ev.type === 'clip_upload_done') {
          return {
            ...prev,
            upload: { done: ev.clip_index + 1, total: ev.total },
          }
        }
        if (ev.type === 'clip_frames_done') {
          return {
            ...prev,
            frames: { done: ev.clip_index + 1, total: ev.total },
          }
        }
        if (ev.type === 'agent_done') {
          const prevAgent = prev[ev.agent] ?? { done: 0, total: ev.total, silentCount: 0 }
          const silentCount =
            ev.agent === 'audio-detect' && ev.has_audio === false
              ? (prevAgent.silentCount ?? 0) + 1
              : prevAgent.silentCount
          return {
            ...prev,
            [ev.agent]: {
              done: ev.clip_index + 1,
              total: ev.total,
              silentCount,
            },
          }
        }
        if (ev.type === 'error') return { ...prev, error: ev.message }
        if (ev.type === 'done') return { ...prev, error: null }
        return prev
      })
    }

    return () => {
      es.close()
    }
  }, [jobId])

  return progress
}

/**
 * Maps AppStatus + a small choreographed micro-step (for the analyze phase)
 * to per-node statuses. /api/analyze is one big server call internally, so we
 * walk through frames → parallel-analysis → continuity with timing for visuals.
 */
function useNodeStatuses(appStatus: AppStatus): Record<string, NodeStatus> {
  // analyzeStep: 0 = upload done + frames running
  //              1 = frames done + parallel analysis running (quality/scene/audio)
  //              2 = parallel done + continuity running
  //              3 = all analyze nodes done
  const [analyzeStep, setAnalyzeStep] = useState<0 | 1 | 2 | 3>(0)

  useEffect(() => {
    if (appStatus !== 'analyzing') {
      setAnalyzeStep(0)
      return
    }
    let cancelled = false
    ;(async () => {
      // give the eye a moment on the upload→frames hand-off
      await new Promise((r) => setTimeout(r, 900))
      if (cancelled) return
      setAnalyzeStep(1)
      await new Promise((r) => setTimeout(r, 1800))
      if (cancelled) return
      setAnalyzeStep(2)
      // continuity stays "running" until appStatus moves on
    })()
    return () => {
      cancelled = true
    }
  }, [appStatus])

  // When status leaves 'analyzing', mark step 3 (all complete)
  useEffect(() => {
    if (
      appStatus === 'ready' ||
      appStatus === 'generating-audio' ||
      appStatus === 'generating-music' ||
      appStatus === 'assembling' ||
      appStatus === 'complete'
    ) {
      setAnalyzeStep(3)
    }
  }, [appStatus])

  return useMemo(() => {
    const idle = (): NodeStatus => 'idle'
    const s: Record<string, NodeStatus> = {
      upload: idle(),
      frames: idle(),
      quality: idle(),
      scene: idle(),
      'audio-detect': idle(),
      continuity: idle(),
      'sound-design': idle(),
      music: idle(),
      assembly: idle(),
      critic: idle(),
    }

    const phase1Done =
      appStatus === 'ready' ||
      appStatus === 'generating-audio' ||
      appStatus === 'generating-music' ||
      appStatus === 'assembling' ||
      appStatus === 'complete'

    if (appStatus === 'uploading') {
      s.upload = 'running'
    } else if (appStatus === 'analyzing') {
      s.upload = 'completed'
      s.frames = analyzeStep >= 1 ? 'completed' : 'running'
      s.quality =
        analyzeStep >= 2 ? 'completed' : analyzeStep >= 1 ? 'running' : 'idle'
      s.scene =
        analyzeStep >= 2 ? 'completed' : analyzeStep >= 1 ? 'running' : 'idle'
      s['audio-detect'] =
        analyzeStep >= 2 ? 'completed' : analyzeStep >= 1 ? 'running' : 'idle'
      s.continuity = analyzeStep >= 2 ? 'running' : 'idle'
    } else if (phase1Done) {
      s.upload = 'completed'
      s.frames = 'completed'
      s.quality = 'completed'
      s.scene = 'completed'
      s['audio-detect'] = 'completed'
      s.continuity = 'completed'
    }

    if (appStatus === 'generating-audio') {
      s['sound-design'] = 'running'
    } else if (
      appStatus === 'generating-music' ||
      appStatus === 'assembling' ||
      appStatus === 'complete'
    ) {
      s['sound-design'] = 'completed'
    }

    if (appStatus === 'generating-music') {
      s.music = 'running'
    } else if (appStatus === 'assembling' || appStatus === 'complete') {
      s.music = 'completed'
    }

    if (appStatus === 'assembling') {
      s.assembly = 'running'
    } else if (
      appStatus === 'critiquing' ||
      appStatus === 'complete'
    ) {
      s.assembly = 'completed'
    }

    if (appStatus === 'critiquing') {
      s.critic = 'running'
    } else if (appStatus === 'complete') {
      s.critic = 'completed'
    }

    return s
  }, [appStatus, analyzeStep])
}

function detailFor(
  nodeId: string,
  status: NodeStatus,
  total?: number,
  silent?: number,
  breaks?: number,
  sseProgress?: ReturnType<typeof useSSEEvents>,
): string | undefined {
  if (status === 'idle') return undefined

  // SSE-driven live counts trump derived data.
  if (sseProgress) {
    if (nodeId === 'upload') {
      const p = sseProgress.upload
      if (p && status === 'running') return `${p.done}/${p.total} streaming`
      if (status === 'completed' && total) return `${total} files`
    }
    if (nodeId === 'frames') {
      const p = sseProgress.frames
      if (p && status === 'running') return `${p.done}/${p.total} ffmpeg`
      if (status === 'completed' && total) return `${total * 3} keyframes`
    }
    // Per-agent progress: each of the three vision agents tracks its own X/Y.
    if (nodeId === 'quality') {
      const p = sseProgress.quality
      if (p && status === 'running') return `${p.done}/${p.total} clips`
    }
    if (nodeId === 'scene') {
      const p = sseProgress.scene
      if (p && status === 'running') return `${p.done}/${p.total} clips`
    }
    if (nodeId === 'audio-detect') {
      const p = sseProgress['audio-detect']
      if (p && status === 'running') return `${p.done}/${p.total} clips`
      if (status === 'completed' && p) {
        const s = p.silentCount ?? 0
        return s === 0 ? 'all have audio' : `${s} silent`
      }
    }
  }

  if (nodeId === 'upload' && status === 'running') return 'Streaming files…'
  if (nodeId === 'upload' && status === 'completed') return total ? `${total} files` : 'received'
  if (nodeId === 'frames' && status === 'running') return 'ffmpeg keyframes'
  if (nodeId === 'frames' && status === 'completed' && total) return `${total * 3} frames`
  if (nodeId === 'audio-detect' && status === 'completed' && silent !== undefined) {
    return silent === 0 ? 'all have audio' : `${silent} silent`
  }
  if (nodeId === 'continuity' && status === 'completed' && breaks !== undefined) {
    return `${breaks} issue${breaks === 1 ? '' : 's'}`
  }
  if (nodeId === 'sound-design' && status === 'running') return 'ElevenLabs SFX'
  if (nodeId === 'music' && status === 'running') return 'cinematic bed'
  if (nodeId === 'assembly' && status === 'running') return 'crossfade · loudnorm'
  if (nodeId === 'assembly' && status === 'completed') return 'film ready ✓'
  return undefined
}

// ---------- The component ----------

export default function ProcessingPipeline({
  appStatus,
  totalClips,
  silentCount,
  breakCount,
  jobId,
  fixingAgent = null,
  criticVisible = true,
}: Props) {
  const timerStatuses = useNodeStatuses(appStatus)
  const sse = useSSEEvents(jobId)

  // When SSE events are flowing, override the timer-driven statuses for the
  // 6 analyze nodes with the real backend stage state. The 3 make-coherent
  // nodes (sound-design / music / assembly) are still driven by appStatus
  // since those don't go through /api/analyze.
  const statuses = useMemo(() => {
    const s = { ...timerStatuses }
    if (!jobId || appStatus !== 'analyzing') return s

    const isStageRunning = (stage: string) => sse.activeStages.has(stage)
    const isStageDone = (stage: string) => sse.completedStages.has(stage)

    // upload
    if (isStageRunning('upload')) s.upload = 'running'
    else if (isStageDone('upload')) s.upload = 'completed'
    // frames
    if (isStageRunning('frames')) s.frames = 'running'
    else if (isStageDone('frames')) s.frames = 'completed'
    else if (isStageDone('upload')) s.frames = 'idle'
    // Three INDEPENDENT vision agents — each is its own stage now, so each
    // node lights up + completes on its own per-clip cadence.
    const setAgent = (id: 'quality' | 'scene' | 'audio-detect') => {
      if (isStageRunning(id)) s[id] = 'running'
      else if (isStageDone(id)) s[id] = 'completed'
    }
    setAgent('quality')
    setAgent('scene')
    setAgent('audio-detect')
    // continuity
    if (isStageRunning('continuity')) s.continuity = 'running'
    else if (isStageDone('continuity')) s.continuity = 'completed'
    return s
  }, [timerStatuses, sse, appStatus, jobId])

  // When the user clicks "Fix This", the target agent flips back to running
  // (visualising the feedback loop). This OVERRIDES the otherwise-completed state.
  const finalStatuses = useMemo(() => {
    if (!fixingAgent) return statuses
    return { ...statuses, [fixingAgent]: 'running' as NodeStatus }
  }, [statuses, fixingAgent])

  const nodes: Node<PipelineNodeData>[] = useMemo(
    () =>
      NODE_DEFS.filter((n) => criticVisible || n.id !== 'critic').map((n) => ({
        id: n.id,
        type: 'pipelineNode',
        position: n.position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: n.label,
          description: n.description,
          Icon: n.Icon,
          status: finalStatuses[n.id],
          bottomHandle: n.bottomHandle,
          detail: detailFor(
            n.id,
            finalStatuses[n.id],
            totalClips,
            silentCount,
            breakCount,
            sse,
          ),
        },
      })),
    [finalStatuses, totalClips, silentCount, breakCount, sse, criticVisible],
  )

  const edges: Edge[] = useMemo(() => {
    const forwardEdges: Edge[] = EDGE_DEFS
      .filter((e) => criticVisible || e.target !== 'critic')
      .map((e) => {
        const srcDone = finalStatuses[e.source] === 'completed'
        const tgtRunning = finalStatuses[e.target] === 'running'
        const tgtDone = finalStatuses[e.target] === 'completed'

        const active = srcDone && tgtRunning
        const done = srcDone && tgtDone

        const stroke = done ? '#51CF66' : active ? '#E8C547' : '#2A2A3E'
        const width = done || active ? 2.5 : 2

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: active,
          style: { stroke, strokeWidth: width },
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        }
      })

    if (!criticVisible) return forwardEdges

    // Feedback edges: dashed amber, only visible after the critic runs.
    // When fixingAgent matches, that specific edge animates and turns brighter.
    const criticDone = finalStatuses.critic === 'completed' || fixingAgent !== null
    const feedbackEdges: Edge[] = FEEDBACK_EDGE_DEFS.map((fe) => {
      const isActive = fixingAgent === fe.agent
      const isVisible = criticDone || isActive
      const stroke = isActive ? '#FF9500' : isVisible ? '#B8702A' : '#2A2A3E'
      return {
        id: fe.id,
        source: fe.source,
        sourceHandle: 'feedback-out',
        target: fe.target,
        targetHandle: 'feedback-in',
        animated: isActive,
        type: 'default',
        style: {
          stroke,
          strokeWidth: isActive ? 2.5 : 2,
          strokeDasharray: '6 4',
          opacity: isVisible ? 1 : 0.18,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        label: isActive ? 'fix in flight ↺' : 'feedback loop ↺',
        labelStyle: {
          fill: stroke,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        },
        labelBgStyle: {
          fill: '#0A0A0F',
          fillOpacity: 0.85,
        },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      }
    })
    return [...forwardEdges, ...feedbackEdges]
  }, [finalStatuses, criticVisible, fixingAgent])

  return (
    <div
      style={{
        width: '100%',
        height: 520,
        background: '#0A0A0F',
        borderRadius: 16,
        border: '1px solid #2A2A3E',
        overflow: 'hidden',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background color="#1A1A2E" gap={20} size={1} />
      </ReactFlow>
    </div>
  )
}
