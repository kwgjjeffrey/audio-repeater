import { ipcMain } from 'electron'
import { downloadMediaFromUrl } from '../download/downloader'
import { createHash } from 'crypto'
import * as fs from 'fs'
import mime from 'mime-types'

export function registerDownloadHandlers(mainWindow: Electron.BrowserWindow) {
  ipcMain.handle('download-url', async (_, url: string) => {
    const result = await downloadMediaFromUrl(url, (progress) => {
      mainWindow.webContents.send('download-progress', progress)
    })

    // Compute media hash for caching (same as open-file flow)
    const hash = createHash('sha1')
    const stream = fs.createReadStream(result.filePath, { start: 0, end: 512 * 1024 })
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk as Buffer))
      stream.on('end', resolve)
      stream.on('error', reject)
    })
    const mediaHash = hash.digest('hex')

    // Resolve mime type from file extension if not provided
    const resolvedMime = result.mimeType || mime.lookup(result.filePath) || 'video/mp4'

    return {
      filePath: result.filePath,
      mediaHash,
      mimeType: resolvedMime as string
    }
  })
}
