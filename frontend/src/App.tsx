import { useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent } from 'react'
import './App.css'
import { applyCommandFast, transcribeAudio } from './apiClient'
import { createLiveLoopEngine, type AudioEngineStatus, type LiveLoopEngine, type ScheduledUpdateId } from './audioEngine'
import { createInitialLoopState } from './loopState'
import { computeScheduleDecision, describeSchedule } from './quantizedScheduler'
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
}

function App() {
  const [state, setState] = useState(createInitialLoopState)
  const [command, setCommand] = useState('')
  const [commandOpen, setCommandOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [presetIndex, setPresetIndex] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const [engine] = useState<LiveLoopEngine>(() => createLiveLoopEngine())
  const [audioNode] = useState<AudioNode>(() => engine.getAudioNode())
  const [, setAudioStatus] = useState<AudioEngineStatus>(() => engine.getStatus())
  const [audioMessage, setAudioMessage] = useState('click visualizer to start')
  const [heardText, setHeardText] = useState('')
  const [pendingSchedules, setPendingSchedules] = useState<PendingSchedule[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const stateRef = useRef(state)
  const plannedStateRef = useRef(state)
  const pendingSchedulesRef = useRef<PendingSchedule[]>([])

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
      recorderRef.current?.stop()
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      pendingSchedulesRef.current.forEach((schedule) => engine.cancelScheduledUpdate(schedule.id))
      syncPendingSchedules([])
      engine.dispose()
    }
  }, [engine])

  useEffect(() => {
    stateRef.current = state
    if (pendingSchedulesRef.current.length === 0) plannedStateRef.current = state
    engine.update(state)
  }, [engine, state])

  useEffect(() => {
    const timer = window.setInterval(() => setAudioStatus(engine.getStatus()), 500)
    return () => window.clearInterval(timer)
  }, [engine])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 120)
    return () => window.clearInterval(timer)
  }, [])

  async function startTransport() {
    if (isPlaying) return
    try {
      await engine.start()
      setIsPlaying(true)
      setAudioStatus(engine.getStatus())
      setAudioMessage('audio running')
    } catch (error) {
      setAudioMessage(`audio start failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function stopTransport() {
    pendingSchedulesRef.current.forEach((schedule) => engine.cancelScheduledUpdate(schedule.id))
    syncPendingSchedules([])
    plannedStateRef.current = stateRef.current
    engine.stop()
    setIsPlaying(false)
    setAudioStatus(engine.getStatus())
    setAudioMessage('audio stopped')
  }

  async function toggleTransport() {
    if (isPlaying) await stopTransport()
    else await startDemo()
  }

  async function submitCommand(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    const planningBase = plannedStateRef.current
    const result = await applyCommandFast(planningBase, trimmed)
    plannedStateRef.current = result.state

    const decision = computeScheduleDecision(engine.getTransportPosition(), trimmed)
    const scheduleText = describeSchedule(decision)
    setCommand('')
    setCommandOpen(false)

    if (decision.quantization === 'immediate') {
      setState(result.state)
      setAudioMessage(`${result.source} · ${Math.round(result.latencyMs)}ms · ${scheduleText}`)
      if (!isPlaying) await startTransport()
      return
    }

    cancelPendingSchedules((schedule) => schedule.applyAtBar === decision.applyAtBar)
    const scheduled = engine.scheduleUpdateAtBar(result.state, decision.applyAtBar, () => {
      setState(result.state)
      syncPendingSchedules(pendingSchedulesRef.current.filter((item) => item.id !== scheduled.id))
      if (pendingSchedulesRef.current.length === 0) plannedStateRef.current = result.state
      setAudioMessage(`${decision.applyAtBar}마디 적용됨 · ${result.source}`)
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
      },
    ])
    setAudioMessage(`${result.source} · ${Math.round(result.latencyMs)}ms · ${scheduleText} · ${scheduled.transportTime}`)
  }

  async function startDemo() {
    let nextState = (await applyCommandFast(state, '124bpm 하우스. 킥은 단단하게, 베이스는 C minor 오프비트로 통통 튀게 라이브 코딩해줘')).state
    nextState = (await applyCommandFast(nextState, '패드 깔아줘')).state
    setState(nextState)
    await startTransport()
  }

  async function startListening() {
    if (isListening || recorderRef.current) return
    try {
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
          setAudioMessage('마이크 입력이 비어 있어요')
          return
        }
        setAudioMessage('음성을 텍스트로 변환 중')
        void transcribeAudio(blob)
          .then(async (transcript) => {
            const text = transcript.text.trim()
            if (!text) {
              setAudioMessage('음성을 인식하지 못했어요')
              return
            }
            setHeardText(text)
            setAudioMessage(`들은 말: ${text} · STT ${transcript.latency_ms}ms`)
            await submitCommand(text)
          })
          .catch((error) => {
            setAudioMessage(`STT failed: ${error instanceof Error ? error.message : String(error)}`)
          })
      }
      micStreamRef.current = stream
      recorderRef.current = recorder
      recorder.start()
      setHeardText('')
      setIsListening(true)
      setAudioMessage('누르는 동안만 듣는 중')
    } catch (error) {
      setIsListening(false)
      recorderRef.current = null
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
      setAudioMessage(`mic failed: ${error instanceof Error ? error.message : String(error)}`)
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
      const isPrevPreset = event.key === '[' || event.code === 'BracketLeft'
      const isNextPreset = event.key === ']' || event.code === 'BracketRight'
      if (isVoice && !commandOpen && !event.repeat) {
        event.preventDefault()
        void startListening()
        return
      }
      if ((isPrevPreset || isNextPreset) && !commandOpen && !event.repeat) {
        event.preventDefault()
        setPresetIndex((current) => current + (isNextPreset ? 1 : -1))
        setAudioMessage(isNextPreset ? 'next visual preset' : 'previous visual preset')
        return
      }
      if (event.key === ' ' && !commandOpen && !event.repeat) {
        event.preventDefault()
        void toggleTransport()
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

  function onTalkPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    void startListening()
  }

  function onTalkPointerUp(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    stopListening()
  }

  const nextPending = pendingSchedules[0]
  const pendingCountdownSec = nextPending ? Math.max(0, (nextPending.dueAtMs - nowMs) / 1000).toFixed(1) : ''
  const feedbackText = nextPending
    ? `예약: ${nextPending.applyAtBar}마디 · ${pendingCountdownSec}초 · ${nextPending.text}`
    : heardText
      ? `들은 말: ${heardText} · ${audioMessage}`
      : audioMessage

  return (
    <main className={isListening ? 'visual-stage listening' : 'visual-stage'} tabIndex={-1} onClick={() => void startDemo()}>
      <Visualizer audioNode={audioNode} active={isPlaying} presetIndex={presetIndex} />

      <button
        className={isListening ? 'talk-button listening' : 'talk-button'}
        type="button"
        aria-pressed={isListening}
        onPointerDown={onTalkPointerDown}
        onPointerUp={onTalkPointerUp}
        onPointerCancel={onTalkPointerUp}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="talk-dot" />
        <span className="talk-copy">
          <span>{isListening ? '듣는 중' : '누르고 말하기'}</span>
          <span>{isListening ? '떼면 마이크 꺼짐' : '누르는 동안만 마이크'}</span>
        </span>
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

      <div className={heardText || nextPending ? 'voice-feedback active' : 'voice-feedback'} aria-live="polite">
        <span>{feedbackText}</span>
      </div>

      <p className="sr-only" aria-live="polite">
        {audioMessage}
      </p>
    </main>
  )
}

export default App
