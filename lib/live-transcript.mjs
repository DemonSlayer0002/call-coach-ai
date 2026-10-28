// Authenticated, role-separated transcript input. No audio capture or provider calls.
import { timingSafeEqual } from 'node:crypto';
import { isSpeechLoop, redactContactDetails } from './transcript.mjs';

export class LiveInputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new LiveInputError(message, status); };
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
export function authorizeLiveIngest(header, token) {
  if (!token) fail('Live transcript ingestion is not configured.', 503);
  const got = Buffer.from(header('authorization') || ''), expected = Buffer.from('Bearer ' + token);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) fail('Unauthorized transcript producer.', 401);
  if (header('x-amd-intent') !== 'live-stt-ingest-v1') fail('Unsupported transcript protocol.');
}

export function createLiveTranscriptStore({ now = Date.now, maxSessions = 24, maxSegments = 80, ttlMs = 30 * 60 * 1000 } = {}) {
  let sessions = new Map();
  function prune() {
    const cutoff = now() - ttlMs;
    for (const [key, s] of sessions) if (s.updated_at < cutoff) sessions.delete(key);
  }
  function ingest(body) {
    prune();
    if (!Array.isArray(body?.events) || !body.events.length || body.events.length > 64) fail('Send between 1 and 64 transcript events.');
    // Copies make each batch atomic; rejected batches cannot leave partial sessions.
    const draft = new Map(sessions), copied = new Set();
    for (const e of body.events) {
      if (!e || !id(e.session_id) || !(typeof e.call_id === 'string' && e.call_id.length > 0 && e.call_id.length <= 160) || !Number.isFinite(e.at) || e.at < 0) fail('Invalid transcript session identity or timestamp.');
      let s = draft.get(e.session_id);
      if (s && !copied.has(e.session_id)) { s = structuredClone(s); draft.set(e.session_id, s); copied.add(e.session_id); }
      if (e.kind === 'session_start') {
        for (const key of ['amd_call_id', 'staff_account', 'customer_endpoint']) {
          if (e[key] != null && (typeof e[key] !== 'string' || e[key].length > 200)) fail('Invalid transcript session metadata.');
        }
        const binding = JSON.stringify([e.call_id, e.amd_call_id || '', e.staff_account || '', e.customer_endpoint || '']);
        if (s) { if (s.binding !== binding) fail('Session identity conflicts with its original call.', 409); continue; }
        if (draft.size >= maxSessions) fail('Too many live transcript sessions.', 429);
        s = { session_id: e.session_id, call_id: e.call_id, binding, started_at: e.at, updated_at: now(), ended: false, incomplete: false,
          revision: 0, last_seq: { customer: 0, staff: 0 }, sequence_gaps: 0, segments: [], truncated: false, source: 'amd-live-stt' };
        draft.set(e.session_id, s); copied.add(e.session_id); continue;
      }
      if (!s || s.call_id !== e.call_id) fail('Start the exact transcript session before sending events.', 409);
      if (e.kind === 'segment') {
        if (!['customer', 'staff'].includes(e.speaker) || !Number.isSafeInteger(e.seq) || e.seq < 1 || typeof e.final !== 'boolean' || typeof e.text !== 'string' || e.text.length > 1500) fail('Invalid role-tagged transcript segment.');
        if (e.confidence != null && (!Number.isFinite(e.confidence) || e.confidence < 0 || e.confidence > 1)) fail('Invalid speech confidence.');
        if (!Number.isSafeInteger(e.audio_ms) || e.audio_ms < 0) fail('Invalid audio duration.');
        // Interims revise previous words; they are never appended as final turns.
        if (!e.final) continue;
        const text = redactContactDetails(e.text.trim());
        const prior = s.segments.find(v => v.speaker === e.speaker && v.seq === e.seq);
        if (prior) { if (prior.text !== text) fail('Conflicting final transcript segment.', 409); continue; }
        if (e.seq <= s.last_seq[e.speaker]) continue;
        if (s.ended) fail('Transcript session has ended.', 409);
        if (!text || isSpeechLoop(text)) fail('Speech recognition produced empty or repeating text.', 422);
        s.sequence_gaps += Math.max(0, e.seq - s.last_seq[e.speaker] - 1);
        s.last_seq[e.speaker] = e.seq;
        s.segments.push({ speaker: e.speaker, seq: e.seq, text, at: e.at, audio_ms: e.audio_ms, confidence: e.confidence ?? null });
        if (s.segments.length > maxSegments) { s.segments.shift(); s.truncated = true; }
        s.revision++;
      } else if (e.kind === 'session_end') {
        if (typeof e.incomplete !== 'boolean') fail('Session end must report whether coverage is incomplete.');
        if (!s.ended) { s.ended = true; s.incomplete = e.incomplete || s.sequence_gaps > 0; s.revision++; }
      } else fail('Unknown transcript event kind.');
      s.updated_at = now();
    }
    sessions = draft;
    return { ok: true };
  }
  function view(s, detail = false) {
    const v = { session_id: s.session_id, call_id: s.call_id, started_at: s.started_at, ended: s.ended, incomplete: s.incomplete || s.sequence_gaps > 0,
      revision: s.revision, sequence_gaps: s.sequence_gaps, truncated: s.truncated, source: s.source };
    if (detail) v.segments = s.segments.map(segment => ({ ...segment }));
    return v;
  }
  return {
    ingest,
    list() { prune(); return [...sessions.values()].map(s => view(s)); },
    get(sessionId) { prune(); const s = sessions.get(sessionId); return s ? view(s, true) : null; },
  };
}
