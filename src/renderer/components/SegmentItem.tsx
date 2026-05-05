import { forwardRef } from 'react'
import { Star, Ungroup } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Segment, BookmarkType } from '../types'

interface SegmentItemProps {
  segment: Segment
  index: number
  isCurrent: boolean
  isSelected: boolean
  maxDurationMs: number
  onClick: (segment: Segment, shiftKey: boolean) => void
  onExtendSelection: (segment: Segment) => void
  onExtendSelectionAsGroup: (segment: Segment) => void
  onBookmarkChange: (segId: string, bookmark: BookmarkType | undefined) => void
  onUngroup?: (groupId: string) => void
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

const SegmentItem = forwardRef<HTMLButtonElement, SegmentItemProps>(
  ({ segment, index, isCurrent, isSelected, maxDurationMs, onClick, onExtendSelection, onExtendSelectionAsGroup, onBookmarkChange, onUngroup }, ref) => {
    const durationMs = segment.endMs - segment.startMs
    const barWidthPct = Math.min((durationMs / maxDurationMs) * 100, 100)
    const isStarred = !!segment.bookmark
    const isGroup = !!segment.childIds?.length

    const handleStarClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      onBookmarkChange(segment.id, isStarred ? undefined : 'starred')
    }

    return (
      <div className="group relative">
        {/* Main row button */}
        <button
          ref={ref}
          onClick={(e) => onClick(segment, e.shiftKey)}
          className={cn(
            'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-100 cursor-pointer select-none pr-20 outline-none',
            'border-l-2',
            isGroup && !isCurrent && !isSelected && 'border-l-violet-300 bg-violet-50/40',
            isGroup && isCurrent && 'border-l-violet-500 bg-violet-100 text-violet-900',
            isGroup && !isCurrent && isSelected && 'border-l-violet-500 bg-violet-500/90 text-white',
            !isGroup && isCurrent && 'border-l-primary bg-primary/15 text-primary',
            !isGroup && !isCurrent && isSelected && 'border-l-primary bg-primary/90 text-primary-foreground',
            !isGroup && !isCurrent && !isSelected &&
              'border-l-transparent text-foreground hover:bg-muted/50 hover:border-l-muted-foreground/30'
          )}
          aria-label={
            isGroup
              ? `Group of ${segment.childIds!.length} phrases: ${formatMs(segment.startMs)} to ${formatMs(segment.endMs)}`
              : `Phrase ${index + 1}: ${formatMs(segment.startMs)} to ${formatMs(segment.endMs)}`
          }
          aria-pressed={isSelected}
        >
          <div className="flex items-center gap-2">
            {/* Badge */}
            <span
              className={cn(
                'shrink-0 h-5 rounded-md flex items-center justify-center text-[10px] font-semibold',
                isGroup ? 'px-1.5 min-w-6' : 'w-5',
                isGroup && isCurrent
                  ? 'bg-violet-200 text-violet-700'
                  : !isGroup && isCurrent
                    ? 'bg-primary/15 text-primary'
                    : isGroup && isSelected
                      ? 'bg-white/15 text-white/90'
                      : isGroup
                        ? 'bg-violet-100/80 text-violet-600'
                        : isSelected
                          ? 'bg-white/15 text-white/90'
                          : 'bg-muted/80 text-muted-foreground'
              )}
            >
              {isGroup ? `${segment.childIds!.length}×` : index + 1}
            </span>

            {/* Time + duration bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-mono tabular-nums">{formatMs(segment.startMs)}</span>
                <span
                  className={cn(
                    'text-[10px]',
                    !isCurrent && isSelected ? 'text-white/70' : 'text-muted-foreground'
                  )}
                >
                  {formatDuration(durationMs)}
                </span>
              </div>
              <div
                className={cn(
                  'h-0.5 rounded-full',
                  !isCurrent && isSelected ? 'bg-white/20' : isGroup ? 'bg-violet-100' : 'bg-muted'
                )}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isGroup && isCurrent
                      ? 'bg-violet-400'
                      : !isGroup && isCurrent
                        ? 'bg-primary'
                        : !isCurrent && isSelected
                          ? 'bg-white/50'
                          : isGroup
                            ? 'bg-violet-300/70'
                            : 'bg-primary/35'
                  )}
                  style={{ width: `${barWidthPct.toFixed(1)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Transcript text */}
          {segment.text && (
            <p
              className={cn(
                'mt-1.5 ml-8 text-[11px] leading-snug line-clamp-2',
                isCurrent ? 'text-primary/80' : isSelected ? 'text-white/80' : 'text-muted-foreground'
              )}
            >
              {segment.text}
            </p>
          )}
        </button>

        {/* Action buttons — right edge */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {/* Ungroup (only for group items) */}
          {isGroup && onUngroup && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); onUngroup(segment.id) }}
                  className={cn(
                    'p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100',
                    !isCurrent && isSelected
                      ? 'text-white/70 hover:text-white hover:bg-white/10'
                      : 'text-violet-500 hover:text-violet-700 hover:bg-violet-100'
                  )}
                  aria-label="Ungroup phrases"
                >
                  <Ungroup size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Ungroup phrases</TooltipContent>
            </Tooltip>
          )}

          {/* "to here" and "to here as group" — only for non-group items */}
          {!isGroup && (
            <div className={cn(
              'flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
              isSelected && !isCurrent && 'opacity-100'
            )}>
              <button
                onClick={(e) => { e.stopPropagation(); onExtendSelection(segment) }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-medium leading-tight transition-colors',
                  !isCurrent && isSelected
                    ? 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30'
                    : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted'
                )}
                aria-label="Extend selection to this phrase"
              >
                to&nbsp;here
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onExtendSelectionAsGroup(segment) }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-medium leading-tight transition-colors',
                  !isCurrent && isSelected
                    ? 'bg-violet-400/30 text-primary-foreground hover:bg-violet-400/50'
                    : 'text-violet-500 hover:text-violet-700 hover:bg-violet-50'
                )}
                aria-label="Extend selection to this phrase and group"
              >
                group
              </button>
            </div>
          )}

          {/* Star toggle */}
          <button
            onClick={handleStarClick}
            className={cn(
              'p-1.5 rounded-md transition-all duration-150',
              isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              isStarred ? 'hover:bg-amber-50 hover:scale-110' : 'hover:bg-muted hover:scale-110',
              (!isCurrent && isSelected) && 'opacity-100'
            )}
            aria-label={isStarred ? 'Remove star' : 'Star this phrase'}
            aria-pressed={isStarred}
          >
            <Star
              size={13}
              className={cn(
                'transition-all duration-150',
                isStarred && 'fill-amber-400 text-amber-400',
                !isStarred && (!isCurrent && isSelected) && 'text-primary-foreground/50 group-hover:text-primary-foreground/80',
                !isStarred && (isCurrent || !isSelected) && 'text-muted-foreground/40 group-hover:text-amber-400'
              )}
            />
          </button>
        </div>
      </div>
    )
  }
)

SegmentItem.displayName = 'SegmentItem'
export default SegmentItem
