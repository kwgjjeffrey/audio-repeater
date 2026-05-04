import VideoView from './VideoView'
import WaveformView from './WaveformView'
import { usePlaybackEngine } from '../hooks/usePlaybackEngine'
import type { Segment } from '../types'

interface MediaPlayerProps {
  src: string
  mimeType: string
  segments: Segment[]
  /** Shared ref — owned by App, forwarded here so controls can drive the element */
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>
}

function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith('video/')
}

export default function MediaPlayer({ src, mimeType, segments, mediaRef }: MediaPlayerProps) {
  usePlaybackEngine(mediaRef, segments)

  const mediaSrc = src.startsWith('file://') ? src : `file://${src}`
  const isVideo = isVideoMime(mimeType)

  return (
    <div className="w-full h-full flex items-center justify-center">
      {isVideo ? (
        <VideoView
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={mediaSrc}
        />
      ) : (
        <WaveformView
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={mediaSrc}
        />
      )}
    </div>
  )
}
