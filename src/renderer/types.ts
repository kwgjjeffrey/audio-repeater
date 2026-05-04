export type SegmentSource = 'silence' | 'subtitle' | 'asr'

export type BookmarkType = 'starred'

export interface Segment {
  id: string
  startMs: number
  endMs: number
  text?: string
  source: SegmentSource
  bookmark?: BookmarkType
  /** If this segment is a user-created group, the IDs of its constituent segments (in order). */
  childIds?: string[]
  /** If this segment has been grouped into another, the ID of the parent group segment. */
  parentGroupId?: string
}

export interface Project {
  id: string
  mediaPath: string
  mediaHash: string
  mimeType?: string
  durationMs: number
  segments: Segment[]
  createdAt: number
  updatedAt: number
}

export interface SegmentRange {
  firstSegId: string
  lastSegId: string
}

export interface PlaybackState {
  selection: SegmentRange | null
  loopMode: 'off' | 'loop'
  loopCount: number | 'infinite'
  pauseBetweenLoopsMs: number
  playbackRate: number
}

export interface AnalysisOptions {
  noiseDb: number
  silenceDurationSec: number
  minSegmentMs: number
  maxSegmentMs: number
}

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  noiseDb: -30,
  silenceDurationSec: 0.6,  // was 0.4 — shorter pauses are now treated as within-phrase gaps
  minSegmentMs: 1500,        // was 800 — prevents very short bursts from becoming separate phrases
  maxSegmentMs: 10000
}

export const DEFAULT_PLAYBACK_STATE: PlaybackState = {
  selection: null,
  loopMode: 'off',
  loopCount: 'infinite',
  pauseBetweenLoopsMs: 1500,
  playbackRate: 1.0
}

export interface SilenceEvent {
  startSec: number
  endSec: number
}

// IPC channel definitions — single source of truth
export const IPC = {
  OPEN_FILE: 'open-file',
  ANALYZE: 'analyze',
  LOAD_PROJECT: 'load-project',
  SAVE_PROJECT: 'save-project',
  LIST_PROJECTS: 'list-projects'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export interface DownloadProgress {
  phase: 'detecting' | 'downloading' | 'processing'
  percent: number
}

/** The API surface exposed from the Electron preload via contextBridge. */
export interface ElectronAPI {
  openFile(): Promise<{ filePath: string; mediaHash: string; mimeType: string } | null>
  openPath(filePath: string): Promise<{ filePath: string; mediaHash: string; mimeType: string } | null>
  analyze(filePath: string, mediaHash: string, options: AnalysisOptions): Promise<Project>
  loadProject(mediaHash: string): Promise<Project | null>
  saveProject(project: Project): Promise<void>
  listProjects(): Promise<Project[]>
  platform: string
  /** Subscribe to analysis progress updates (0–100). Returns an unsubscribe fn. */
  onAnalysisProgress(cb: (pct: number) => void): () => void
  /** Download a video/audio from a URL; returns file info like openFile(). */
  downloadUrl(url: string): Promise<{ filePath: string; mediaHash: string; mimeType: string }>
  /** Subscribe to download progress. Returns an unsubscribe fn. */
  onDownloadProgress(cb: (progress: DownloadProgress) => void): () => void
}
