import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { ChevronRight, Download, GripHorizontal, Music, Play } from 'lucide-react'
import type { ClipAnalysis } from '../lib/types'
import AudioWaveform from './AudioWaveform'

interface Props {
  clips: ClipAnalysis[]
  suggestedOrder: string[]
  selectedClipId: string | null
  onSelect: (clipId: string) => void
  onReorder?: (newOrder: string[]) => void
  musicUrl: string | null
  musicMood: string | null
  assembledVideoUrl: string | null
  onPlay: () => void
}

interface ThumbnailProps {
  clip: ClipAnalysis
  index: number
  selected: boolean
  onSelect: (clipId: string) => void
  draggable: boolean
}

function SortableThumbnail({
  clip,
  index,
  selected,
  onSelect,
  draggable,
}: ThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.clip_id, disabled: !draggable })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : 1,
    width: 60,
    height: 34,
    background: clip.thumbnail_url
      ? `url(${clip.thumbnail_url}) center/cover`
      : '#1A1A2E',
    cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
    flexShrink: 0,
  }

  return (
    <motion.button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(clip.clip_id)}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isDragging ? 0.7 : 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={[
        'group relative overflow-hidden rounded transition-shadow duration-200',
        isDragging
          ? 'ring-2 ring-rush-accent-gold shadow-[0_0_24px_rgba(232,197,71,0.55)]'
          : selected
          ? 'ring-2 ring-[#E8C547] shadow-[0_0_18px_rgba(232,197,71,0.4)]'
          : 'ring-1 ring-rush-border hover:ring-[#E8C547]/60',
      ].join(' ')}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="absolute left-0.5 top-0.5 rounded-sm bg-black/70 px-1 font-mono text-[8px] font-bold text-rush-accent-gold">
        {String(index + 1).padStart(2, '0')}
      </div>
      {/* Drag affordance — visible on hover only */}
      {draggable && (
        <div className="pointer-events-none absolute right-0.5 top-0.5 rounded-sm bg-black/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <GripHorizontal size={9} className="text-rush-accent-gold" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-0.5">
        <div className="text-right font-mono text-[7px] text-white/90 tabular-nums">
          {clip.duration.toFixed(1)}s
        </div>
      </div>
    </motion.button>
  )
}

export default function Timeline({
  clips,
  suggestedOrder,
  selectedClipId,
  onSelect,
  onReorder,
  musicUrl,
  musicMood,
  assembledVideoUrl,
  onPlay,
}: Props) {
  // Resolve order → clips, fall back to clips' natural order if no suggestion
  const orderedIds = suggestedOrder.length
    ? suggestedOrder.filter((id) => clips.some((c) => c.clip_id === id))
    : clips.map((c) => c.clip_id)
  const ordered = orderedIds
    .map((id) => clips.find((c) => c.clip_id === id))
    .filter((c): c is ClipAnalysis => Boolean(c))

  // PointerSensor with a small movement threshold so plain clicks still
  // register as selects (only drags >5px treated as drag operations).
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) return
    const oldIndex = orderedIds.indexOf(String(active.id))
    const newIndex = orderedIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(orderedIds, oldIndex, newIndex))
  }

  if (ordered.length === 0) return null

  const canPlay = Boolean(assembledVideoUrl)
  const draggable = Boolean(onReorder) && ordered.length > 1

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
            {draggable ? 'drag to reorder · ' : ''}
            {ordered.length} clips
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

      {/* Sortable clip strip */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedIds}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-1">
            {ordered.map((clip, i) => (
              <div
                key={clip.clip_id}
                className="flex flex-shrink-0 items-center"
              >
                <SortableThumbnail
                  clip={clip}
                  index={i}
                  selected={clip.clip_id === selectedClipId}
                  onSelect={onSelect}
                  draggable={draggable}
                />
                {i < ordered.length - 1 && (
                  <ChevronRight
                    size={12}
                    className="mx-0.5 flex-shrink-0 text-rush-text-muted"
                  />
                )}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
            <span>Music · {musicMood ?? 'cinematic'}</span>
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
