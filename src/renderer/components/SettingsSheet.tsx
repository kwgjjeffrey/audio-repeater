import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useProjectStore } from '../store/projectStore'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const { analysisOptions, setAnalysisOptions } = useProjectStore()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-88">
        <SheetHeader>
          <SheetTitle>Analysis Settings</SheetTitle>
          <SheetDescription>
            Controls how the file is split into phrases. Hit <strong>↺ Re-analyze</strong> in the toolbar after changing anything.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6">
          <SettingRow
            label="Silence sensitivity"
            description="How quiet something needs to be before it counts as a pause. Raise this if background noise is causing too many cuts (e.g. room tone, breath, music)."
            hint="More cuts ← → fewer cuts"
            value={`${analysisOptions.noiseDb} dB`}
          >
            <Slider
              min={-60}
              max={-10}
              step={1}
              value={[analysisOptions.noiseDb]}
              onValueChange={([v]) => setAnalysisOptions({ noiseDb: v })}
              aria-label="Silence threshold in dB"
            />
          </SettingRow>

          <Separator />

          <SettingRow
            label="Minimum pause length"
            description="A gap shorter than this is ignored — it's treated as a breath or hesitation within a phrase, not a phrase boundary. Raise this if too many tiny pieces are being cut."
            hint="More cuts ← → fewer cuts"
            value={`${analysisOptions.silenceDurationSec.toFixed(1)} s`}
          >
            <Slider
              min={0.2}
              max={2.0}
              step={0.1}
              value={[analysisOptions.silenceDurationSec]}
              onValueChange={([v]) => setAnalysisOptions({ silenceDurationSec: v })}
              aria-label="Minimum pause duration in seconds"
            />
          </SettingRow>

          <Separator />

          <SettingRow
            label="Minimum phrase length"
            description="Any detected phrase shorter than this is merged into the next one. The most effective way to reduce tiny fragments — raise it until you get natural sentence-length chunks."
            hint="More phrases ← → fewer phrases"
            value={`${(analysisOptions.minSegmentMs / 1000).toFixed(1)} s`}
          >
            <Slider
              min={300}
              max={5000}
              step={100}
              value={[analysisOptions.minSegmentMs]}
              onValueChange={([v]) => setAnalysisOptions({ minSegmentMs: v })}
              aria-label="Minimum phrase length in milliseconds"
            />
          </SettingRow>

          <Separator />

          <SettingRow
            label="Maximum phrase length"
            description="A phrase longer than this is split at its midpoint. Useful for very long uninterrupted sentences."
            hint=""
            value={`${(analysisOptions.maxSegmentMs / 1000).toFixed(0)} s`}
          >
            <Slider
              min={3000}
              max={30000}
              step={1000}
              value={[analysisOptions.maxSegmentMs]}
              onValueChange={([v]) => setAnalysisOptions({ maxSegmentMs: v })}
              aria-label="Maximum phrase length in milliseconds"
            />
          </SettingRow>
        </div>

        <div className="mt-6 rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">Too many tiny pieces?</p>
          <p>Raise <strong>Minimum pause length</strong> to 0.8–1.2 s and <strong>Minimum phrase length</strong> to 2.0–3.0 s, then re-analyze. Those two sliders have the biggest effect.</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SettingRow({
  label,
  description,
  hint,
  value,
  children
}: {
  label: string
  description: string
  hint: string
  value: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        </div>
        <Badge variant="secondary" className="tabular-nums text-xs shrink-0 mt-0.5">{value}</Badge>
      </div>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  )
}
