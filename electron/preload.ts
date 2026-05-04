import { contextBridge, ipcRenderer } from 'electron'
import type { AnalysisOptions, Project, ElectronAPI, DownloadProgress } from '../src/renderer/types'

const api: ElectronAPI = {
  openFile: () => ipcRenderer.invoke('open-file'),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  analyze: (filePath, mediaHash, options) =>
    ipcRenderer.invoke('analyze', filePath, mediaHash, options),
  loadProject: (mediaHash) => ipcRenderer.invoke('load-project', mediaHash),
  saveProject: (project) => ipcRenderer.invoke('save-project', project),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  platform: process.platform,

  onAnalysisProgress(cb) {
    const handler = (_event: Electron.IpcRendererEvent, pct: number) => cb(pct)
    ipcRenderer.on('analysis-progress', handler)
    return () => ipcRenderer.removeListener('analysis-progress', handler)
  },

  downloadUrl: (url) => ipcRenderer.invoke('download-url', url),

  onDownloadProgress(cb) {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => cb(progress)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type { AnalysisOptions, Project }
