import type { Segment, SegmentRange } from '../types'

/**
 * Binary search: find the segment whose [startMs, endMs) range contains `posMs`.
 * Returns null if posMs is before the first segment or after the last.
 */
export function findSegmentAt(segments: Segment[], posMs: number): Segment | null {
  if (segments.length === 0) return null

  let lo = 0
  let hi = segments.length - 1

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const seg = segments[mid]
    if (posMs < seg.startMs) {
      hi = mid - 1
    } else if (posMs >= seg.endMs) {
      lo = mid + 1
    } else {
      return seg
    }
  }

  return null
}

/**
 * Given a selection range (firstSegId..lastSegId), compute the effective
 * startMs and endMs in milliseconds.
 */
export function rangeBounds(
  segments: Segment[],
  range: SegmentRange
): { startMs: number; endMs: number } | null {
  const first = segments.find((s) => s.id === range.firstSegId)
  const last = segments.find((s) => s.id === range.lastSegId)
  if (!first || !last) return null

  const startMs = Math.min(first.startMs, last.startMs)
  const endMs = Math.max(first.endMs, last.endMs)
  return { startMs, endMs }
}

/**
 * Get all segments that fall within a SegmentRange (inclusive of both endpoints).
 */
export function segmentsInRange(segments: Segment[], range: SegmentRange): Segment[] {
  const bounds = rangeBounds(segments, range)
  if (!bounds) return []
  return segments.filter((s) => s.startMs >= bounds.startMs && s.endMs <= bounds.endMs)
}

/**
 * Returns the index of a segment by id.
 */
export function segmentIndex(segments: Segment[], id: string): number {
  return segments.findIndex((s) => s.id === id)
}

/**
 * Navigate: return the segment before/after the current selection's first/last boundary.
 */
export function prevSegment(segments: Segment[], currentId: string): Segment | null {
  const idx = segmentIndex(segments, currentId)
  return idx > 0 ? segments[idx - 1] : null
}

export function nextSegment(segments: Segment[], currentId: string): Segment | null {
  const idx = segmentIndex(segments, currentId)
  return idx >= 0 && idx < segments.length - 1 ? segments[idx + 1] : null
}
