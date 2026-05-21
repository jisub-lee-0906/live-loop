declare module 'butterchurn' {
  interface ButterchurnVisualizer {
    connectAudio(node: AudioNode): void
    disconnectAudio(node?: AudioNode): void
    loadPreset(preset: unknown, blendTime?: number): void
    render(): void
    setRendererSize(width: number, height: number): void
  }

  const butterchurn: {
    createVisualizer(context: AudioContext, canvas: HTMLCanvasElement, options?: { width?: number; height?: number; pixelRatio?: number; textureRatio?: number }): ButterchurnVisualizer
  }

  export default butterchurn
}

declare module 'butterchurn-presets' {
  const presets: {
    getPresets(): Record<string, unknown>
  }

  export default presets
}
