declare module 'vanta/dist/vanta.waves.min' {
  import * as THREE from 'three'
  
  interface VantaEffect {
    destroy: () => void
    setOptions: (options: Record<string, unknown>) => void
  }
  
  interface VantaConfig {
    el: HTMLElement | null
    THREE: typeof THREE
    mouseControls?: boolean
    touchControls?: boolean
    gyroControls?: boolean
    minHeight?: number
    minWidth?: number
    scale?: number
    scaleMobile?: number
    color?: number
    shininess?: number
    waveHeight?: number
    waveSpeed?: number
    zoom?: number
  }
  
  export default function WAVES(config: VantaConfig): VantaEffect
}
