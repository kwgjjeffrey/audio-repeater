import { randomUUID } from 'crypto'
import type { Segment, SilenceEvent } from '../../src/renderer/types'

export interface SegmenterOptions {
  minSegmentMs: number
  maxSegmentMs: number
}

/**
 * Convert detected silence intervals into speech Segments.
 *
 * Algorithm:
 *  1. Compute speech intervals as gaps between silence events (plus head/tail).
 *  2. Merge intervals shorter than minSegmentMs into the adjacent one.
 *  3. Split intervals longer than maxSegmentMs at the midpoint.
 *  4. Emit Segment[] with stable ids.
 */
export function buildSegments(
  silences: SilenceEvent[],
  durationSec: number,
  opts: SegmenterOptions
): Segment[] {
  const { minSegmentMs, maxSegmentMs } = opts

  // Step 1: derive speech intervals from silence gaps
  const raw = speechIntervalsFromSilences(silences, durationSec)

  // Step 2: merge short segments
  const merged = mergeShort(raw, minSegmentMs)

  // Step 3: split long segments
  const split = splitLong(merged, maxSegmentMs)

  // Step 4: emit
  return split.map(([startMs, endMs]) => ({
    id: randomUUID(),
    startMs,
    endMs,
    source: 'silence' as const
  }))
}

type Interval = [startMs: number, endMs: number]

function speechIntervalsFromSilences(silences: SilenceEvent[], durationSec: number): Interval[] {
  const intervals: Interval[] = []
  let cursor = 0

  for (const s of silences) {
    const speechStart = cursor
    const speechEnd = Math.round(s.startSec * 1000)
    if (speechEnd > speechStart) {
      intervals.push([speechStart, speechEnd])
    }
    cursor = Math.round(s.endSec * 1000)
  }

  // Tail
  const totalMs = Math.round(durationSec * 1000)
  if (totalMs > cursor) {
    intervals.push([cursor, totalMs])
  }

  return intervals
}

function mergeShort(intervals: Interval[], minMs: number): Interval[] {
  if (intervals.length === 0) return []

  // Accumulate a pending interval; once it's long enough, flush it.
  // A short interval is merged forward into the next by bridging the gap.
  let pending: Interval | null = null
  const result: Interval[] = []

  for (const [start, end] of intervals) {
    if (pending !== null) {
      // Bridge: extend pending to cover the current interval end
      pending = [pending[0], end]
      if (pending[1] - pending[0] >= minMs) {
        result.push(pending)
        pending = null
      }
    } else if (end - start < minMs) {
      pending = [start, end]
    } else {
      result.push([start, end])
    }
  }

  // Flush any remaining pending into the last result or as-is
  if (pending !== null) {
    if (result.length > 0) {
      const last = result[result.length - 1]
      result[result.length - 1] = [last[0], pending[1]]
    } else {
      result.push(pending)
    }
  }

  return result
}

function splitLong(intervals: Interval[], maxMs: number): Interval[] {
  const result: Interval[] = []

  for (const [start, end] of intervals) {
    if (end - start <= maxMs) {
      result.push([start, end])
    } else {
      // Split at midpoint
      const mid = Math.round((start + end) / 2)
      result.push([start, mid], [mid, end])
    }
  }

  return result
}
