import { useEffect, useRef, forwardRef } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface WaveformViewProps {
  src: string
}

/**
 * Audio waveform view using wavesurfer.js.
 *
 * We create the <audio> element ourselves and hand it to wavesurfer via the
 * `media` option. This lets us forward a real HTMLAudioElement immediately —
 * no Proxy needed, so addEventListener/removeEventListener work from the start.
 */
const WaveformView = forwardRef<HTMLAudioElement, WaveformViewProps>(({ src }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  // Create the audio element once and keep it stable across renders
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  if (!audioElRef.current) {
    audioElRef.current = document.createElement('audio')
    audioElRef.current.preload = 'metadata'
  }

  // Forward the real audio element immediately (before wavesurfer loads)
  // React calls this callback synchronously during render
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(audioElRef.current)
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLAudioElement | null>).current = audioElRef.current
    }
    return () => {
      if (typeof ref === 'function') ref(null)
      else if (ref) (ref as React.MutableRefObject<HTMLAudioElement | null>).current = null
    }
  }, [ref])

  useEffect(() => {
    if (!containerRef.current || !audioElRef.current) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      media: audioElRef.current,   // hand wavesurfer our own audio element
      waveColor: 'hsl(220 90% 56% / 0.35)',
      progressColor: 'hsl(220 90% 56%)',
      cursorColor: 'hsl(220 90% 56%)',
      barWidth: 2,
      barRadius: 2,
      height: 128,
      normalize: true,
      interact: true
    })

    ws.load(src)
    wavesurferRef.current = ws

    return () => {
      ws.destroy()
      wavesurferRef.current = null
    }
  }, [src])

  return (
    <div className="w-full bg-muted rounded-lg p-4">
      <div ref={containerRef} className="w-full" />
    </div>
  )
})

WaveformView.displayName = 'WaveformView'

export default WaveformView
