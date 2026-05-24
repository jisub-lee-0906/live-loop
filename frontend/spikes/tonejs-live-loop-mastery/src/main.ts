import * as Tone from 'tone'

const logEl = document.querySelector<HTMLPreElement>('#log')!
const canvas = document.querySelector<HTMLCanvasElement>('#scope')!
const ctx = canvas.getContext('2d')!

function log(message: string) {
  const pos = String(Tone.Transport.position)
  logEl.textContent = `[${new Date().toLocaleTimeString()} pos=${pos} state=${Tone.Transport.state}] ${message}\n` + logEl.textContent
}

const analyser = new Tone.Analyser('waveform', 256)
const master = new Tone.Gain(0.58).toDestination()
master.connect(analyser)
const drumBus = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.006, release: 0.12 }).connect(master)
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.045,
  octaves: 8,
  envelope: { attack: 0.001, decay: 0.32, sustain: 0.01, release: 0.8 },
}).connect(drumBus)
const hat = new Tone.MetalSynth({
  envelope: { attack: 0.001, decay: 0.045, release: 0.02 },
  harmonicity: 5.1,
  modulationIndex: 24,
  resonance: 4200,
  octaves: 1.5,
}).connect(drumBus)
const bassFilter = new Tone.Filter(580, 'lowpass').connect(master)
const bass = new Tone.MonoSynth({
  oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
  filter: { Q: 2.2, type: 'lowpass', rolloff: -24 },
  envelope: { attack: 0.006, decay: 0.22, sustain: 0.22, release: 0.14 },
  filterEnvelope: { attack: 0.006, decay: 0.2, sustain: 0.12, release: 0.12, baseFrequency: 58, octaves: 3.1 },
}).connect(bassFilter)
const padVerb = new Tone.Reverb({ decay: 3.5, wet: 0.24 }).connect(master)
const padFilter = new Tone.Filter(1200, 'lowpass').connect(padVerb)
const pad = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fattriangle', count: 3, spread: 24 },
  envelope: { attack: 0.35, decay: 0.3, sustain: 0.52, release: 2.2 },
}).connect(padFilter)

let kickEnabled = false
let step = 0
const loop = new Tone.Loop((time) => {
  if (kickEnabled && step % 4 === 0) kick.triggerAttackRelease('C1', '8n', time, 0.88)
  if (step % 8 === 0) log(`loop callback step=${step}, kickEnabled=${kickEnabled}`)
  step = (step + 1) % 16
}, '16n')

function nextBarTime(): string {
  const [barRaw = '0'] = String(Tone.Transport.position).split(':')
  const nextBar = Number.parseInt(barRaw, 10) + 1
  return `${nextBar}:0:0`
}

function preBoundaryTimeForBar(barTime: string): string {
  const toneBar = Number.parseInt(barTime.split(':')[0] ?? '0', 10)
  if (toneBar <= 0) return '0:0:0'
  return `${toneBar - 1}:3:3.75`
}

async function unlock() {
  await Tone.start()
  await Tone.getContext().resume()
  await Tone.loaded()
  // PANIC hard-mutes master gain to 0. Any later intentional audio action
  // should explicitly re-arm output so the harness does not look broken.
  master.gain.cancelScheduledValues(Tone.now())
  master.gain.value = 0.58
  log(`audio unlocked, context=${Tone.getContext().state}, master re-armed`)
}

function ensureTransportRunningForScheduledAction() {
  if (Tone.Transport.state === 'started') return
  step = 0
  kickEnabled = false
  Tone.Transport.cancel()
  Tone.Transport.position = '0:0:0'
  Tone.Transport.bpm.value = 124
  loop.start(0)
  Tone.Transport.start()
  log('transport was stopped; auto-started empty transport for scheduled action')
}

document.querySelector('#unlock')?.addEventListener('click', unlock)
document.querySelector('#start-empty')?.addEventListener('click', async () => {
  await unlock()
  step = 0
  kickEnabled = false
  master.gain.cancelScheduledValues(Tone.now())
  master.gain.value = 0.58
  Tone.Transport.cancel()
  Tone.Transport.position = '0:0:0'
  Tone.Transport.bpm.value = 124
  loop.start(0)
  Tone.Transport.start()
  log('started empty transport; no audible layer should play')
})
document.querySelector('#stop')?.addEventListener('click', () => {
  Tone.Transport.stop()
  Tone.Transport.cancel()
  Tone.Transport.position = '0:0:0'
  loop.stop()
  step = 0
  kickEnabled = false
  log('stopped and reset')
})
document.querySelector('#panic')?.addEventListener('click', () => {
  const now = Tone.now()
  kickEnabled = false
  Tone.Transport.stop()
  Tone.Transport.cancel()
  Tone.Transport.position = '0:0:0'
  loop.stop()
  step = 0
  // Emergency panic should feel like a hard kill, not a musical fade-out.
  // Mute the master before releasing synth voices so envelope/reverb tails are inaudible.
  master.gain.cancelScheduledValues(now)
  master.gain.value = 0
  kick.triggerRelease(now)
  bass.triggerRelease(now)
  pad.releaseAll(now)
  log('panic: hard-muted master, stopped transport, canceled schedules, released voices, reset position')
})
document.querySelector('#kick-next-bar')?.addEventListener('click', async () => {
  await unlock()
  ensureTransportRunningForScheduledAction()
  const at = nextBarTime()
  const engineApplyAt = preBoundaryTimeForBar(at)
  Tone.Transport.scheduleOnce(() => {
    kickEnabled = true
    log(`APPLIED kickEnabled=true just before target boundary ${at}`)
  }, engineApplyAt)
  log(`scheduled kick enable at target=${at}, engineApplyAt=${engineApplyAt}; first downbeat should hear new state`)
})
document.querySelector('#bass-ramp')?.addEventListener('click', async () => {
  await unlock()
  const now = Tone.now() + 0.04
  bass.triggerAttackRelease('C2', '1m', now, 0.75)
  bassFilter.frequency.cancelScheduledValues(now)
  bassFilter.frequency.setValueAtTime(220, now)
  bassFilter.frequency.linearRampToValueAtTime(1800, now + 2.0)
  log('bass note + cutoff linear ramp 220 -> 1800 over 2s')
})
document.querySelector('#pad-space')?.addEventListener('click', async () => {
  await unlock()
  pad.triggerAttackRelease(['C3', 'Eb3', 'G3', 'Bb3'], '2m', Tone.now() + 0.04, 0.48)
  padFilter.frequency.rampTo(900, 0.2)
  padVerb.wet.rampTo(0.48, 0.6)
  log('pad chord + filter/reverb safe ramps')
})
document.querySelector('#part-fill')?.addEventListener('click', async () => {
  await unlock()
  ensureTransportRunningForScheduledAction()
  const at = nextBarTime()
  const part = new Tone.Part((time, note: string) => {
    kick.triggerAttackRelease(note, '16n', time, 0.7)
  }, [
    ['0:0:0', 'C1'],
    ['0:2:0', 'C1'],
    ['0:3:2', 'G1'],
    ['0:3:3', 'C1'],
  ])
  part.loop = false
  part.start(at)
  Tone.Transport.scheduleOnce(() => {
    part.dispose()
    log('disposed one-bar Part fill after playback window')
  }, `${Number.parseInt(at.split(':')[0], 10) + 1}:0:0`)
  log(`scheduled throwaway Part fill at ${at}`)
})
document.querySelector('#sequence-hats')?.addEventListener('click', async () => {
  await unlock()
  ensureTransportRunningForScheduledAction()
  const at = nextBarTime()
  const seq = new Tone.Sequence((time, velocity: number | null) => {
    if (velocity !== null) hat.triggerAttackRelease('C6', '32n', time, velocity)
  }, [0.26, null, 0.18, 0.22, 0.32, null, 0.2, 0.18], '16n')
  seq.loop = 2
  seq.start(at)
  Tone.Transport.scheduleOnce(() => {
    seq.dispose()
    log('disposed Sequence hats after 2 loops')
  }, `${Number.parseInt(at.split(':')[0], 10) + 2}:0:0`)
  log(`scheduled Sequence hats at ${at}`)
})

function draw() {
  const values = analyser.getValue() as Float32Array
  let energy = 0
  for (const v of values) energy += Math.abs(v)
  energy /= values.length
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = energy > 0.01 ? '#9bf6ff' : '#293044'
  ctx.beginPath()
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * canvas.width
    const y = canvas.height / 2 + v * 70
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.fillStyle = '#e8ecff'
  ctx.fillText(`analyser energy=${energy.toFixed(4)} audibleGate=${energy > 0.01}`, 12, 22)
  requestAnimationFrame(draw)
}
draw()
log('harness loaded')
