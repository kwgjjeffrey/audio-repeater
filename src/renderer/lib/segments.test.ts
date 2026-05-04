import { describe, it, expect } from 'vitest'
import { findSegmentAt, rangeBounds, segmentsInRange } from './segments'
import type { Segment } from '../types'

const seg = (id: string, startMs: number, endMs: number): Segment => ({
  id,
  startMs,
  endMs,
  source: 'silence'
})

const SEGMENTS: Segment[] = [
  seg('a', 0, 2000),
  seg('b', 2500, 5000),
  seg('c', 5500, 8000),
  seg('d', 8500, 11000)
]

describe('findSegmentAt', () => {
  it('finds segment at a position inside it', () => {
    expect(findSegmentAt(SEGMENTS, 1000)?.id).toBe('a')
    expect(findSegmentAt(SEGMENTS, 3000)?.id).toBe('b')
    expect(findSegmentAt(SEGMENTS, 9999)?.id).toBe('d')
  })

  it('returns null when position falls in a gap (silence)', () => {
    expect(findSegmentAt(SEGMENTS, 2100)).toBeNull() // gap between a and b
    expect(findSegmentAt(SEGMENTS, 5200)).toBeNull() // gap between b and c
  })

  it('returns null before first segment', () => {
    expect(findSegmentAt(SEGMENTS, -1)).toBeNull()
  })

  it('returns null after last segment', () => {
    expect(findSegmentAt(SEGMENTS, 12000)).toBeNull()
  })

  it('returns null for empty segments array', () => {
    expect(findSegmentAt([], 500)).toBeNull()
  })

  it('handles exact boundary: startMs is inclusive', () => {
    expect(findSegmentAt(SEGMENTS, 2500)?.id).toBe('b')
  })

  it('handles exact boundary: endMs is exclusive', () => {
    expect(findSegmentAt(SEGMENTS, 2000)).toBeNull() // a ends at 2000, gap starts
  })
})

describe('rangeBounds', () => {
  it('returns correct bounds for a single-segment selection', () => {
    const result = rangeBounds(SEGMENTS, { firstSegId: 'b', lastSegId: 'b' })
    expect(result).toEqual({ startMs: 2500, endMs: 5000 })
  })

  it('returns correct bounds for a multi-segment selection', () => {
    const result = rangeBounds(SEGMENTS, { firstSegId: 'a', lastSegId: 'c' })
    expect(result).toEqual({ startMs: 0, endMs: 8000 })
  })

  it('handles reversed order (shift-click from later to earlier)', () => {
    const result = rangeBounds(SEGMENTS, { firstSegId: 'c', lastSegId: 'a' })
    expect(result).toEqual({ startMs: 0, endMs: 8000 })
  })

  it('returns null when a segment id is not found', () => {
    expect(rangeBounds(SEGMENTS, { firstSegId: 'x', lastSegId: 'b' })).toBeNull()
  })
})

describe('segmentsInRange', () => {
  it('returns all segments within the range', () => {
    const result = segmentsInRange(SEGMENTS, { firstSegId: 'a', lastSegId: 'c' })
    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns single segment for single-segment range', () => {
    const result = segmentsInRange(SEGMENTS, { firstSegId: 'b', lastSegId: 'b' })
    expect(result.map((s) => s.id)).toEqual(['b'])
  })
})
