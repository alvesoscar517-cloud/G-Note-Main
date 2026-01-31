import { useEffect, useRef } from 'react'
import * as THREE from 'three'
// @ts-expect-error - vanta doesn't have types
import CLOUDS from 'vanta/dist/vanta.clouds.min'

interface VantaCloudsProps {
  className?: string
}

export function VantaWaves({ className }: VantaCloudsProps) {
  const vantaRef = useRef<HTMLDivElement>(null)
  const effectRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    if (!vantaRef.current) return

    // Destroy existing effect
    if (effectRef.current) {
      effectRef.current.destroy()
      effectRef.current = null
    }

    effectRef.current = CLOUDS({
      el: vantaRef.current,
      THREE,
      mouseControls: false,
      touchControls: false,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      speed: 1.0,
      scale: 1.0,
      scaleMobile: 1.0,
    })

    return () => {
      if (effectRef.current) {
        effectRef.current.destroy()
        effectRef.current = null
      }
    }
  }, [])

  return (
    <>
      <div
        ref={vantaRef}
        className={className}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />
      {/* Overlay to block mouse events */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      />
    </>
  )
}
