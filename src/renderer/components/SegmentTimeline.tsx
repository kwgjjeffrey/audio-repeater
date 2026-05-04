import { useCallback, useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import SegmentItem from './SegmentItem'
import type { Segment, BookmarkType } from '../types'
import { usePlaybackStore } from '../store/playbackStore'
import { segmentsInRange, segmentIndex } from '../lib/segments'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SegmentTimelineProps {
  segments: Segment[]
  onSeekToSegment: (segmentId: string) => void
  onBookmarkChange: (segId: string, bookmark: BookmarkType | undefined) => void
  onGroupSelected: (ids: string[]) => void
  onUngroup: (groupId: string) => void
}

type FilterTab = 'all' | 'starred'

export default function SegmentTimeline({
  segments,
  onSeekToSegment,
  onBookmarkChange,
  onGroupSelected,
  onUngroup
}: SegmentTimelineProps) {
  const { selection, currentSegmentId, setSelection, setLoopMode } = usePlaybackStore()
  const [filter, setFilter] = useState<FilterTab>('all')
  const firstClickedRef = useRef<string | null>(null)
  const currentItemRef = useRef<HTMLButtonElement | null>(null)

  const selectedSet = new Set(
    selection ? segmentsInRange(segments, selection).map((s) => s.id) : []
  )

  const starredSegments = segments.filter((s) => !!s.bookmark)
  const visibleSegments = filter === 'starred' ? starredSegments : segments

  const maxDurationMs = Math.max(...segments.map((s) => s.endMs - s.startMs), 1)

  useEffect(() => {
    currentItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentSegmentId])

  const extendSelection = useCallback(
    (segment: Segment) => {
      if (!firstClickedRef.current) {
        firstClickedRef.current = segment.id
        setSelection({ firstSegId: segment.id, lastSegId: segment.id })
        return
      }
      const firstIdx = segmentIndex(segments, firstClickedRef.current)
      const thisIdx = segmentIndex(segments, segment.id)
      if (firstIdx === -1 || thisIdx === -1) return
      const lo = Math.min(firstIdx, thisIdx)
      const hi = Math.max(firstIdx, thisIdx)
      setSelection({ firstSegId: segments[lo].id, lastSegId: segments[hi].id })
    },
    [segments, setSelection]
  )

  const extendSelectionAsGroup = useCallback(
    (segment: Segment) => {
      const anchorId = firstClickedRef.current
      if (!anchorId) {
        // Nothing anchored — just select this single item, no group needed
        firstClickedRef.current = segment.id
        setSelection({ firstSegId: segment.id, lastSegId: segment.id })
        return
      }
      const firstIdx = segmentIndex(segments, anchorId)
      const thisIdx = segmentIndex(segments, segment.id)
      if (firstIdx === -1 || thisIdx === -1) return
      const lo = Math.min(firstIdx, thisIdx)
      const hi = Math.max(firstIdx, thisIdx)
      const rangeIds = segments.slice(lo, hi + 1).map((s) => s.id)
      if (rangeIds.length >= 2) {
        onGroupSelected(rangeIds)
      }
    },
    [segments, setSelection, onGroupSelected]
  )

  const handleSegmentClick = useCallback(
    (segment: Segment, shiftKey: boolean) => {
      if (shiftKey) {
        extendSelection(segment)
      } else {
        // Single click → select + seek + auto-enable repeat
        firstClickedRef.current = segment.id
        setSelection({ firstSegId: segment.id, lastSegId: segment.id })
        setLoopMode('loop')
        onSeekToSegment(segment.id)
      }
    },
    [segments, setSelection, setLoopMode, onSeekToSegment, extendSelection]
  )

  if (segments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
        No phrases detected
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex items-center border-b shrink-0">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'flex-1 py-2 text-xs font-medium transition-colors',
            filter === 'all'
              ? 'text-foreground border-b-2 border-primary -mb-px'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          All · {segments.length}
        </button>
        <button
          onClick={() => setFilter('starred')}
          className={cn(
            'flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1',
            filter === 'starred'
              ? 'text-foreground border-b-2 border-primary -mb-px'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Star size={11} className={filter === 'starred' ? 'fill-amber-400 text-amber-400' : ''} />
          Starred · {starredSegments.length}
        </button>

      </div>

      {/* List */}
      {visibleSegments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <Star size={24} className="text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            No starred phrases yet.
            <br />Hover a phrase and click ★ to bookmark it.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-0.5 p-2">
            {visibleSegments.map((seg) => {
              const isCurrent = seg.id === currentSegmentId
              // Original index in full segments list (for the number badge)
              const originalIndex = segments.indexOf(seg)
              return (
                <SegmentItem
                  key={seg.id}
                  ref={isCurrent ? currentItemRef : undefined}
                  segment={seg}
                  index={originalIndex}
                  isCurrent={isCurrent}
                  isSelected={selectedSet.has(seg.id)}
                  maxDurationMs={maxDurationMs}
                  onClick={handleSegmentClick}
                  onExtendSelection={extendSelection}
                  onExtendSelectionAsGroup={extendSelectionAsGroup}
                  onBookmarkChange={onBookmarkChange}
                  onUngroup={onUngroup}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Hint */}
      <p className="shrink-0 px-3 py-1.5 text-[10px] text-muted-foreground border-t text-center">
        Shift+click or "to here" to select a range
      </p>
    </div>
  )
}
