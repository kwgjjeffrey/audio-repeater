import { BrowserWindow, IpcMain } from 'electron'
import { randomUUID } from 'crypto'
import { detectSilence } from '../analysis/silenceDetect'
import { buildSegments } from '../analysis/segmenter'
import type { AnalysisOptions, Project } from '../../src/renderer/types'

export function registerAnalyzeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'analyze',
    async (
      event,
      filePath: string,
      mediaHash: string,
      options: AnalysisOptions
    ): Promise<Project> => {
      const { noiseDb, silenceDurationSec, minSegmentMs, maxSegmentMs } = options

      // Send progress back to the renderer window that invoked this call
      const sender = BrowserWindow.fromWebContents(event.sender)
      function sendProgress(pct: number) {
        if (sender && !sender.isDestroyed()) {
          sender.webContents.send('analysis-progress', pct)
        }
      }

      const { silences, durationSec } = await detectSilence(
        filePath,
        noiseDb,
        silenceDurationSec,
        sendProgress
      )

      const segments = buildSegments(silences, durationSec, { minSegmentMs, maxSegmentMs })

      const now = Date.now()

      const project: Project = {
        id: randomUUID(),
        mediaPath: filePath,
        mediaHash,
        durationMs: Math.round(durationSec * 1000),
        segments,
        createdAt: now,
        updatedAt: now
      }

      return project
    }
  )
}
