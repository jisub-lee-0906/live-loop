import { useEffect, useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'
import butterchurnModule from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

type ButterchurnApi = {
  createVisualizer: (context: AudioContext, canvas: HTMLCanvasElement, options?: { width?: number; height?: number; pixelRatio?: number; textureRatio?: number }) => ButterchurnVisualizer
}

type ButterchurnVisualizer = {
  connectAudio(node: AudioNode): void
  disconnectAudio(node?: AudioNode): void
  loadPreset(preset: unknown, blendTime?: number): void
  render(): void
  setRendererSize(width: number, height: number): void
}

function getButterchurnApi(): ButterchurnApi {
  const candidate = butterchurnModule as ButterchurnApi | { default?: ButterchurnApi } | { butterchurn?: ButterchurnApi }
  if ('createVisualizer' in candidate && typeof candidate.createVisualizer === 'function') return candidate
  if ('default' in candidate && candidate.default?.createVisualizer) return candidate.default
  if ('butterchurn' in candidate && candidate.butterchurn?.createVisualizer) return candidate.butterchurn
  throw new TypeError(`Unsupported butterchurn module shape: ${Object.keys(candidate).join(', ')}`)
}

interface VisualizerProps {
  audioNode: AudioNode | null
  active: boolean
  presetIndex: number
}

function resizeCanvas(canvas: HTMLCanvasElement, visualizer: { setRendererSize(width: number, height: number): void } | null) {
  const rect = canvas.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(2, Math.floor(rect.width * ratio))
  const height = Math.max(2, Math.floor(rect.height * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    visualizer?.setRendererSize(width, height)
  }
}

export function Visualizer({ audioNode, active, presetIndex }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const visualizerRef = useRef<ButterchurnVisualizer | null>(null)
  const [fallback, setFallback] = useState(false)

  const presets = useMemo(() => Object.entries(butterchurnPresets.getPresets()), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || visualizerRef.current) return
    try {
      const context = Tone.getContext().rawContext as AudioContext
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const butterchurn = getButterchurnApi()
      const visualizer = butterchurn.createVisualizer(context, canvas, {
        width: Math.max(2, Math.floor(rect.width * ratio)),
        height: Math.max(2, Math.floor(rect.height * ratio)),
        pixelRatio: ratio,
        textureRatio: 1,
      })
      visualizerRef.current = visualizer
      resizeCanvas(canvas, visualizer)
      console.info('[live-loop] Butterchurn visualizer ready', { presets: presets.length })
    } catch (error) {
      console.warn('[live-loop] Butterchurn failed; using fallback visualizer', error)
      window.setTimeout(() => setFallback(true), 0)
    }
  }, [presets.length])

  useEffect(() => {
    const visualizer = visualizerRef.current
    if (!visualizer || !audioNode) return
    visualizer.connectAudio(audioNode)
    return () => {
      try {
        visualizer.disconnectAudio(audioNode)
      } catch {
        // Butterchurn disconnect can throw during React dev-mode remounts; ignore safely.
      }
    }
  }, [audioNode])

  useEffect(() => {
    const visualizer = visualizerRef.current
    if (!visualizer || presets.length === 0) return
    const [presetName, preset] = presets[((presetIndex % presets.length) + presets.length) % presets.length]
    console.info('[live-loop] Butterchurn preset', { index: presetIndex, presetName })
    visualizer.loadPreset(preset, active ? 1.4 : 0)
  }, [active, presetIndex, presets])

  useEffect(() => {
    const canvas = canvasRef.current
    const visualizer = visualizerRef.current
    if (!canvas || !visualizer || fallback) return undefined
    let frame = 0
    const render = () => {
      resizeCanvas(canvas, visualizer)
      visualizer.render()
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [fallback])

  useEffect(() => {
    if (!fallback) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    if (!context) return undefined
    let frame = 0
    const draw = () => {
      resizeCanvas(canvas, null)
      const width = canvas.width
      const height = canvas.height
      const t = frame * 0.02
      const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.min(width, height) * 0.7)
      gradient.addColorStop(0, active ? 'rgba(103,232,249,0.46)' : 'rgba(51,65,85,0.34)')
      gradient.addColorStop(0.36, 'rgba(15,23,42,0.9)')
      gradient.addColorStop(1, '#000')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 96; i += 1) {
        const angle = i * 0.392 + t
        const radius = Math.min(width, height) * (0.16 + ((i * 17) % 70) / 160)
        context.fillStyle = `hsla(${180 + i * 2},100%,70%,${active ? 0.25 : 0.08})`
        context.beginPath()
        context.arc(width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius, active ? 3 : 1.5, 0, Math.PI * 2)
        context.fill()
      }
      context.globalCompositeOperation = 'source-over'
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [active, fallback])

  return <canvas ref={canvasRef} className="visualizer" aria-label="curated MilkDrop music visualizer" />
}
