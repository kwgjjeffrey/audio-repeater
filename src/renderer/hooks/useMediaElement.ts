import { useCallback } from 'react'
import { usePlaybackStore } from '../store/playbackStore'
import type { Segment } from '../types'
import { rangeBounds, prevSegment, nextSegment } from '../lib/segments'

/**
 * Convenience hook for controlling playback from UI components.
 */
export function useMediaElement(
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>,
  segments: Segment[]
) {
  const { isPlaying, selection, currentSegmentId, setSelection, setLoopMode, loopMode } =
    usePlaybackStore()

  const togglePlay = useCallback(() => {
    const el = mediaRef.current
    if (!el) return
    if (isPlaying) {
      el.pause()
    } else {
      // If there's a selection and we're at/past the end, seek to selection start first
      if (selection) {
        const bounds = rangeBounds(segments, selection)
        const posMs = el.currentTime * 1000
        if (bounds && posMs >= bounds.endMs) {
          el.currentTime = bounds.startMs / 1000
        }
      }
      el.play().catch(() => {})
    }
  }, [mediaRef, isPlaying, selection, segments])

  const seekToSegment = useCallback(
    (segmentId: string) => {
      const el = mediaRef.current
      if (!el) return
      const seg = segments.find((s) => s.id === segmentId)
      if (!seg) return
      el.currentTime = seg.startMs / 1000
      el.play().catch(() => {})
    },
    [mediaRef, segments]
  )

  const goToPrevSegment = useCallback(() => {
    const anchorId = currentSegmentId ?? selection?.firstSegId
    if (!anchorId) return
    const prev = prevSegment(segments, anchorId)
    if (prev) {
      setSelection({ firstSegId: prev.id, lastSegId: prev.id })
      seekToSegment(prev.id)
    }
  }, [currentSegmentId, selection, segments, setSelection, seekToSegment])

  const goToNextSegment = useCallback(() => {
    const anchorId = currentSegmentId ?? selection?.lastSegId
    if (!anchorId) return
    const next = nextSegment(segments, anchorId)
    if (next) {
      setSelection({ firstSegId: next.id, lastSegId: next.id })
      seekToSegment(next.id)
    }
  }, [currentSegmentId, selection, segments, setSelection, seekToSegment])

  const toggleLoop = useCallback(() => {
    setLoopMode(loopMode === 'loop' ? 'off' : 'loop')
  }, [loopMode, setLoopMode])

  return { togglePlay, seekToSegment, goToPrevSegment, goToNextSegment, toggleLoop }
}
