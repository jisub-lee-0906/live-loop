import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, PointerEvent } from 'react'
import './App.css'
import { applyCommandFast, transcribeAudio } from './apiClient'
import { createLiveLoopEngine, type LiveLoopEngine, type ScheduledUpdateId } from './audioEngine'
import { createInitialLoopState } from './loopState'
import { createDebugPlanSummary } from './debugPlanSummary'
import { computeScheduleDecision, describeSchedule, type Quantization } from './quantizedScheduler'
import { shouldTranscribeRecordedAudio } from './sttGate'
import { Visualizer } from './Visualizer'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

const ENABLE_TEXT_DEBUG = import.meta.env.VITE_LIVE_LOOP_ENABLE_TEXT_INPUT === '1'

interface PendingSchedule {
  id: ScheduledUpdateId
  applyAtBar: number
  dueAtMs: number
  source: string
  text: string
  transportTime: string
  barsUntilApply: number
}

function TypewriterCaption({ text }: { text: string }) {
  const durationMs = Math.min(1400, Math.max(320, text.length * 22))
  return (
    <span
      key={text}
      className="typewriter-caption"
      style={{ '--typewriter-duration': `${durationMs}ms` } as CSSProperties}
    >
      {text}
      <span className="typewriter-caret" aria-hidden="true" />
    </span>
  )
}

function formatBarsUntilApply(barsUntilApply: number) {
  return barsUntilApply <= 1 ? 'NEXT BAR' : `IN ${barsUntilApply} BARS`
}

function timingToQuantization(timing: string | undefined): Quantization | undefined {
  if (timing === 'now') return 'immediate'
  if (timing === 'next_bar') return 'next_bar'
  if (timing === 'next_phrase') return 'next_phrase'
  if (timing === 'next_step') return 'next_bar'
  return undefined
}

function App() {
  const [state, setState] = useState(createInitialLoopState)
  const [command, setCommand] = useState('')
  const [commandOpen, setCommandOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [presetIndex, setPresetIndex] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const [engine] = useState<LiveLoopEngine>(() => createLiveLoopEngine())
  const [audioNode] = useState<AudioNode>(() => engine.getAudioNode())
  const [audioMessage, setAudioMessage] = useState('READY')
  const [heardText, setHeardText] = useState('')
  const [pendingSchedules, setPendingSchedules] = useState<PendingSchedule[]>([])
  const stateRef = useRef(state)
  const plannedStateRef = useRef(state)
  const pendingSchedulesRef = useRef<PendingSchedule[]>([])
  const sttRequestIdRef = useRef(0)

  function syncPendingSchedules(next: PendingSchedule[]) {
    const sorted = [...next].sort((a, b) => a.applyAtBar - b.applyAtBar || a.dueAtMs - b.dueAtMs)
    pendingSchedulesRef.current = sorted
    setPendingSchedules(sorted)
  }

  function cancelPendingSchedules(predicate: (schedule: PendingSchedule) => boolean) {
    const cancelled = pendingSchedulesRef.current.filter(predicate)
    cancelled.forEach((schedule) => engine.cancelScheduledUpdate(schedule.id))
    syncPendingSchedules(pendingSchedulesRef.current.filter((schedule) => !predicate(schedule)))
  }

  useEffect(() => {
    return () => {
      sttRequestIdRef.current += 1
      recorderRef.current?.stop()
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      pendingSchedulesRef.current.forEach((schedule) => engine.cancelScheduledUpdate(schedule.id))
      syncPendingSchedules([])
      // Vite Fast Refresh unmounts/remounts App after code edits. Disposing the
      // Tone/Web Audio graph during that dev-only unmount can leave the hot-
      // refreshed UI holding silent disposed nodes. In production, keep the
      // normal cleanup path.
      if (import.meta.env.PROD) engine.dispose()
    }
  }, [engine])

  useEffect(() => {
    stateRef.current = state
    if (pendingSchedulesRef.current.length === 0) plannedStateRef.current = state
    engine.update(state)
  }, [engine, state])


  useEffect(() => {
    engine.setListeningDucking(isListening)
  }, [engine, isListening])

  async function startTransport() {
    if (isPlaying) return
    try {
      await engine.start()
      setIsPlaying(true)
      setAudioMessage('RUNNING')
    } catch (error) {
      setAudioMessage(`AUDIO START FAILED · ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function stopTransport() {
    pendingSchedulesRef.current.forEach((schedule) => engine.cancelScheduledUpdate(schedule.id))
    syncPendingSchedules([])
    plannedStateRef.current = stateRef.current
    engine.stop()
    setIsPlaying(false)
    setAudioMessage('STOPPED')
  }

  function pauseTransport() {
    engine.pause()
    setIsPlaying(false)
    setAudioMessage('PAUSED')
  }

  async function togglePauseTransport() {
    if (isPlaying) {
      pauseTransport()
      return
    }
    if (engine.getStatus().transportState === 'paused') {
      try {
        await engine.resume()
        setIsPlaying(true)
        setAudioMessage('RUNNING')
      } catch (error) {
        setAudioMessage(`AUDIO RESUME FAILED · ${error instanceof Error ? error.message : String(error)}`)
      }
      return
    }
    await startEmptyLoop()
  }

  async function submitCommand(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const planningBase = plannedStateRef.current
    const result = await applyCommandFast(planningBase, trimmed)
    plannedStateRef.current = result.state

    const decision = computeScheduleDecision(engine.getTransportPosition(), trimmed, {
      forceQuantization: timingToQuantization(result.state.pendingPatch?.timing),
    })
    const scheduleText = describeSchedule(decision)
    setCommand('')
    setCommandOpen(false)

    if (decision.quantization === 'immediate') {
      const commandAction = result.state.commandLog[0]?.action
      const isPanicCommand = commandAction === 'panic'
      const isStopCommand = commandAction === 'stop'
      pendingSchedulesRef.current.forEach((schedule) => engine.cancelScheduledUpdate(schedule.id))
      syncPendingSchedules([])
      engine.update(result.state)
      setState(result.state)
      plannedStateRef.current = result.state
      if (isPanicCommand) {
        engine.panic()
        setIsPlaying(false)
        setAudioMessage('PANIC')
        return
      }
      if (isStopCommand) {
        engine.stop()
        setIsPlaying(false)
        setAudioMessage('STOPPED')
        return
      }
      setAudioMessage(`APPLIED · ${scheduleText.toUpperCase()}`)
      if (!isPlaying) await startTransport()
      return
    }

    cancelPendingSchedules((schedule) => schedule.applyAtBar === decision.applyAtBar)
    const scheduled = engine.scheduleUpdateAtBar(result.state, decision.applyAtBar, () => {
      setState(result.state)
      syncPendingSchedules(pendingSchedulesRef.current.filter((item) => item.id !== scheduled.id))
      if (pendingSchedulesRef.current.length === 0) plannedStateRef.current = result.state
      setAudioMessage('APPLIED')
    })
    syncPendingSchedules([
      ...pendingSchedulesRef.current,
      {
        id: scheduled.id,
        applyAtBar: decision.applyAtBar,
        dueAtMs: Date.now() + decision.applyInMs,
        source: result.source,
        text: trimmed,
        transportTime: scheduled.transportTime,
        barsUntilApply: decision.barsUntilApply,
      },
    ])
    setAudioMessage(`QUEUED · ${formatBarsUntilApply(decision.barsUntilApply)}`)
  }

  async function startEmptyLoop() {
    engine.update(stateRef.current)
    await startTransport()
    setAudioMessage('EMPTY LOOP')
  }

  async function startListening() {
    if (isTranscribing) {
      setAudioMessage('WAIT · TRANSCRIBING')
      return
    }
    if (isListening || recorderRef.current) return
    try {
      await engine.unlockAudio()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        micStreamRef.current = null
        recorderRef.current = null
        setIsListening(false)
        if (!blob.size) {
          setAudioMessage('NO INPUT')
          return
        }
        const requestId = sttRequestIdRef.current + 1
        sttRequestIdRef.current = requestId
        setIsTranscribing(true)
        setAudioMessage('CHECKING INPUT')
        void shouldTranscribeRecordedAudio(blob)
          .then(async (gate) => {
            if (requestId !== sttRequestIdRef.current) return
            if (!gate.shouldTranscribe) {
              setAudioMessage(gate.reason === 'too-short' ? 'TOO SHORT' : 'NO VOICE INPUT')
              return
            }
            setAudioMessage('TRANSCRIBING')
            const transcript = await transcribeAudio(blob)
            if (requestId !== sttRequestIdRef.current) return
            const text = transcript.text.trim()
            if (!text) {
              setAudioMessage('NO SPEECH DETECTED')
              return
            }
            setHeardText(text)
            setAudioMessage('HEARD')
            await submitCommand(text)
          })
          .catch((error) => {
            if (requestId !== sttRequestIdRef.current) return
            setAudioMessage(`STT FAILED · ${error instanceof Error ? error.message : String(error)}`)
          })
          .finally(() => {
            if (requestId === sttRequestIdRef.current) setIsTranscribing(false)
          })
      }
      micStreamRef.current = stream
      recorderRef.current = recorder
      recorder.start()
      setHeardText('')
      setIsListening(true)
      setAudioMessage('LISTENING')
    } catch (error) {
      setIsListening(false)
      recorderRef.current = null
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
      setAudioMessage(`MIC FAILED · ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function stopListening() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else {
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
      recorderRef.current = null
      setIsListening(false)
    }
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (isTypingTarget(event.target) && event.key !== 'Escape') return
      const isVoice = event.key.toLowerCase() === 'v' || event.code === 'KeyV'
      const isStop = event.key.toLowerCase() === 's' || event.code === 'KeyS'
      const isPrevPreset = event.key === '[' || event.code === 'BracketLeft'
      const isNextPreset = event.key === ']' || event.code === 'BracketRight'
      if (isStop && !commandOpen && !event.repeat) {
        event.preventDefault()
        void stopTransport()
        return
      }
      if (isVoice && !commandOpen && !event.repeat) {
        event.preventDefault()
        void startListening()
        return
      }
      if ((isPrevPreset || isNextPreset) && !commandOpen && !event.repeat) {
        event.preventDefault()
        setPresetIndex((current) => current + (isNextPreset ? 1 : -1))
        setAudioMessage(isNextPreset ? 'VISUAL PRESET +' : 'VISUAL PRESET -')
        return
      }
      if (event.key === ' ' && !commandOpen && !event.repeat) {
        event.preventDefault()
        void togglePauseTransport()
        return
      }
      if (event.key === '/' && ENABLE_TEXT_DEBUG && !commandOpen) {
        event.preventDefault()
        setCommandOpen(true)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        stopListening()
        setCommand('')
        setCommandOpen(false)
      }
    }

    function onKeyUp(event: globalThis.KeyboardEvent) {
      const isVoice = event.key.toLowerCase() === 'v' || event.code === 'KeyV'
      if (isVoice) {
        event.preventDefault()
        stopListening()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitCommand(command)
  }

  async function runSoundCheck() {
    try {
      await engine.preview()
      setAudioMessage('SOUND CHECK · FOUR KICKS')
    } catch (error) {
      setAudioMessage(`SOUND CHECK FAILED · ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function onTalkPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!isTranscribing) void startListening()
  }

  function onTalkPointerUp(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    stopListening()
  }

  const nextPending = pendingSchedules[0]
  const hasAudibleLayers = Object.values(state.layers).some((layer) => layer.enabled && layer.volume > 0)
  const visualizerActive = isPlaying && hasAudibleLayers
  const stageClassName = ['visual-stage', isListening ? 'listening' : '', visualizerActive ? 'active' : 'idle'].filter(Boolean).join(' ')
  const shouldAppendHeardText = Boolean(heardText && (audioMessage === 'HEARD' || audioMessage === 'APPLIED' || audioMessage.startsWith('APPLIED')))
  const captionActive = isListening || isTranscribing || Boolean(nextPending) || shouldAppendHeardText || !['READY', 'EMPTY LOOP', 'RUNNING'].includes(audioMessage)
  const previewState = nextPending ? plannedStateRef.current : state
  const debugPlanSummary = ENABLE_TEXT_DEBUG ? createDebugPlanSummary(previewState) : undefined

  const feedbackText = nextPending
    ? `QUEUED · ${formatBarsUntilApply(nextPending.barsUntilApply)} · ${nextPending.text}`
    : shouldAppendHeardText
      ? `${audioMessage} · ${heardText}`
      : audioMessage

  return (
    <main className={stageClassName} tabIndex={-1} onClick={() => void startEmptyLoop()}>
      <Visualizer audioNode={audioNode} active={visualizerActive} presetIndex={presetIndex} />

      <button
        className={isListening ? 'stage-button talk-button listening' : 'stage-button talk-button'}
        type="button"
        aria-pressed={isListening}
        disabled={isTranscribing}
        onPointerDown={onTalkPointerDown}
        onPointerUp={onTalkPointerUp}
        onPointerCancel={onTalkPointerUp}
        onClick={(event) => event.stopPropagation()}
      >
        {isTranscribing ? 'TRANSCRIBING' : isListening ? 'LISTENING' : 'PUSH TO TALK'}
      </button>

      <button
        className="stage-button sound-check-button"
        type="button"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void runSoundCheck()
        }}
        onClick={(event) => event.stopPropagation()}
      >
        SOUND CHECK
      </button>

      {ENABLE_TEXT_DEBUG ? (
        <form
          className={commandOpen ? 'command-veil open' : 'command-veil'}
          onSubmit={onSubmit}
          onClick={(event) => event.stopPropagation()}
          aria-hidden={!commandOpen}
        >
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="개발용 텍스트 지시 입력 · 사용자 입력은 오른쪽 버튼/V 음성"
            aria-label="debug live coding command"
            autoFocus={commandOpen}
          />
        </form>
      ) : null}

      {ENABLE_TEXT_DEBUG && debugPlanSummary ? (
        <aside className="debug-plan-panel" onClick={(event) => event.stopPropagation()} aria-label="debug generated music plan preview">
          <div className="debug-plan-title">PLAN PREVIEW</div>
          <dl>
            <div>
              <dt>command</dt>
              <dd>{debugPlanSummary.command}</dd>
            </div>
            <div>
              <dt>source</dt>
              <dd>{debugPlanSummary.source}</dd>
            </div>
            <div>
              <dt>knowledge</dt>
              <dd>{debugPlanSummary.knowledge}</dd>
            </div>
            <div>
              <dt>preserve</dt>
              <dd>{debugPlanSummary.preserve}</dd>
            </div>
            <div>
              <dt>intent</dt>
              <dd>{debugPlanSummary.intent}</dd>
            </div>
            <div>
              <dt>pending</dt>
              <dd>{debugPlanSummary.pending}</dd>
            </div>
            <div>
              <dt>layers</dt>
              <dd>{debugPlanSummary.activeLayers}</dd>
            </div>
            <div>
              <dt>pattern</dt>
              <dd>{debugPlanSummary.pattern}</dd>
            </div>
            <div>
              <dt>fx events</dt>
              <dd>{debugPlanSummary.fxEvents}</dd>
            </div>
            <div>
              <dt>automation</dt>
              <dd>{debugPlanSummary.fxAutomation}</dd>
            </div>
          </dl>
        </aside>
      ) : null}

      <div className={captionActive ? 'voice-feedback active' : 'voice-feedback'} aria-live="polite">
        <TypewriterCaption text={feedbackText} />
      </div>


      <p className="sr-only" aria-live="polite">
        {audioMessage}
      </p>
    </main>
  )
}

export default App
