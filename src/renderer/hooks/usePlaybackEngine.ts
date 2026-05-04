import { useEffect, useRef, useCallback } from 'react'
import type { Segment } from '../types'
import { findSegmentAt, rangeBounds } from '../lib/segments'
import { usePlaybackStore } from '../store/playbackStore'

/**
 * Core playback engine hook.
 *
 * Attaches to a media element ref and:
 *  - Tracks current segment via timeupdate binary search
 *  - Enforces looping within the selected range, with a pause between loops
 *  - Syncs isPlaying state
 */
export function usePlaybackEngine(
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>,
  segments: Segment[]
) {
  const {
    selection,
    loopMode,
    loopCount,
    pauseBetweenLoopsMs,
    playbackRate,
    setCurrentSegmentId,
    setIsPlaying,
    setLoopMode
  } = usePlaybackStore()

  // Mutable ref for loop state so we don't need to re-attach event listeners on every render
  const loopRef = useRef({
    loopMode,
    loopCount,
    pauseBetweenLoopsMs,
    selection,
    remainingLoops: loopCount === 'infinite' ? Infinity : (loopCount as number),
    inPause: false
  })

  // Keep loopRef in sync with store
  useEffect(() => {
    const wasInfinite = loopRef.current.loopCount === 'infinite'
    const nowInfinite = loopCount === 'infinite'
    const modeChanged = loopRef.current.loopMode !== loopMode
    const selectionChanged = loopRef.current.selection !== selection

    loopRef.current.loopMode = loopMode
    loopRef.current.loopCount = loopCount
    loopRef.current.pauseBetweenLoopsMs = pauseBetweenLoopsMs
    loopRef.current.selection = selection

    // Reset remaining loops when mode, count, or selection changes
    if (modeChanged || selectionChanged || wasInfinite !== nowInfinite) {
      loopRef.current.remainingLoops = loopCount === 'infinite' ? Infinity : (loopCount as number)
      loopRef.current.inPause = false
    }
  }, [loopMode, loopCount, pauseBetweenLoopsMs, selection])

  // Sync playback rate
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    el.playbackRate = playbackRate
  }, [mediaRef, playbackRate])

  const handleTimeUpdate = useCallback(() => {
    const el = mediaRef.current
    if (!el) return

    const posMs = el.currentTime * 1000
    const seg = findSegmentAt(segments, posMs)
    setCurrentSegmentId(seg?.id ?? null)

    const { loopMode, selection, remainingLoops, inPause, pauseBetweenLoopsMs } = loopRef.current
    if (loopMode !== 'loop' || !selection || inPause) return

    const bounds = rangeBounds(segments, selection)
    if (!bounds) return

    if (posMs >= bounds.endMs - 100) {
      // Within 100ms of the end — trigger loop
      if (remainingLoops <= 0) {
        // Exhausted loops: turn off loop mode
        setLoopMode('off')
        return
      }

      loopRef.current.inPause = true
      loopRef.current.remainingLoops -= 1

      el.pause()

      setTimeout(() => {
        const currentEl = mediaRef.current
        if (!currentEl) return
        currentEl.currentTime = bounds.startMs / 1000
        currentEl.play().catch(() => {})
        loopRef.current.inPause = false
      }, pauseBetweenLoopsMs)
    }
  }, [mediaRef, segments, setCurrentSegmentId, setLoopMode])

  useEffect(() => {
    const el = mediaRef.current
    // Guard: el must be a real DOM element (has addEventListener)
    if (!el || typeof el.addEventListener !== 'function') return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)

    el.addEventListener('timeupdate', handleTimeUpdate)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)

    return () => {
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
  }, [mediaRef, handleTimeUpdate, setIsPlaying])
}
