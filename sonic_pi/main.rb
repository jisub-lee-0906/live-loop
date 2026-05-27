# live-loop Sonic Pi MVP
#
# Usage:
# 1. Open Sonic Pi on Windows.
# 2. Preferences -> IO -> enable 'Receive Remote OSC' if needed.
# 3. Paste this file into a Sonic Pi buffer and Run.
# 4. From the project root, run commands like:
#    uv run live-loop send kick
#    uv run live-loop send hats
#    uv run live-loop send bass
#    uv run live-loop send '드럼 더 쪼개줘'

use_bpm 124

set :kick_enabled, 0
set :snare_enabled, 0
set :hats_enabled, 0
set :bass_enabled, 0
set :drum_complexity, 0.25

live_loop :osc_router do
  use_real_time
  msg = sync "/osc*/live_loop/layer/*/*"
  path = get_event("/osc*/live_loop/layer/*/*").to_s
  value = msg[0]

  if path.include? "/kick/enabled"
    set :kick_enabled, value
  elsif path.include? "/snare/enabled"
    set :snare_enabled, value
  elsif path.include? "/hats/enabled"
    set :hats_enabled, value
  elsif path.include? "/bass/enabled"
    set :bass_enabled, value
  elsif path.include? "/drums/delta"
    current = get(:drum_complexity) || 0.25
    set :drum_complexity, [[current + value, 0.0].max, 1.0].min
  elsif path.include? "/hats/delta"
    current = get(:drum_complexity) || 0.25
    set :drum_complexity, [[current + value, 0.0].max, 1.0].min
  end
end

live_loop :panic_router do
  use_real_time
  sync "/osc*/live_loop/panic"
  set :kick_enabled, 0
  set :snare_enabled, 0
  set :hats_enabled, 0
  set :bass_enabled, 0
end

live_loop :kick do
  if (get(:kick_enabled) || 0) > 0
    sample :bd_haus, amp: 2.0
  end
  sleep 1
end

live_loop :snare do
  sleep 1
  if (get(:snare_enabled) || 0) > 0
    sample :sn_dolf, amp: 0.9
  end
  sleep 1
end

live_loop :hats do
  c = get(:drum_complexity) || 0.25
  enabled = (get(:hats_enabled) || 0) > 0
  step = c > 0.65 ? 0.25 : 0.5
  8.times do
    if enabled
      sample :drum_cymbal_closed, amp: c > 0.65 ? 0.45 : 0.32, rate: 1.2
    end
    sleep step
  end
end

live_loop :ghost_snare do
  c = get(:drum_complexity) || 0.25
  if c > 0.5 && (get(:snare_enabled) || 0) > 0
    sleep 0.75
    sample :sn_dolf, amp: 0.25, rate: 1.2
    sleep 0.25
    sleep 0.5
    sample :sn_dolf, amp: 0.18, rate: 1.4
    sleep 0.5
  else
    sleep 2
  end
end

live_loop :bass do
  use_synth :fm
  if (get(:bass_enabled) || 0) > 0
    play :c2, release: 0.25, cutoff: 70, amp: 0.8
    sleep 0.5
    play :c2, release: 0.2, cutoff: 65, amp: 0.55
    sleep 0.5
    play :eb2, release: 0.25, cutoff: 70, amp: 0.65
    sleep 0.5
    play :bb1, release: 0.25, cutoff: 60, amp: 0.65
    sleep 0.5
  else
    sleep 2
  end
end
