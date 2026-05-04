import { forwardRef } from 'react'

interface VideoViewProps {
  src: string
}

const VideoView = forwardRef<HTMLVideoElement, VideoViewProps>(({ src }, ref) => {
  return (
    <video
      ref={ref}
      src={src}
      className="w-full h-full object-contain bg-black rounded-lg"
      preload="metadata"
    />
  )
})

VideoView.displayName = 'VideoView'

export default VideoView
