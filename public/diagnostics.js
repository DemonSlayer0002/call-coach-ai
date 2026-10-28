// Deliberately allowlisted: never accept transcript, audio, device labels or errors.
const STAGES = new Set(['setup', 'mic_requested', 'mic_ready', 'speech_check', 'speech_ready', 'speech_on', 'speech_off', 'segment', 'asr_start', 'asr_end', 'jev_start', 'cue_rendered', 'stopped', 'failed']);
const STATES = new Set(['idle', 'preparing', 'customer', 'listening', 'transcribing', 'reviewing', 'feedback', 'unclear', 'ended', 'error']);
export function createDiagnostics({ clock = () => performance.now(), id = () => crypto.randomUUID() } = {}) {
  let session = id(), origin = clock(), events = [], phase = 'idle';
  function reset() { session = id(); origin = clock(); events = []; phase = 'idle'; }
  function record(stage, values = {}) {
    if (!STAGES.has(stage)) return;
    const event = { stage, at_ms: Math.max(0, Math.round(clock() - origin)) };
    for (const key of ['sequence', 'duration_ms', 'endpoint_ms', 'level', 'count']) {
      if (Number.isFinite(values[key])) event[key] = Math.round(values[key] * 100) / 100;
    }
    if (['gpu', 'local', 'browser', 'server'].includes(values.backend)) event.backend = values.backend;
    if (['permission_denied', 'device_missing', 'device_busy', 'speech_unavailable', 'capture_failed'].includes(values.code)) event.code = values.code;
    events.push(event); if (events.length > 300) events.shift();
  }
  function state(value) { if (STATES.has(value)) phase = value; }
  function snapshot() {
    const journeys = events.filter(event => event.stage === 'cue_rendered' && event.sequence != null).flatMap(cue => {
      const segment = events.find(event => event.stage === 'segment' && event.sequence === cue.sequence);
      if (!segment || !Number.isFinite(segment.endpoint_ms)) return [];
      return [{ sequence: cue.sequence, endpoint_ms: segment.endpoint_ms, segment_to_cue_ms: Math.max(0, cue.at_ms - segment.at_ms), estimated_last_voice_to_cue_ms: Math.max(0, cue.at_ms - segment.at_ms + segment.endpoint_ms) }];
    });
    return { version: 1, session_id: session, phase, clock: 'monotonic_ms_since_session_start', timing_note: 'Last-voice estimate uses worklet frame silence plus main-thread segment-to-render timing; delivery jitter and physical device latency are unmeasured.', journeys, events: events.map(event => ({ ...event })) };
  }
  return { reset, record, state, snapshot };
}

export function microphoneError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return { code: 'permission_denied', message: 'Microphone access was denied. Allow it in your browser’s site permissions, then start again.' };
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return { code: 'device_missing', message: 'The selected microphone is unavailable. Connect it or choose another input, then start again.' };
  if (error?.name === 'NotReadableError') return { code: 'device_busy', message: 'Your microphone could not be opened. Check its connection and whether another app is using it, then start again.' };
  return { code: 'capture_failed', message: error?.message || 'Microphone practice could not start.' };
}
