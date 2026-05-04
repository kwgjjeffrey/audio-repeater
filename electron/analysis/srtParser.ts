export interface SubtitleEntry {
  startMs: number
  endMs: number
  text: string
}

/** Parse a timecode like  00:01:23,456  or  00:01:23.456  to milliseconds */
function parseTime(s: string): number {
  // Handle HH:MM:SS,mmm  or HH:MM:SS.mmm  or MM:SS.mmm
  const cleaned = s.trim().replace(',', '.')
  const parts = cleaned.split(':')
  if (parts.length === 3) {
    const [h, m, rest] = parts
    const [sec, ms = '0'] = rest.split('.')
    return (
      parseInt(h) * 3_600_000 +
      parseInt(m) * 60_000 +
      parseInt(sec) * 1000 +
      parseInt(ms.padEnd(3, '0').slice(0, 3))
    )
  }
  if (parts.length === 2) {
    const [m, rest] = parts
    const [sec, ms = '0'] = rest.split('.')
    return (
      parseInt(m) * 60_000 +
      parseInt(sec) * 1000 +
      parseInt(ms.padEnd(3, '0').slice(0, 3))
    )
  }
  return 0
}

/** SRT: numbered blocks separated by blank lines */
export function parseSrt(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = []
  const blocks = content.replace(/\r\n/g, '\n').split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    // Skip the sequence number line if present
    let timeLine = lines[0]
    let textStart = 1
    if (/^\d+$/.test(timeLine.trim())) {
      timeLine = lines[1]
      textStart = 2
    }

    const arrow = timeLine.includes('-->')
    if (!arrow) continue

    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim())
    const startMs = parseTime(startStr)
    const endMs = parseTime(endStr)
    const text = lines
      .slice(textStart)
      .join(' ')
      .replace(/<[^>]+>/g, '') // strip HTML tags from SRT
      .trim()

    if (text) entries.push({ startMs, endMs, text })
  }

  return entries
}

/** WebVTT: similar to SRT but with optional cue identifiers and WEBVTT header */
export function parseVtt(content: string): SubtitleEntry[] {
  // Strip the WEBVTT header and NOTE blocks
  const body = content
    .replace(/\r\n/g, '\n')
    .replace(/^WEBVTT[^\n]*\n/, '')
    .replace(/NOTE[^\n]*(\n[^\n]+)*/g, '')
  return parseSrt(body) // VTT cue format is identical after stripping the header
}

/** Detect format and parse accordingly */
export function parseSubtitleFile(filename: string, content: string): SubtitleEntry[] {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'vtt') return parseVtt(content)
  // SRT or plain text — try SRT first, fall back to line-by-line
  const srt = parseSrt(content)
  if (srt.length > 0) return srt
  return []
}

/**
 * Map parsed subtitle entries onto existing segments by timestamp overlap.
 * Segments with no overlapping subtitle get no text (existing text preserved if any).
 */
export function mapSubtitlesToSegments<T extends { id: string; startMs: number; endMs: number; text?: string }>(
  segments: T[],
  subtitles: SubtitleEntry[]
): T[] {
  return segments.map((seg) => {
    const overlapping = subtitles.filter(
      (sub) => sub.startMs < seg.endMs && sub.endMs > seg.startMs
    )
    if (overlapping.length === 0) return seg
    const text = overlapping.map((s) => s.text).join(' ').trim()
    return { ...seg, text }
  })
}
