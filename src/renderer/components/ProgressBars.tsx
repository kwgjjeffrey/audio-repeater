import { useEffect, useRef, useState, useCallback, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import type { Segment, SegmentRange } from '../types'
import { rangeBounds, segmentsInRange } from '../lib/segments'
import { usePlaybackStore } from '../store/playbackStore'

interface ProgressBarsProps {
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>
  durationMs: number
  segments: Segment[]
  /** Called when the user seeks on the overall (full-file) bar — used to auto-switch to Play mode */
  onOverallSeek?: () => void
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function useCurrentTimeMs(mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>) {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    const onTime = () => setMs(el.currentTime * 1000)
    el.addEventListener('timeupdate', onTime)
    // Also listen for seek events so the bar jumps immediately
    el.addEventListener('seeked', onTime)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('seeked', onTime)
    }
  }, [mediaRef])
  return ms
}

function useSeek(
  mediaRef: RefObject<HTMLVideoElement | HTMLAudioElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  startMs: number,
  endMs: number
) {
  const seekTo = useCallback(
    (clientX: number) => {
      const el = mediaRef.current
      const track = trackRef.current
      if (!el || !track) return
      const rect = track.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      el.currentTime = (startMs + pct * (endMs - startMs)) / 1000
    },
    [mediaRef, trackRef, startMs, endMs]
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      seekTo(e.clientX)

      const onMove = (ev: MouseEvent) => seekTo(ev.clientX)
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [seekTo]
  )

  return { onMouseDown }
}

interface SingleBarProps {
  label: string
  subLabel?: string
  currentMs: number
  startMs: number
  endMs: number
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>
  accentClass?: string
  /** Called the moment the user starts dragging/clicking this bar */
  onSeekStart?: () => void
}

function SingleBar({
  label,
  subLabel,
  currentMs,
  startMs,
  endMs,
  mediaRef,
  accentClass = 'bg-primary',
  onSeekStart
}: SingleBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const { onMouseDown: rawMouseDown } = useSeek(mediaRef, trackRef, startMs, endMs)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onSeekStart?.()
      rawMouseDown(e)
    },
    [rawMouseDown, onSeekStart]
  )

  const pct = endMs > startMs
    ? Math.max(0, Math.min(100, ((currentMs - startMs) / (endMs - startMs)) * 100))
    : 0

  return (
    <div className="flex flex-col gap-1 px-4">
      {/* Labels row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase">
          {label}
        </span>
        {subLabel && (
          <span className="text-[10px] text-muted-foreground">{subLabel}</span>
        )}
      </div>

      {/* Track */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] tabular-nums text-muted-foreground w-8 shrink-0 text-right">
          {formatMs(currentMs - startMs)}
        </span>

        <div
          ref={trackRef}
          className="relative flex-1 h-1.5 bg-muted rounded-full cursor-pointer group"
          onMouseDown={onMouseDown}
        >
          {/* Fill */}
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-none', accentClass)}
            style={{ width: `${pct.toFixed(2)}%` }}
          />
          {/* Thumb */}
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full',
              'opacity-0 group-hover:opacity-100 transition-opacity shadow-sm',
              accentClass
            )}
            style={{ left: `${pct.toFixed(2)}%` }}
          />
        </div>

        <span className="text-[10px] tabular-nums text-muted-foreground w-8 shrink-0">
          {formatMs(endMs - startMs)}
        </span>
      </div>
    </div>
  )
}

export default function ProgressBars({ mediaRef, durationMs, segments, onOverallSeek }: ProgressBarsProps) {
  const { selection } = usePlaybackStore()
  const currentMs = useCurrentTimeMs(mediaRef)

  let selectionBounds: { startMs: number; endMs: number } | null = null
  let selectionPhraseCount = 0
  if (selection) {
    selectionBounds = rangeBounds(segments, selection)
    selectionPhraseCount = segmentsInRange(segments, selection).length
  }

  return (
    <div className="flex flex-col gap-2.5 py-3 border-t bg-card">
      {/* Selection progress — only when a range is selected */}
      {selectionBounds && (
        <SingleBar
          label="Selection"
          subLabel={selectionPhraseCount > 1 ? `${selectionPhraseCount} phrases` : '1 phrase'}
          currentMs={Math.max(selectionBounds.startMs, Math.min(currentMs, selectionBounds.endMs))}
          startMs={selectionBounds.startMs}
          endMs={selectionBounds.endMs}
          mediaRef={mediaRef}
          accentClass="bg-primary"
        />
      )}

      {/* Overall file progress — seeking here auto-switches to play-through mode */}
      <SingleBar
        label="Overall"
        subLabel={formatMs(durationMs)}
        currentMs={currentMs}
        startMs={0}
        endMs={durationMs}
        mediaRef={mediaRef}
        accentClass={selectionBounds ? 'bg-muted-foreground/60' : 'bg-primary'}
        onSeekStart={onOverallSeek}
      />
    </div>
  )
}
