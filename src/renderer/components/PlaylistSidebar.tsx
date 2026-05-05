import { useEffect, useState } from 'react'
import { PanelLeftOpen, PanelLeftClose, FileVideo, FileAudio, Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '../lib/ipc'
import type { Project } from '../types'

interface PlaylistSidebarProps {
  currentMediaHash: string | null
  onOpenProject: (project: Project, filePath: string, mimeType: string) => void
  onDeleteCurrent?: () => void
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

function isVideo(mimeType?: string): boolean {
  return !!mimeType?.startsWith('video/')
}

export default function PlaylistSidebar({ currentMediaHash, onOpenProject, onDeleteCurrent }: PlaylistSidebarProps) {
  const [open, setOpen] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])

  // Reload the playlist whenever the sidebar opens or a project changes
  useEffect(() => {
    if (!open) return
    api.listProjects().then((list) => {
      // Sort newest first
      setProjects([...list].sort((a, b) => b.updatedAt - a.updatedAt))
    })
  }, [open, currentMediaHash])

  const handleSelect = async (project: Project) => {
    const result = await api.openPath(project.mediaPath)
    if (!result) return
    const mimeType = result.mimeType ?? project.mimeType ?? 'video/mp4'
    onOpenProject(project, result.filePath, mimeType)
  }

  const handleDelete = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    await api.deleteProject(project.mediaHash)
    setProjects((prev) => prev.filter((p) => p.id !== project.id))
    if (project.mediaHash === currentMediaHash) {
      onDeleteCurrent?.()
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200 overflow-hidden shrink-0',
        open ? 'w-56' : 'w-10'
      )}
    >
      {/* Toggle button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 h-10 px-2.5 text-muted-foreground hover:text-foreground transition-colors shrink-0',
              open && 'border-b w-full'
            )}
            aria-label={open ? 'Collapse playlist' : 'Expand playlist'}
          >
            {open ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            {open && (
              <span className="text-xs font-medium text-foreground truncate">Library</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{open ? 'Collapse' : 'Library'}</TooltipContent>
      </Tooltip>

      {/* Project list */}
      {open && (
        <div className="flex-1 overflow-y-auto py-1">
          {projects.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              No recent files
            </p>
          ) : (
            projects.map((project) => {
              const isCurrent = project.mediaHash === currentMediaHash
              const video = isVideo(project.mimeType)
              const name = fileName(project.mediaPath)
              return (
                <div key={project.id} className="group relative">
                  <button
                    onClick={() => handleSelect(project)}
                    className={cn(
                      'w-full flex items-start gap-2 px-3 py-2 text-left transition-colors pr-8',
                      isCurrent
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/60'
                    )}
                    title={project.mediaPath}
                  >
                    {video ? (
                      <FileVideo size={14} className="shrink-0 mt-0.5 opacity-60" />
                    ) : (
                      <FileAudio size={14} className="shrink-0 mt-0.5 opacity-60" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate leading-tight">{name}</p>
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <Clock size={9} />
                        {formatDuration(project.durationMs)}
                        <span className="ml-1">{project.segments.length} phrases</span>
                      </p>
                    </div>
                  </button>

                  {/* Delete button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => handleDelete(e, project)}
                        className={cn(
                          'absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded transition-all',
                          'opacity-0 group-hover:opacity-100',
                          isCurrent
                            ? 'text-primary/60 hover:text-destructive hover:bg-destructive/10'
                            : 'text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10'
                        )}
                        aria-label={`Remove ${name} from library`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">Remove from library</TooltipContent>
                  </Tooltip>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
