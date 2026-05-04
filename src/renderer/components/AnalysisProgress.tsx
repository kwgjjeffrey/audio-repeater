import { Skeleton } from '@/components/ui/skeleton'

interface AnalysisProgressProps {
  pct: number
}

export default function AnalysisProgress({ pct }: AnalysisProgressProps) {
  return (
    <div className="w-full h-full flex flex-col gap-4 items-center justify-center px-8">
      <Skeleton className="w-full aspect-video max-h-72 rounded-lg" />

      <div className="w-full max-w-sm flex flex-col gap-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Detecting phrases…</span>
          <span className="tabular-nums font-medium">{pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {pct === 0
            ? 'Starting…'
            : pct < 100
              ? 'Scanning audio for silent gaps between phrases'
              : 'Building phrase list…'}
        </p>
      </div>
    </div>
  )
}
