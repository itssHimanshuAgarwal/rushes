import type { ClipAnalysis } from '../lib/types'
import ClipCard from './ClipCard'

interface Props {
  clips: ClipAnalysis[]
  selectedClipId: string | null
  onSelect: (clipId: string) => void
}

export default function ClipGallery({ clips, selectedClipId, onSelect }: Props) {
  return (
    <aside
      className="flex h-full w-[320px] flex-shrink-0 flex-col border-r border-rush-border"
      style={{ background: '#12121A' }}
    >
      <div className="flex items-center justify-between border-b border-rush-border px-4 py-3">
        <h2 className="font-display text-[18px] font-bold tracking-wide text-rush-text-primary">
          Clips
        </h2>
        <span className="rounded-full border border-rush-border px-2 py-0.5 font-mono text-[11px] text-rush-text-secondary">
          {clips.length.toString().padStart(2, '0')}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {clips.length === 0 && (
          <p className="text-center font-body text-[12px] text-rush-text-muted">
            No clips yet.
          </p>
        )}
        {clips.map((clip, i) => (
          <ClipCard
            key={clip.clip_id}
            clip={clip}
            index={i}
            selected={selectedClipId === clip.clip_id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  )
}
