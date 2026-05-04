import { dialog, IpcMain } from 'electron'
import { createReadStream, statSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import mime from 'mime-types'

const VIDEO_EXTS = ['mp4', 'mkv', 'mov', 'webm', 'avi', 'm4v']
const AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'opus']

export function registerFileHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Media File',
      properties: ['openFile'],
      filters: [
        { name: 'Media', extensions: [...VIDEO_EXTS, ...AUDIO_EXTS] },
        { name: 'Video', extensions: VIDEO_EXTS },
        { name: 'Audio', extensions: AUDIO_EXTS }
      ]
    })

    if (result.canceled || !result.filePaths[0]) return null

    const filePath = result.filePaths[0]
    const mediaHash = await hashFile(filePath)
    const mimeType = (mime.lookup(filePath) as string | false) || 'application/octet-stream'

    return { filePath, mediaHash, mimeType }
  })

  // Open a known path directly (playlist re-open) without a dialog
  ipcMain.handle('open-path', async (_event, filePath: string) => {
    if (!filePath || !existsSync(filePath)) return null
    const mediaHash = await hashFile(filePath)
    const mimeType = (mime.lookup(filePath) as string | false) || 'application/octet-stream'
    return { filePath, mediaHash, mimeType }
  })
}

/** Fast hash: sha1 of first+last 1MB + file size. Cheap but stable. */
export async function hashFile(filePath: string): Promise<string> {
  const stats = statSync(filePath)
  const size = stats.size
  const chunkSize = Math.min(1024 * 1024, Math.floor(size / 2))

  const hash = createHash('sha1')
  hash.update(String(size))

  await readChunk(filePath, 0, chunkSize, hash)
  if (size > chunkSize * 2) {
    await readChunk(filePath, size - chunkSize, chunkSize, hash)
  }

  return hash.digest('hex')
}

function readChunk(
  filePath: string,
  start: number,
  length: number,
  hash: ReturnType<typeof createHash>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { start, end: start + length - 1 })
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', resolve)
    stream.on('error', reject)
  })
}
