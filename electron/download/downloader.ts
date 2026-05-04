import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type YTDlpWrapType from 'yt-dlp-wrap'
// yt-dlp-wrap is CJS: require().default is the class. Using require() directly
// avoids Rollup/Vite default-import interop which can lose the .default level.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const YTDlpWrap = (require('yt-dlp-wrap') as { default: typeof YTDlpWrapType }).default

const MEDIA_EXT_RE = /\.(mp3|mp4|m4a|wav|ogg|webm|flac|aac|mkv|mov|avi)(\?|#|$)/i
const MEDIA_CONTENT_TYPE_RE = /^(audio|video)\//

export interface DownloadProgress {
  phase: 'detecting' | 'downloading' | 'processing'
  percent: number
}

export interface DownloadResult {
  filePath: string
  mimeType: string
}

function getDownloadDir(): string {
  const dir = path.join(app.getPath('downloads'), 'AudioRepeater')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Download the yt-dlp standalone binary for the current platform.
 *
 * downloadFromGithub() grabs the Python zipapp ("yt-dlp") which needs Python ≥3.10.
 * Instead we download the platform-native standalone binary:
 *   macOS  → yt-dlp_macos   (universal binary, no Python required)
 *   Linux  → yt-dlp_linux   (x86_64 standalone)
 *   Win    → yt-dlp.exe
 */
async function downloadYtDlpStandalone(destPath: string): Promise<void> {
  const assetName =
    process.platform === 'win32' ? 'yt-dlp.exe' :
    process.platform === 'darwin' ? 'yt-dlp_macos' :
    'yt-dlp_linux'

  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`

  await new Promise<void>((resolve, reject) => {
    const follow = (u: string) => {
      const proto = u.startsWith('https') ? https : http
      proto.get(u, { headers: { 'User-Agent': 'audio-repeater-app' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location!)
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} downloading yt-dlp`))
        const out = fs.createWriteStream(destPath)
        res.pipe(out)
        out.on('finish', () => out.close(() => resolve()))
        out.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

async function getYtDlpBinaryPath(): Promise<string> {
  const binDir = path.join(app.getPath('userData'), 'yt-dlp-bin')
  fs.mkdirSync(binDir, { recursive: true })
  const bin = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const binPath = path.join(binDir, bin)
  if (!fs.existsSync(binPath)) {
    await downloadYtDlpStandalone(binPath)
    if (process.platform !== 'win32') fs.chmodSync(binPath, 0o755)
  }
  return binPath
}

/** Tries a HEAD request to detect the content-type. */
async function sniffContentType(url: string): Promise<string> {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http
    const req = proto.request(url, { method: 'HEAD' }, (res) => {
      const ct = (res.headers['content-type'] ?? '').split(';')[0].trim()
      resolve(ct)
    })
    req.on('error', () => resolve(''))
    req.setTimeout(6000, () => { req.destroy(); resolve('') })
    req.end()
  })
}

async function downloadDirect(
  url: string,
  destPath: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const req = proto.get(url, (res) => {
      // Follow one redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return downloadDirect(res.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject)
      }
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const total = parseInt(res.headers['content-length'] ?? '0', 10)
      let received = 0
      const file = fs.createWriteStream(destPath)
      res.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (total > 0) onProgress(Math.round((received / total) * 90))
      })
      res.pipe(file)
      file.on('finish', () => file.close(() => { onProgress(100); resolve() }))
      file.on('error', reject)
    })
    req.on('error', reject)
  })
}

/**
 * Detect which browser cookie sources are available on this machine.
 * Returns names in priority order for yt-dlp's --cookies-from-browser.
 */
function detectAvailableBrowsers(): string[] {
  const browsers: string[] = []
  if (process.platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app')) browsers.push('chrome')
    if (fs.existsSync('/Applications/Chromium.app')) browsers.push('chromium')
    if (fs.existsSync('/Applications/Brave Browser.app')) browsers.push('brave')
    if (fs.existsSync('/Applications/Microsoft Edge.app')) browsers.push('edge')
    if (fs.existsSync('/Applications/Firefox.app')) browsers.push('firefox')
    browsers.push('safari') // always available on macOS
  } else if (process.platform === 'win32') {
    browsers.push('chrome', 'edge', 'brave', 'chromium', 'firefox')
  } else {
    browsers.push('chrome', 'chromium', 'brave', 'firefox')
  }
  return browsers
}

async function downloadWithYtDlp(
  url: string,
  onProgress: (p: DownloadProgress) => void
): Promise<DownloadResult> {
  const binPath = await getYtDlpBinaryPath()
  const ytDlp = new YTDlpWrap(binPath)

  const dir = getDownloadDir()
  const uniqueId = `ytdl-${Date.now()}`
  const outputTemplate = path.join(dir, `${uniqueId}.%(ext)s`)

  // Build base args.
  // Key findings from testing:
  //   - Do NOT specify player_client: yt-dlp auto-selects android_vr which needs no JS runtime.
  //   - Cookies break ios/android clients (they get skipped), so try without cookies first.
  //   - Format "18" is the reliable single-file 360p mp4 fallback if dash merge fails.
  const baseArgs = [
    url,
    '-o', outputTemplate,
    '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best/18',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--newline',
    '--extractor-retries', '3',
    '--fragment-retries', '3',
  ]

  // First attempt: no cookies (works for public videos, compatible with all clients).
  // Second attempt: with browser cookies (for login-gated content).
  const browsers = detectAvailableBrowsers()
  const attempts: string[][] = [
    [],
    ...(browsers.length > 0 ? [['--cookies-from-browser', browsers[0]]] : []),
  ]

  let lastError: Error = new Error('yt-dlp failed')

  for (const cookieArgs of attempts) {
    const args = [...baseArgs, ...cookieArgs]
    const result = await new Promise<DownloadResult | null>((resolve) => {
      const stderrLines: string[] = []

      const proc = ytDlp.exec(args)

      // Use built-in progress event (percent, totalSize, currentSpeed, eta)
      proc.on('progress', (p) => {
        if (p.percent != null) {
          onProgress({ phase: 'downloading', percent: Math.round(p.percent) })
        }
      })

      proc.on('ytDlpEvent', (eventType: string) => {
        if (eventType === 'ffmpeg' || eventType === 'merger') {
          onProgress({ phase: 'processing', percent: 99 })
        }
      })

      // ytDlpProcess is the underlying ChildProcess — stderr lives there
      proc.ytDlpProcess?.stderr?.on('data', (chunk: Buffer) => {
        stderrLines.push(chunk.toString())
      })

      proc.on('close', (code: number | null) => {
        if (code !== 0) {
          const errText = stderrLines.join('').slice(-1000)
          lastError = new Error(
            errText.includes('Sign in to confirm') || errText.includes('age-restricted')
              ? 'YouTube requires sign-in. Log in to YouTube in Chrome or Safari first, then try again.'
              : errText.includes('429') || errText.includes('Too Many Requests')
                ? 'YouTube is rate-limiting requests. Wait a minute and try again.'
                : errText.includes('Video unavailable') || errText.includes('Private video')
                  ? 'Video is unavailable or private.'
                  : errText.trim() || `yt-dlp exited with code ${code}`
          )
          return resolve(null)
        }

        const files = fs.readdirSync(dir)
          .filter(f => f.startsWith(uniqueId))
          .map(f => path.join(dir, f))

        if (files.length === 0) {
          lastError = new Error('yt-dlp finished but no output file was found')
          return resolve(null)
        }

        const filePath = files[0]
        const ext = path.extname(filePath).slice(1).toLowerCase()
        const mimeType = ['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)
          ? `video/${ext === 'mkv' ? 'x-matroska' : ext}`
          : `audio/${ext}`

        resolve({ filePath, mimeType })
      })

      proc.on('error', (err: Error) => {
        lastError = err
        resolve(null)
      })
    })

    if (result) return result
    // If cookies attempt failed, reset progress and try without cookies
    if (cookieArgs.length > 0) {
      onProgress({ phase: 'downloading', percent: 0 })
    }
  }

  throw lastError
}

/**
 * Main entry point.
 * 1. Sniff Content-Type via HEAD request.
 * 2. If it's a direct media URL, download it with https.
 * 3. Otherwise fall back to yt-dlp (YouTube, Vimeo, etc.).
 */
export async function downloadMediaFromUrl(
  url: string,
  onProgress: (p: DownloadProgress) => void
): Promise<DownloadResult> {
  onProgress({ phase: 'detecting', percent: 0 })

  const isDirectExt = MEDIA_EXT_RE.test(url)
  const contentType = isDirectExt ? '' : await sniffContentType(url)
  const isDirectMedia = isDirectExt || MEDIA_CONTENT_TYPE_RE.test(contentType)

  if (isDirectMedia) {
    const extMatch = url.match(MEDIA_EXT_RE)
    const ext = extMatch ? extMatch[1] : (contentType.split('/')[1] ?? 'mp4')
    const filename = `download-${Date.now()}.${ext}`
    const filePath = path.join(getDownloadDir(), filename)
    const mime = contentType || (MEDIA_EXT_RE.test(`.${ext}`) ? `audio/${ext}` : `video/${ext}`)

    onProgress({ phase: 'downloading', percent: 5 })
    await downloadDirect(url, filePath, (pct) => {
      onProgress({ phase: 'downloading', percent: pct })
    })
    return { filePath, mimeType: mime }
  }

  // Platform URL — use yt-dlp
  onProgress({ phase: 'downloading', percent: 0 })
  return downloadWithYtDlp(url, onProgress)
}
