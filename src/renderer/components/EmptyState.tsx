import { Button } from '@/components/ui/button'
import { FolderOpen, Music } from 'lucide-react'

interface EmptyStateProps {
  onOpenFile: () => void
}

export default function EmptyState({ onOpenFile }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8">
      <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center">
        <Music className="size-12 text-primary" />
      </div>

      <div className="flex flex-col gap-2 max-w-sm">
        <h2 className="text-2xl font-bold">Open a video or audio file</h2>
        <p className="text-muted-foreground leading-relaxed">
          The app will automatically find phrases in the file so you can tap them to repeat and
          practice.
        </p>
      </div>

      <Button size="lg" onClick={onOpenFile} className="gap-2">
        <FolderOpen data-icon="inline-start" />
        Open File
      </Button>

      <p className="text-xs text-muted-foreground">
        Supports MP4, MKV, MOV, MP3, M4A, WAV, and more
      </p>
    </div>
  )
}
