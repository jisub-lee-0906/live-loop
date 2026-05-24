# live-loop Architecture Spine

이 문서는 `live-loop`가 잘못된 방향으로 새지 않도록 고정하는 설계 줄기다.
새 기능은 이 줄기에 붙지 않으면 구현하지 않는다.

## 1. 제품 한 줄 정의

`live-loop`는 사용자가 한국어/영어 음성 명령으로 빈 루프스테이션을 직접 쌓고 변형하는 로컬 AI 라이브 악기다.

핵심은 자동 작곡기가 아니다.
핵심은 LLM 챗봇이 아니다.
핵심은 Tone.js 코드 생성기가 아니다.

핵심은 다음이다.

```text
사용자 명령
  -> 안전한 음악 의도
  -> 검증된 MusicPatch / PatternDSL / AutomationPlan
  -> LoopState
  -> quantized scheduler
  -> Tone.js audio engine
  -> 소리 + visualizer feedback
```

## 2. 절대 원칙

1. 시작은 항상 silence / empty transport다.
2. 사용자가 conductor다. AI는 bridge다.
3. LLM은 JS/Tone.js 코드를 직접 만들지 않는다.
4. LLM output은 반드시 검증 가능한 data다.
5. 현재 groove 보존이 변경만큼 중요하다.
6. STT/LLM 지연은 오디오 clock을 절대 막지 않는다.
7. 음악 변화는 기본적으로 next_bar 또는 next_phrase에 적용한다.
8. panic / undo / safe mute는 고급 자동화보다 먼저 완성한다.
9. visualizer는 실제 audible layer/analyser energy에 반응해야 한다.
10. local-first가 목표이고 API는 개발/비교 fallback이다.

## 3. 금지 방향

다음은 구현하지 않는다.

- LLM이 생성한 arbitrary JavaScript 실행
- LLM이 Tone.js node graph를 직접 생성/삭제
- STT/LLM 응답을 기다리느라 Transport 정지
- 전체 곡 자동 생성 중심 제품화
- preset 몇 개만 고르는 toy loopstation으로 축소
- 자연어 표현이 늘어날 때마다 고정 preset/gesture를 하나씩 추가하는 방식
- visualizer만 움직이고 실제 layer/audio가 없는 가짜 성공
- dashboard/debug UI 중심으로 제품 방향 전환
- always-on STT를 MVP 기본 인터페이스로 채택
- 검증되지 않은 sample/effect/path를 live path에 노출

## 4. 단일 실행 경로

모든 입력은 하나의 reducer/scheduler 경로로 합쳐야 한다.

```text
Text input 또는 PTT STT text
  -> deterministic parser
  -> optional LLM planner
  -> NormalizedMusicIntent
  -> parameterized MusicPlan
  -> MusicPatch / PatternDSL / AutomationPlan
  -> capability validation
  -> LoopState reducer
  -> pending scheduled update
  -> audioEngine.update at safe boundary
```

중요:

- backend action을 받고 frontend에서 raw text를 다시 대충 파싱하는 우회 경로 금지.
- deterministic rule과 LLM output은 같은 schema로 합류해야 한다.
- MusicPatch가 검증된 timing을 가지면 scheduler는 그 timing을 실제로 써야 한다.
- `pendingPatch`는 UI 표시용만이 아니라 실제 apply boundary와 일치해야 한다.
- catalog preset은 안전 primitive/fallback일 뿐이다. 제품 중심은 `LoopState`를 보고 macro, event, density, automation을 생성하는 parameterized planner여야 한다.

## 5. 핵심 모듈 책임

### `src/live_loop/local_stt.py`

역할:
- PTT audio를 text로 변환한다.
- 짧은 한국어 명령에서 VAD empty fallback을 처리한다.
- STT 결과가 비어 있거나 command-shaped가 아니면 안전하게 실패한다.

하지 말 것:
- 음악 상태 변경
- Tone.js 관련 판단
- LLM 의도 생성

### `src/live_loop/local_llm.py`, `src/live_loop/live_intent.py`

역할:
- 자연어를 제한된 JSON intent/action으로 변환한다.
- 현재 LoopState context를 보고 preserve rule을 추론한다.
- 낮은 confidence 또는 invalid JSON은 fail closed 한다.

하지 말 것:
- 자유 코드 생성
- raw Tone.js path 직접 실행 지시
- audio timing을 무시한 즉시 변경 남발

### `frontend/src/liveAction.ts`

역할:
- live parameter registry다.
- 지원 target/path/range/timing/state mapping을 명시한다.
- unsupported는 확실히 reject한다.

설계 규칙:
- registry에 `supported`로 올린 parameter는 반드시 `audioRuntimeParams.ts` 또는 `audioEngine.ts`까지 audible wiring이 있어야 한다.
- 아직 audible wiring이 없으면 `stateKind: 'unsupported'`로 둔다.

### `frontend/src/musicPatch.ts`

역할:
- layer add/mute/unmute, macro 변경, safe patch application의 data reducer다.
- history snapshot을 남겨 undo가 가능해야 한다.

설계 규칙:
- patch는 data-only다.
- patch 검증 실패 시 state mutation 금지.
- mute는 sound setting을 삭제하지 않는다.

### `frontend/src/patchCatalog.ts`

역할:
- deterministic command와 LLM이 선택할 수 있는 verified recipe catalog다.
- MVP 명령의 기본 vocabulary를 제공한다.

설계 규칙:
- add recipe가 있으면 대응 mute/off recipe도 있어야 한다.
- `드럼비트` 같은 group command는 kick/snare/hats의 대칭 add/off를 가져야 한다.
- catalog item은 테스트에서 전부 `isPatchSupported()`를 통과해야 한다.

### `frontend/src/patternDsl.ts`, `frontend/src/playbackEvents.ts`

역할:
- rhythm/bass/pad event를 engine-independent PatternDSL로 표현한다.
- density, complexity, subdivision이 실제 event로 변환된다.

설계 규칙:
- 상태에만 있는 groove 값 금지. 값이 있으면 소리/타이밍에 반영해야 한다.
- LLM은 PatternDSL data를 만들거나 선택하지 Tone.js scheduling code를 만들지 않는다.

### `frontend/src/audioRuntimeParams.ts`

역할:
- LoopState macro를 Tone-safe runtime parameter로 변환한다.
- clamp/range/default를 여기서 확정한다.

설계 규칙:
- 이 파일은 audioEngine보다 먼저 테스트한다.
- macro가 실제 audible mapping이 없으면 registry/catalog에 노출하지 않는다.

### `frontend/src/audioEngine.ts`

역할:
- Tone.js graph를 소리로 구현한다.
- scheduled boundary에서만 graph/param update를 반영한다.
- per-step callback은 가능한 한 event trigger만 한다.

설계 규칙:
- node 생성/폐기는 live callback 안에서 하지 않는다.
- 필터/리버브/엔벌로프/볼륨은 safe ramp를 사용한다.
- empty transport에서 소리가 나면 안 된다.
- audible layer가 없으면 visualizer도 idle이어야 한다.

## 6. 데이터 계약 v1

### 6.1 NormalizedMusicIntent

LLM/deterministic parser의 공통 출력 목표다.

```ts
type NormalizedMusicIntent = {
  source: 'deterministic' | 'llm'
  confidence: number
  text: string
  operations: Array<MusicPatch | PatternPatch | AutomationPatch>
  preserve?: Array<'kick' | 'drums' | 'bass' | 'pad' | 'groove' | 'sound' | 'pattern'>
  timing: 'now' | 'next_step' | 'next_bar' | 'next_phrase'
  reason?: string
}
```

MVP에서는 새 type 파일을 만들기 전이라도 이 구조를 설계 기준으로 삼는다.

### 6.2 MusicPatch

현재 구현 기준:

- `set_enabled`
- `set_volume`
- `set_complexity`
- `set_subdivision`
- `set_macro`

이 patch는 layer 상태와 sound macro만 바꾼다.

### 6.3 PatternDSL

역할:
- drum/bass/pad의 음악 event 구조를 나타낸다.
- density/fill/syncopation/phrase variation은 여기서 확장한다.

### 6.4 AutomationPlan

아직 MVP 핵심 후순위다.
하지만 설계상 위치는 확정한다.

```ts
type AutomationPlan = {
  target: string
  param: string
  from?: number
  to: number
  duration: '1m' | '2m' | '4m'
  curve: 'linear' | 'exponential'
  timing: 'next_bar' | 'next_phrase'
}
```

AutomationPlan은 build/drop/filter sweep 같은 연출에만 쓰고, 기본 add/mute 명령보다 먼저 구현하지 않는다.

## 7. MVP acceptance spine

Fresh browser에서 다음이 실제 소리로 통과해야 MVP다.

1. Start: transport는 돌 수 있지만 audible layer는 0개다.
2. “킥 깔아줘” -> next bar에 kick만 들어온다.
3. “하이햇 얹어줘” -> kick 유지, hats 추가.
4. “베이스 둥글게 넣어줘” -> bass 추가, darker/warmer sound macro가 실제 소리에 반영.
5. “킥은 유지하고 드럼 더 몰아줘” -> kick pattern/sound 보존, hats/snare density 증가.
6. “패드 넓게 깔아줘” -> pad 추가, reverb/width 계열 macro가 실제 소리에 반영.
7. “전체 좀 어둡게” -> 가능한 layer의 cutoff/brightness가 안전 범위에서 감소.
8. “베이스 잠깐 빼” -> bass mute, macros/pattern 보존.
9. “다시 드랍” -> bass 복귀 + energy 증가.
10. “되돌려” -> 직전 변경 복원.
11. “멈춰” / “panic” -> 즉시 안전 mute/stop.

이 데모를 통과하지 못하면 새 Tone.js feature 추가는 보류한다.

## 8. 개발 순서 고정

### Phase 0 — Tone.js mastery spike

목표:
- 본 구현 전에 `live-loop`에 필요한 Tone.js timing/audio/graph behavior를 실제 브라우저 실험으로 검증한다.
- 결과를 capability decision table에 반영하고, 검증되지 않은 기능은 registry에 열지 않는다.

기준 문서:
- `docs/tonejs-mastery-spike-plan.md`
- `docs/tonejs-live-safe-decision-table.md`
- `frontend/spikes/tonejs-live-loop-mastery/`

검증:
- transport boundary/order 확인.
- Loop vs Part/Sequence 판단.
- gain/filter/reverb ramp 안전성 확인.
- graph mutation 금지/허용 boundary 확정.
- analyser energy 기반 visual truth rule 확인.

### Phase A — 줄기 정리

목표:
- 현재 코드가 이 문서와 맞는지 audit한다.
- 우회 경로와 state-only 기능을 찾는다.

검증:
- `frontend/src/liveAction.ts`의 supported registry가 실제 audio wiring과 일치.
- `frontend/src/patchCatalog.ts`의 모든 catalog patch가 supported.
- `pendingPatch.timing`이 scheduler에서 실제 사용.

### Phase B — MVP end-to-end path 고정

목표:
- text command 기준으로 acceptance demo 1~11을 통과한다.
- STT/LLM 없이도 engine/state/scheduler가 맞아야 한다.

검증:
- Vitest unit tests.
- frontend에서 text input으로 hand test.
- audio/visualizer가 실제 audible layer와 일치.

### Phase C — STT PTT 안정화

목표:
- PTT -> STT -> same command path.
- short Korean command VAD fallback.
- PTT 중 aggressive ducking.
- stale STT result guard.

검증:
- `/api/stt/status` ready.
- known audio upload.
- browser PTT repeated commands after music starts.

### Phase D — LLM planner 연결

목표:
- LLM은 current LoopState + capability list를 받아 NormalizedMusicIntent만 출력한다.
- deterministic과 같은 reducer path로만 적용한다.

검증:
- invalid JSON fail closed.
- unsupported param reject.
- ambiguous Korean commands map to verified patch combination.

### Phase E — Tone.js capability 확장

목표:
- macro를 하나씩 열고 실제 audible wiring까지 끝낸다.

순서:
1. bass: cutoff/resonance/drive/sub/gate/pattern family
2. hats/drums: density/ghost/fill/humanize/swing 실제 timing
3. pad: filter/reverb/chorus/width/attack/release
4. automation: filter sweep/density ramp/drop return

규칙:
- registry -> tests -> runtime params -> audio engine -> audible verification 순서만 허용.

## 9. 구현 gate

새 기능은 아래 질문을 모두 통과해야 한다.

1. 이 기능이 MVP acceptance demo에 직접 필요한가?
2. 데이터 schema로 표현되는가?
3. range/type/timing validation이 있는가?
4. LoopState에 보존/undo 가능한 형태로 들어가는가?
5. scheduler가 실제 timing을 적용하는가?
6. Tone.js wiring이 실제 소리로 들리는가?
7. visualizer/state UI가 거짓 성공을 보여주지 않는가?
8. 테스트가 있는가?

하나라도 아니면 구현하지 않거나 `unsupported`로 둔다.

## 10. 다음 작업 지시

이 문서 기준으로 다음 작업은 구현이 아니라 audit plan이다.

1. `liveAction.ts` registry와 `audioRuntimeParams.ts`/`audioEngine.ts` wiring 일치 여부 검사.
2. `patchCatalog.ts`의 add/mute/drop/undo command가 acceptance demo와 일치하는지 검사.
3. `pendingPatch`와 scheduler가 next_bar/next_phrase를 실제로 쓰는지 검사.
4. text command만으로 MVP acceptance demo를 통과시키는 최소 수정 목록 작성.
5. 그 뒤에만 STT/LLM/Tone.js capability 확장을 진행한다.
