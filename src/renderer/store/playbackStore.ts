import { create } from 'zustand'
import type { PlaybackState, SegmentRange } from '../types'
import { DEFAULT_PLAYBACK_STATE } from '../types'

interface PlaybackStore extends PlaybackState {
  currentSegmentId: string | null
  isPlaying: boolean

  setSelection(range: SegmentRange | null): void
  setLoopMode(mode: 'off' | 'loop'): void
  setLoopCount(count: number | 'infinite'): void
  setPauseBetweenLoopsMs(ms: number): void
  setPlaybackRate(rate: number): void
  setCurrentSegmentId(id: string | null): void
  setIsPlaying(playing: boolean): void
  reset(): void
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  ...DEFAULT_PLAYBACK_STATE,
  currentSegmentId: null,
  isPlaying: false,

  setSelection: (range) => set({ selection: range }),
  setLoopMode: (mode) => set({ loopMode: mode }),
  setLoopCount: (count) => set({ loopCount: count }),
  setPauseBetweenLoopsMs: (ms) => set({ pauseBetweenLoopsMs: ms }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setCurrentSegmentId: (id) => set({ currentSegmentId: id }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  reset: () =>
    set({
      ...DEFAULT_PLAYBACK_STATE,
      currentSegmentId: null,
      isPlaying: false
    })
}))
