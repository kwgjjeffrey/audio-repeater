/**
 * Standalone test script for yt-dlp download flow.
 * Run: node scripts/test-download.mjs <youtube-url>
 */

import { createRequire } from 'module'
import { existsSync, mkdirSync, chmodSync, readdirSync, createWriteStream } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execFile } from 'child_process'
import https from 'https'
import http from 'http'

const require = createRequire(import.meta.url)
const YTDlpWrap = require('yt-dlp-wrap').default

const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/test-download.mjs <url>')
  process.exit(1)
}

// --- 1. Download the correct standalone binary ---
const binDir = join(homedir(), '.cache', 'audio-repeater', 'yt-dlp-bin')
mkdirSync(binDir, { recursive: true })
const binPath = join(binDir, 'yt-dlp')

async function downloadStandalone(dest) {
  // macOS standalone binary — no Python dependency
  const asset = process.platform === 'win32' ? 'yt-dlp.exe'
              : process.platform === 'darwin' ? 'yt-dlp_macos'
              : 'yt-dlp_linux'
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`
  console.log(`Downloading ${asset}…`)

  await new Promise((resolve, reject) => {
    function follow(u) {
      const proto = u.startsWith('https') ? https : http
      proto.get(u, { headers: { 'User-Agent': 'audio-repeater-test' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) return follow(res.headers.location)
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        const out = createWriteStream(dest)
        res.pipe(out)
        out.on('finish', () => out.close(resolve))
        out.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

if (!existsSync(binPath)) {
  await downloadStandalone(binPath)
  chmodSync(binPath, 0o755)
  console.log('✓ Downloaded to', binPath)
} else {
  console.log('✓ Using cached binary at', binPath)
}

// Print version
const version = await new Promise(res => execFile(binPath, ['--version'], (_, out) => res(out.trim())))
console.log('yt-dlp version:', version)

// --- 2. Run download with Chrome cookies ---
const outDir = join(homedir(), 'Downloads', 'AudioRepeater-test')
mkdirSync(outDir, { recursive: true })
const uniqueId = `test-${Date.now()}`
const outputTemplate = join(outDir, `${uniqueId}.%(ext)s`)

const args = [
  url,
  '-o', outputTemplate,
  '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best/18',
  '--merge-output-format', 'mp4',
  '--no-playlist',
  '--newline',
  '--extractor-retries', '3',
  // No player_client specified → yt-dlp auto-picks android_vr (no JS runtime needed)
  // No cookies → compatible with all clients; add --cookies-from-browser chrome for private videos
]

console.log('\n--- Running yt-dlp (auto client, no cookies) ---')
console.log(binPath, args.join(' '))
console.log()

const ytDlp = new YTDlpWrap(binPath)
const proc = ytDlp.exec(args)

proc.on('ytDlpEvent', (type, data) => console.log(`[${type}] ${data}`))
proc.on('progress', (p) => {
  if (p.percent != null) process.stdout.write(`\r  ${p.percent?.toFixed(1)}% @ ${p.currentSpeed ?? '?'}  `)
})
proc.ytDlpProcess?.stderr?.on('data', (chunk) => process.stderr.write('[stderr] ' + chunk))

await new Promise((resolve) => {
  proc.on('close', (code) => {
    console.log('\n--- yt-dlp exited with code', code, '---')
    const files = readdirSync(outDir).filter(f => f.startsWith(uniqueId))
    if (files.length > 0) console.log('✓ Output:', join(outDir, files[0]))
    else console.log('✗ No output file')
    resolve()
  })
  proc.on('error', (err) => { console.error('Error:', err.message); resolve() })
})
