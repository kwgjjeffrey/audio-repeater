import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Settings, FolderOpen, RefreshCw, ArrowRightToLine, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import AnalysisProgress from './components/AnalysisProgress'

import MediaPlayer from './components/MediaPlayer'
import SegmentTimeline from './components/SegmentTimeline'
import PlayerControls from './components/PlayerControls'
import SettingsSheet from './components/SettingsSheet'
import EmptyState from './components/EmptyState'
import PlaylistSidebar from './components/PlaylistSidebar'
import ProgressBars from './components/ProgressBars'
import AddFromUrlDialog from './components/AddFromUrlDialog'

import { useProjectStore } from './store/projectStore'
import { usePlaybackStore } from './store/playbackStore'
import { useMediaElement } from './hooks/useMediaElement'
import { api } from './lib/ipc'
import type { Project, BookmarkType } from './types'

export default function App() {
  const {
    project,
    mediaPath,
    mediaHash,
    mimeType,
    isAnalyzing,
    analysisError,
    analysisOptions,
    setProject,
    setAnalyzing,
    setAnalysisError,
    updateSegmentBookmark,
    groupSegments,
    ungroupSegment
  } = useProjectStore()

  // Only top-level (non-constituent) segments are exposed to the playback engine and UI
  const visibleSegments = useMemo(
    () => project?.segments.filter((s) => !s.parentGroupId) ?? [],
    [project?.segments]
  )

  const { reset: resetPlayback, loopMode, setLoopMode, selection } = usePlaybackStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analysisPct, setAnalysisPct] = useState(0)

  // Single shared ref for the media element.
  // Created here, passed to MediaPlayer so VideoView/WaveformView attach to it,
  // and also passed to useMediaElement so controls can drive it.
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)

  const { togglePlay, seekToSegment, goToPrevSegment, goToNextSegment, toggleLoop } =
    useMediaElement(mediaRef, visibleSegments)

  // Handle opening a project from the playlist sidebar
  const handlePlaylistOpen = useCallback(
    async (selectedProject: Project, filePath: string, mime: string) => {
      mediaRef.current?.pause()
      resetPlayback()
      setProject(selectedProject, filePath, mime)
    },
    [mediaRef, resetPlayback, setProject]
  )

  const handleGroupSelected = useCallback(
    async (ids: string[]) => {
      const updated = groupSegments(ids)
      if (updated) {
        resetPlayback()
        try { await api.saveProject(updated) } catch { toast.error('Failed to save group') }
      }
    },
    [groupSegments, resetPlayback]
  )

  const handleUngroup = useCallback(
    async (groupId: string) => {
      const updated = ungroupSegment(groupId)
      if (updated) {
        try { await api.saveProject(updated) } catch { toast.error('Failed to save ungroup') }
      }
    },
    [ungroupSegment]
  )

  // Bookmark a segment and persist the change
  const handleBookmarkChange = useCallback(
    async (segId: string, bookmark: BookmarkType | undefined) => {
      const updated = updateSegmentBookmark(segId, bookmark)
      if (updated) {
        try {
          await api.saveProject(updated)
        } catch {
          toast.error('Failed to save bookmark')
        }
      }
    },
    [updateSegmentBookmark]
  )

  // Handle a downloaded URL — same flow as manually opening a file
  const handleUrlDownload = useCallback(
    async (filePath: string, mediaHash: string, mime: string) => {
      mediaRef.current?.pause()
      resetPlayback()

      const cached = await api.loadProject(mediaHash)
      if (cached) {
        setProject(cached, filePath, mime)
        toast.success(`${cached.segments.length} phrases loaded`, {
          description: 'Using saved analysis.',
          duration: 4000
        })
        return
      }

      setAnalysisPct(0)
      setAnalyzing(true)
      const unsub = api.onAnalysisProgress(setAnalysisPct)
      try {
        const analyzed = await api.analyze(filePath, mediaHash, analysisOptions)
        const withMime = { ...analyzed, mimeType: mime }
        await api.saveProject(withMime)
        setProject(withMime, filePath, mime)
        toast.success('Download & analysis complete', {
          description: `Found ${analyzed.segments.length} phrases`
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setAnalysisError(msg)
        toast.error('Analysis failed', { description: msg })
      } finally {
        unsub()
      }
    },
    [mediaRef, analysisOptions, resetPlayback, setProject, setAnalyzing, setAnalysisError, setAnalysisPct]
  )

  const openFile = useCallback(async () => {
    const result = await api.openFile()
    if (!result) return

    const { filePath, mediaHash, mimeType: mime } = result

    mediaRef.current?.pause()
    resetPlayback()

    // Try to load from cache first
    const cached = await api.loadProject(mediaHash)
    if (cached) {
      setProject(cached, filePath, mime)
      toast.success(`${cached.segments.length} phrases loaded`, {
        description: 'Using saved analysis. Hit ↺ in the toolbar to re-analyze.',
        duration: 5000
      })
      return
    }

    // Run analysis
    setAnalysisPct(0)
    setAnalyzing(true)
    const unsub = api.onAnalysisProgress(setAnalysisPct)
    try {
      const analyzed = await api.analyze(filePath, mediaHash, analysisOptions)
      const withMime = { ...analyzed, mimeType: mime }
      await api.saveProject(withMime)
      setProject(withMime, filePath, mime)
      toast.success('Analysis complete', {
        description: `Found ${analyzed.segments.length} phrases`
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAnalysisError(msg)
      toast.error('Analysis failed', { description: msg })
    } finally {
      unsub()
    }
  }, [analysisOptions, resetPlayback, setProject, setAnalyzing, setAnalysisError, setAnalysisPct])

  const reanalyze = useCallback(async () => {
    if (!mediaPath || !project) return
    mediaRef.current?.pause()
    resetPlayback()
    setAnalysisPct(0)
    setAnalyzing(true)
    const unsub = api.onAnalysisProgress(setAnalysisPct)
    try {
      const analyzed = await api.analyze(mediaPath, project.mediaHash, analysisOptions)
      await api.saveProject(analyzed)
      setProject(analyzed, mediaPath, mimeType ?? 'video/mp4')
      toast.success('Re-analysis complete', {
        description: `Found ${analyzed.segments.length} phrases`
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAnalysisError(msg)
      toast.error('Analysis failed', { description: msg })
    } finally {
      unsub()
    }
  }, [mediaPath, project, analysisOptions, resetPlayback, setProject, setAnalyzing, setAnalysisError, mimeType, setAnalysisPct])

  // On launch: silently load the most recently updated project
  useEffect(() => {
    if (project) return // already have something loaded (e.g. HMR reload)
    api.listProjects().then(async (list) => {
      if (list.length === 0) return
      const mostRecent = list.sort((a, b) => b.updatedAt - a.updatedAt)[0]
      const result = await api.openPath(mostRecent.mediaPath)
      if (!result) return // file was moved/deleted
      setProject(mostRecent, result.filePath, result.mimeType ?? mostRecent.mimeType ?? 'video/mp4')
    }).catch(() => {}) // silent — startup failure is not worth an error toast
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once only

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          goToPrevSegment()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNextSegment()
          break
        case 'l':
        case 'L':
          toggleLoop()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, goToPrevSegment, goToNextSegment, toggleLoop])

  const fileName = mediaPath ? mediaPath.split('/').pop() ?? mediaPath : null

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex flex-col h-screen bg-background text-foreground',
          window.api?.platform === 'darwin' && 'pt-8'
        )}
      >
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
          <Button variant="outline" size="sm" onClick={openFile} className="gap-1.5">
            <FolderOpen data-icon="inline-start" />
            Open
          </Button>

          <AddFromUrlDialog onSuccess={handleUrlDownload} />

          {fileName && (
            <span className="text-sm text-muted-foreground truncate max-w-48" title={mediaPath ?? ''}>
              {fileName}
            </span>
          )}

          {/* Play / Repeat mode — center of header, always visible when file is loaded */}
          {project && !isAnalyzing && (
            <div className="flex-1 flex justify-center">
              <div
                className="flex items-center rounded-lg border overflow-hidden"
                role="group"
                aria-label="Play mode"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setLoopMode('off')}
                      aria-pressed={loopMode === 'off'}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                        loopMode === 'off'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <ArrowRightToLine size={13} />
                      Play
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Play through and stop</TooltipContent>
                </Tooltip>

                <div className="w-px h-4 bg-border" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setLoopMode('loop')}
                      disabled={!selection}
                      aria-pressed={loopMode === 'loop'}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                        loopMode === 'loop'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        !selection && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <Repeat size={13} />
                      Repeat
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {!selection ? 'Click a phrase to select it first' : 'Loop selected phrase(s) — also triggered by clicking a phrase (L)'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Right side actions */}
          <div className={cn('flex items-center gap-1', !project && 'ml-auto')}>
            {project && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={reanalyze}
                    disabled={isAnalyzing}
                    aria-label="Re-analyze file"
                  >
                    <RefreshCw data-icon="inline-start" className={cn(isAnalyzing && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Re-analyze with current settings</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Open settings"
                >
                  <Settings data-icon="inline-start" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Analysis settings</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Left playlist sidebar */}
          <PlaylistSidebar
            currentMediaHash={mediaHash}
            onOpenProject={handlePlaylistOpen}
          />

          {/* Center: empty state or player */}
          {!project && !isAnalyzing ? (
            <EmptyState onOpenFile={openFile} />
          ) : (
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="flex-1 min-h-0 p-4">
                {isAnalyzing ? (
                  <AnalysisProgress pct={analysisPct} />
                ) : project && mediaPath && mimeType ? (
                  <MediaPlayer
                    src={mediaPath}
                    mimeType={mimeType}
                    segments={visibleSegments}
                    mediaRef={mediaRef}
                  />
                ) : null}
              </div>

              {project && !isAnalyzing && (
                <ProgressBars
                  mediaRef={mediaRef}
                  durationMs={project.durationMs}
                  segments={visibleSegments}
                  onOverallSeek={() => setLoopMode('off')}
                />
              )}

              {project && !isAnalyzing && (
                <PlayerControls
                  onPrevSegment={goToPrevSegment}
                  onTogglePlay={togglePlay}
                  onNextSegment={goToNextSegment}
                />
              )}

              {analysisError && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    {analysisError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Right: segment sidebar */}
          {project && !isAnalyzing && (
            <aside className="w-64 shrink-0 border-l flex flex-col overflow-hidden bg-card">
              <SegmentTimeline
                  segments={visibleSegments}
                  onSeekToSegment={seekToSegment}
                  onBookmarkChange={handleBookmarkChange}
                  onGroupSelected={handleGroupSelected}
                  onUngroup={handleUngroup}
                />
            </aside>
          )}
        </div>
      </div>

      <Toaster position="bottom-right" />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </TooltipProvider>
  )
}
