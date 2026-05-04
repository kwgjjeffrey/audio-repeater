import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

/** Resolve the ffmpeg binary path — bundled via ffmpeg-static or app resources. */
export function getFfmpegPath(): string {
  // In packaged app, binary is copied to resources/ffmpeg
  const resourcesFfmpeg = join(process.resourcesPath ?? '', 'ffmpeg')
  if (existsSync(resourcesFfmpeg)) return resourcesFfmpeg

  // In dev: use ffmpeg-static from node_modules
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require('ffmpeg-static') as string
    if (ffmpegStatic && existsSync(ffmpegStatic)) return ffmpegStatic
  } catch {
    // fallback below
  }

  return 'ffmpeg'
}

export interface FfmpegResult {
  stdout: string
  stderr: string
  durationSec: number
}

/**
 * Run ffmpeg with the given args.
 * @param onProgress  Optional callback receiving 0–100 as ffmpeg processes the file.
 *                    Parsed from ffmpeg's time= output in stderr.
 */
export function runFfmpeg(
  args: string[],
  onProgress?: (pct: number) => void
): Promise<FfmpegResult> {
  return new Promise((resolve, reject) => {
    const bin = getFfmpegPath()
    // -stats_period 0.5 gives us a progress line every 500ms
    const proc = spawn(bin, ['-stats_period', '0.5', ...args])

    let stdout = ''
    let stderr = ''
    let totalDurationSec = 0

    function handleChunk(chunk: Buffer) {
      const text = chunk.toString()
      stderr += text

      // Parse total duration once from the header
      if (totalDurationSec === 0) {
        const m = text.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/)
        if (m) {
          totalDurationSec =
            Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
        }
      }

      // Parse the current position from ffmpeg's stats line: "time=HH:MM:SS.ms"
      if (onProgress && totalDurationSec > 0) {
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/)
        if (timeMatch) {
          const elapsed =
            Number(timeMatch[1]) * 3600 +
            Number(timeMatch[2]) * 60 +
            Number(timeMatch[3])
          const pct = Math.min(99, Math.round((elapsed / totalDurationSec) * 100))
          onProgress(pct)
        }
      }
    }

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', handleChunk)

    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`))
        return
      }
      const durationSec = parseDuration(stderr)
      if (onProgress) onProgress(100)
      resolve({ stdout, stderr, durationSec })
    })
  })
}

/** Parse "Duration: HH:MM:SS.ms" from ffmpeg stderr */
function parseDuration(stderr: string): number {
  const m = stderr.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) return 0
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}
