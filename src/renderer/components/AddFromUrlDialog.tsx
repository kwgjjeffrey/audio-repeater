import { useState, useRef, useEffect } from 'react'
import { Link, X, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '../lib/ipc'
import type { DownloadProgress } from '../types'

interface AddFromUrlDialogProps {
  onSuccess: (filePath: string, mediaHash: string, mimeType: string) => void
}

const PHASE_LABEL: Record<DownloadProgress['phase'], string> = {
  detecting: 'Detecting media…',
  downloading: 'Downloading…',
  processing: 'Processing…'
}

export default function AddFromUrlDialog({ onSuccess }: AddFromUrlDialogProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  async function handleDownload() {
    const trimmed = url.trim()
    if (!trimmed) return

    setStatus('busy')
    setProgress({ phase: 'detecting', percent: 0 })
    setErrorMsg('')

    const unsub = api.onDownloadProgress((p) => setProgress(p))
    try {
      const result = await api.downloadUrl(trimmed)
      setOpen(false)
      setUrl('')
      setStatus('idle')
      setProgress(null)
      onSuccess(result.filePath, result.mediaHash, result.mimeType)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      unsub()
    }
  }

  const busy = status === 'busy'

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger button */}
      <button
        onClick={() => { if (!busy) setOpen(v => !v) }}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors',
          open
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background text-foreground hover:bg-muted border-input'
        )}
        aria-label="Add from URL"
      >
        <Link size={13} />
        URL
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-80 rounded-xl border bg-card shadow-lg p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Add from URL</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-snug">
            Paste a YouTube link, direct audio/video URL, or any platform supported by yt-dlp.
            For YouTube, make sure you are logged in to YouTube in <strong>Chrome</strong> or <strong>Safari</strong> first.
          </p>

          <input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleDownload() }}
            placeholder="https://youtube.com/watch?v=…"
            disabled={busy}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs',
              'placeholder:text-muted-foreground outline-none',
              'focus:ring-2 focus:ring-primary/30 focus:border-primary',
              'disabled:opacity-50'
            )}
          />

          {/* Progress */}
          {busy && progress && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" />
                  {PHASE_LABEL[progress.phase]}
                </span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && errorMsg && (
            <p className="text-[11px] text-destructive bg-destructive/8 px-2.5 py-1.5 rounded-md">
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleDownload}
            disabled={busy || !url.trim()}
            className={cn(
              'flex items-center justify-center gap-1.5 h-7 rounded-md text-xs font-medium transition-colors',
              'bg-primary text-primary-foreground hover:opacity-90',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {busy ? 'Downloading…' : 'Download'}
          </button>
        </div>
      )}
    </div>
  )
}
