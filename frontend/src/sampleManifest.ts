export const drumSamples = {
  kick: '/samples/drums/kick_01.wav',
  snare: '/samples/drums/snare_01.wav',
  hat: '/samples/drums/hat_closed_01.wav',
} as const

export type DrumSampleId = keyof typeof drumSamples

export function getDrumSampleUrl(sampleId: DrumSampleId): string {
  return drumSamples[sampleId]
}
