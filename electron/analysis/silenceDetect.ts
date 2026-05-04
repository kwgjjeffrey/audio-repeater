import type { SilenceEvent } from '../../src/renderer/types'
import { runFfmpeg } from './ffmpeg'

export interface SilenceDetectResult {
  silences: SilenceEvent[]
  durationSec: number
}

/**
 * Run ffmpeg silencedetect on the given file and return silence intervals.
 * @param filePath  Absolute path to the media file
 * @param noiseDb   Silence threshold in dB, e.g. -30
 * @param durationSec  Minimum silence duration to detect, e.g. 0.4
 */
export async function detectSilence(
  filePath: string,
  noiseDb: number,
  durationSec: number,
  onProgress?: (pct: number) => void
): Promise<SilenceDetectResult> {
  const filter = `silencedetect=noise=${noiseDb}dB:d=${durationSec}`
  const { stderr, durationSec: totalDuration } = await runFfmpeg(
    [
      '-i', filePath,
      '-vn',          // skip video decoding — massive speedup for video files
      '-ar', '8000',  // downsample to 8kHz; silence detection needs no more
      '-ac', '1',     // mono; halves data again
      '-af', filter,
      '-f', 'null',
      '-'
    ],
    onProgress
  )

  const silences = parseSilenceEvents(stderr)
  return { silences, durationSec: totalDuration }
}

/**
 * Parse ffmpeg silencedetect output lines like:
 *   [silencedetect @ 0x...] silence_start: 1.234
 *   [silencedetect @ 0x...] silence_end: 2.567 | silence_duration: 1.333
 */
export function parseSilenceEvents(stderr: string): SilenceEvent[] {
  const lines = stderr.split('\n')
  const startMap = new Map<number, number>()
  const events: SilenceEvent[] = []
  let pendingStart: number | null = null

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/)
    if (startMatch) {
      pendingStart = Number(startMatch[1])
      continue
    }

    const endMatch = line.match(/silence_end:\s*([\d.]+)/)
    if (endMatch && pendingStart !== null) {
      events.push({ startSec: pendingStart, endSec: Number(endMatch[1]) })
      pendingStart = null
    }
  }

  return events
}
