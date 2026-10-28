import { createOwnedCapture } from './owned-capture.js';

// Microphone-only rehearsal. The customer's voice is muted out of the mic lane.
export function createVoicePractice({ getMic, prepareSpeech, startSession, speak, onTurn, onState = () => {}, onError = () => {} }) {
  const capture = createOwnedCapture(startSession);
  let active = null;
  function emit(op, phase = op.phase) {
    op.phase = phase;
    onState({ phase, index: op.index, total: op.questions.length, replied: op.replied,
      canAdvance: op.replied && !op.hearing && !op.processing && !op.talking,
      hearing: op.hearing, spoken: op.spoken, backend: op.backend, level: op.level || 0 });
  }
  function mute(op, value) { op.stream?.getAudioTracks().forEach(track => { track.enabled = !value; }); }
  async function stop(notify = true) {
    const previous = active; active = null;
    if (previous) {
      previous.abort.abort(); previous.stream?.getTracks().forEach(track => track.stop());
      if (notify) emit(previous, 'ended');
    }
    await capture.stop();
  }
  async function ask(op, repeat = false) {
    if (active !== op) return;
    op.talking = true; op.replied = false; mute(op, true); emit(op, 'customer');
    if (!repeat) await onTurn({ speaker: 'customer', text: op.questions[op.index], at: Date.now() });
    if (active !== op) return;
    op.spoken = await speak(op.questions[op.index], op.abort.signal);
    if (active !== op) return;
    op.talking = false; mute(op, false); emit(op, 'listening');
  }
  async function start(questions) {
    // Invalidate a previous owner synchronously, before asynchronous setup.
    const cleanup = stop(false);
    const op = { questions, index: 0, replied: false, hearing: false, processing: 0, talking: true, abort: new AbortController(), stream: null, phase: 'preparing', spoken: false, voiceRevision: 0, deliveredRevision: -1, segments: new Map(), session: null };
    active = op; emit(op);
    try {
      await cleanup;
      if (active !== op) return;
      const stream = await getMic();
      if (active !== op) { stream.getTracks().forEach(track => track.stop()); return; }
      op.stream = stream; mute(op, true);
      const speech = await prepareSpeech({ signal: op.abort.signal });
      op.backend = speech?.backend;
      if (active !== op) return;
      const session = await capture.start([{ stream, speaker: 'rep', watch: true }], {
        onSegment: (_speaker, sequence) => { if (active === op && !op.talking) op.segments.set(sequence, op.voiceRevision); },
        onText: async (_speaker, text, metadata = {}) => {
          if (active !== op || op.talking) return;
          const revision = op.segments.get(metadata.sequence) ?? op.voiceRevision;
          op.processing++; emit(op, 'reviewing');
          try {
            await onTurn({ speaker: 'rep', text, at: Date.now(), speech: metadata });
            if (op.session?.settled) await op.session.settled();
          }
          finally {
            op.processing--;
            if (active === op) {
              op.deliveredRevision = Math.max(op.deliveredRevision, revision);
              op.replied = op.deliveredRevision >= op.voiceRevision;
              for (const key of op.segments.keys()) if (key <= metadata.sequence) op.segments.delete(key);
              emit(op, op.replied ? 'feedback' : 'transcribing');
            }
          }
        },
        onVoice: (_speaker, hearing) => {
          if (active !== op || op.talking) return;
          if (hearing) { op.voiceRevision++; op.replied = false; }
          op.hearing = hearing; emit(op, hearing ? 'listening' : 'transcribing');
        },
        onDrop: () => { if (active === op && !op.talking) { op.replied = false; emit(op, 'unclear'); } },
        onLevel: (_speaker, level) => { if (active === op && !op.talking) { op.level = level; emit(op); } },
        onError: message => { if (active === op) { stop(false); emit(op, 'error'); onError(message); } },
        onEnded: () => { if (active === op) stop(); },
      });
      if (active !== op) { if (session) await session.stop(); return; }
      if (!session) return;
      op.session = session;
      await ask(op);
    } catch (err) {
      if (active !== op) return;
      await stop(false); emit(op, 'error'); onError(err.message || 'Microphone practice could not start.');
    }
  }
  async function next() {
    const op = active;
    if (!op || !op.replied || op.hearing || op.processing || op.talking) return;
    if (op.index === op.questions.length - 1) { await stop(); return; }
    op.index++; await ask(op);
  }
  async function repeat() {
    const op = active;
    if (!op || op.hearing || op.processing || op.talking) return;
    await ask(op, true);
  }
  return { start, stop, next, repeat, isActive: () => active !== null };
}
