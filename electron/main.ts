import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerFileHandlers } from './ipc/files'
import { registerAnalyzeHandlers } from './ipc/analyze'
import { registerProjectHandlers } from './ipc/projects'
import { registerDownloadHandlers } from './ipc/download'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Allow file:// media in dev (renderer served from http://localhost).
      // This is safe for a local-only desktop app that only reads the user's own files.
      webSecurity: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
}

app.whenReady().then(() => {
  registerFileHandlers(ipcMain)
  registerAnalyzeHandlers(ipcMain)
  registerProjectHandlers(ipcMain)
  createWindow()
  if (mainWindow) registerDownloadHandlers(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
