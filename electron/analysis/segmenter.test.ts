import { describe, it, expect } from 'vitest'
import { buildSegments } from './segmenter'
import { parseSilenceEvents } from './silenceDetect'
import type { SilenceEvent } from '../../src/renderer/types'

const OPTS = { minSegmentMs: 800, maxSegmentMs: 8000 }

describe('parseSilenceEvents', () => {
  it('parses silence_start and silence_end pairs', () => {
    const stderr = `
[silencedetect @ 0x1234] silence_start: 1.5
[silencedetect @ 0x1234] silence_end: 2.0 | silence_duration: 0.5
[silencedetect @ 0x1234] silence_start: 5.0
[silencedetect @ 0x1234] silence_end: 5.6 | silence_duration: 0.6
`
    const result = parseSilenceEvents(stderr)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ startSec: 1.5, endSec: 2.0 })
    expect(result[1]).toEqual({ startSec: 5.0, endSec: 5.6 })
  })

  it('returns empty array when no silence detected', () => {
    expect(parseSilenceEvents('some other output')).toEqual([])
  })
})

describe('buildSegments', () => {
  it('produces one segment for a file with no silence', () => {
    const segments = buildSegments([], 5.0, OPTS)
    expect(segments).toHaveLength(1)
    expect(segments[0].startMs).toBe(0)
    expect(segments[0].endMs).toBe(5000)
    expect(segments[0].source).toBe('silence')
  })

  it('splits speech around silences', () => {
    const silences: SilenceEvent[] = [{ startSec: 2.0, endSec: 3.0 }]
    const segments = buildSegments(silences, 6.0, OPTS)
    // 0–2000ms, 3000–6000ms
    expect(segments).toHaveLength(2)
    expect(segments[0].startMs).toBe(0)
    expect(segments[0].endMs).toBe(2000)
    expect(segments[1].startMs).toBe(3000)
    expect(segments[1].endMs).toBe(6000)
  })

  it('merges a short segment into the next one', () => {
    // Speech: 0–400ms (short), 1000–5000ms
    const silences: SilenceEvent[] = [{ startSec: 0.4, endSec: 1.0 }]
    const segments = buildSegments(silences, 5.0, { ...OPTS, minSegmentMs: 800 })
    // 400ms < 800ms min → should be merged into the next
    expect(segments).toHaveLength(1)
    expect(segments[0].startMs).toBe(0)
    expect(segments[0].endMs).toBe(5000)
  })

  it('splits a long segment at midpoint', () => {
    // One continuous speech block of 20 seconds
    const segments = buildSegments([], 20.0, { ...OPTS, maxSegmentMs: 8000 })
    expect(segments).toHaveLength(2)
    expect(segments[0].startMs).toBe(0)
    expect(segments[0].endMs).toBe(10000)
    expect(segments[1].startMs).toBe(10000)
    expect(segments[1].endMs).toBe(20000)
  })

  it('assigns unique ids to each segment', () => {
    const silences: SilenceEvent[] = [
      { startSec: 2, endSec: 3 },
      { startSec: 5, endSec: 6 }
    ]
    const segments = buildSegments(silences, 10.0, OPTS)
    const ids = segments.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
