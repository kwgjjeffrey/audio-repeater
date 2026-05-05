import { app, IpcMain } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Project } from '../../src/renderer/types'

function getProjectsDir(): string {
  const dir = join(app.getPath('userData'), 'projects')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function projectPath(mediaHash: string): string {
  return join(getProjectsDir(), `${mediaHash}.json`)
}

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('load-project', async (_event, mediaHash: string): Promise<Project | null> => {
    const p = projectPath(mediaHash)
    if (!existsSync(p)) return null
    try {
      return JSON.parse(readFileSync(p, 'utf-8')) as Project
    } catch {
      return null
    }
  })

  ipcMain.handle('save-project', async (_event, project: Project): Promise<void> => {
    const p = projectPath(project.mediaHash)
    writeFileSync(p, JSON.stringify(project, null, 2), 'utf-8')
  })

  ipcMain.handle('list-projects', async (): Promise<Project[]> => {
    const dir = getProjectsDir()
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
    return files.flatMap((f) => {
      try {
        return [JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Project]
      } catch {
        return []
      }
    })
  })

  ipcMain.handle('delete-project', async (_event, mediaHash: string): Promise<void> => {
    const p = projectPath(mediaHash)
    if (existsSync(p)) rmSync(p)
  })
}
