# Tone.js Mastery Spike Plan for live-loop

목표: 구현 전에 `live-loop`에 필요한 Tone.js 영역을 실제 실험/문서/결정표로 검증한다.

이 phase의 산출물은 production feature가 아니라 설계 안전장치다. 결론이 `docs/architecture-spine.md`의 줄기에 붙지 않으면 본 구현으로 옮기지 않는다.

## 기준

설치 확인:

- `tone@15.1.22`
- 현재 프로젝트에서 확인된 export: `Transport`, `Loop`, `Part`, `Sequence`, `Pattern`, `Sampler`, `Players`, `FMSynth`, `AMSynth`, `PluckSynth`, `Chorus`, `Distortion`, `AutoFilter`, `StereoWidener`, `Meter`, `Analyser`

## Spike 목록

| # | Spike | Given / When / Then | Risk | 산출물 |
|---|---|---|---|---|
| 001 | transport-boundary-order | Given current 16n Loop, when state update and note event share a downbeat, then we know whether first beat uses old/new state | High | VALIDATED: apply engine state just before target boundary |
| 002 | loop-vs-part-sequence | Given PatternDSL event lists, when rendered by Loop vs Part/Sequence, then choose MVP scheduling primitive | High | decision: keep Loop or add Part/Sequence |
| 003 | live-safe-param-ramping | Given active bass/pad/drums, when cutoff/reverb/gain changes, then no click/unsafe jump occurs | High | ramp policy table |
| 004 | node-graph-mutation-boundary | Given active transport, when effects/instruments are changed, then identify which changes need next_bar or stop/rebuild | High | graph mutation rules |
| 005 | bass-capability-surface | Given bass commands like 둥글게/거칠게/움직이게, when mapped to Tone params, then audible safe macro set is known | Medium | bass registry proposal |
| 006 | hats-drums-density-humanize | Given hats/drum complexity commands, when density/swing/humanize changes, then actual timing/events change musically | Medium | rhythm macro rules |
| 007 | pad-space-effects | Given 넓게/몽환/어둡게 commands, when mapped to filter/reverb/chorus/width, then safe pad macro set is known | Medium | pad registry proposal |
| 008 | analyzer-visualizer-truth | Given empty transport or muted layers, when visualizer runs, then it stays idle unless analyser energy/audible layers exist | Medium | visual gating rule |
| 009 | sampler-player-policy | Given one-shot drums and future pitched samples, when using Player/Players/Sampler, then know what belongs in MVP | Low | sample policy |
| 010 | automation-plan-minimum | Given build/drop commands, when filter/density ramps are scheduled, then minimum AutomationPlan shape is known | Medium | automation schema v0 |

## 실행 순서

1. 001, 002, 003, 004를 먼저 한다. 이것들이 timing/audio safety를 결정한다.
2. 005, 006, 007로 instrument macro registry를 확정한다.
3. 008로 visualizer false-positive를 막는다.
4. 009, 010은 MVP demo가 안정된 뒤 확장 판단에 사용한다.

## 완료 조건

각 spike는 아래 결론 중 하나를 남긴다.

- VALIDATED: 본 구현에 반영 가능
- PARTIAL: 조건부 반영 가능, 제한을 registry에 명시
- INVALIDATED: live path에서 금지 또는 후순위

## 본 구현으로 옮기는 gate

어떤 Tone.js 기능도 아래를 통과하지 않으면 production path에 넣지 않는다.

1. MusicPatch / PatternDSL / AutomationPlan data로 표현 가능
2. range/type/timing validation 가능
3. LoopState에 보존/undo 가능
4. quantized scheduler와 연결 가능
5. `audioRuntimeParams.ts` 또는 `audioEngine.ts`에서 실제 audible wiring 가능
6. empty transport / muted layer에서 false visual success 없음
7. Vitest 또는 browser hand-test 절차 존재
