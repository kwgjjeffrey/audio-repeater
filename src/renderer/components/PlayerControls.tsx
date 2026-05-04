import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { usePlaybackStore } from '../store/playbackStore'
import { cn } from '@/lib/utils'

interface PlayerControlsProps {
  onPrevSegment: () => void
  onTogglePlay: () => void
  onNextSegment: () => void
}

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5]

export default function PlayerControls({
  onPrevSegment,
  onTogglePlay,
  onNextSegment
}: PlayerControlsProps) {
  const { isPlaying, playbackRate, setPlaybackRate } = usePlaybackStore()

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3 border-t bg-card">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onPrevSegment} aria-label="Previous phrase">
            <SkipBack size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous phrase (←)</TooltipContent>
      </Tooltip>

      {/* Play / Pause */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className={cn(
              'flex items-center justify-center size-11 rounded-full transition-colors',
              'bg-primary text-primary-foreground hover:opacity-90'
            )}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isPlaying ? 'Pause (Space)' : 'Play (Space)'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onNextSegment} aria-label="Next phrase">
            <SkipForward size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next phrase (→)</TooltipContent>
      </Tooltip>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Speed */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const idx = PLAYBACK_RATES.indexOf(playbackRate)
              const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length]
              setPlaybackRate(next)
            }}
            aria-label="Playback speed"
            className="min-w-12 text-xs tabular-nums font-medium rounded-lg"
          >
            {playbackRate}×
          </Button>
        </TooltipTrigger>
        <TooltipContent>Playback speed — click to cycle</TooltipContent>
      </Tooltip>
    </div>
  )
}
