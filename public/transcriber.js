// Turns a recorded segment (16 kHz mono PCM) into text.
//
// The desktop app and self-hosted servers transcribe on the server
// (/api/transcribe). A hosted site transcribes in each visitor's browser
// instead (asr-worker.js), so their audio never leaves their computer.

export const BROWSER_MODELS = [
  { id: "onnx-community/whisper-tiny.en", label: "Tiny", size: "~40 MB", desc: "Fastest, lowest accuracy" },
  { id: "onnx-community/whisper-base.en", label: "Base", size: "~80 MB", desc: "More accurate, slower" },
];
const MODEL_KEY = "cc-browser-asr";

let where = null, checkedAt = 0;
export async function speechLocation({ refresh = false } = {}) {
  if (!where || refresh || Date.now() - checkedAt > 10000) {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok) throw new Error('Cannot check the speech configuration. Check the local server, then retry.');
    where = (await response.json()).transcribe || 'server'; checkedAt = Date.now();
  }
  return where;
}

export function browserModel() {
  let id = null;
  try { id = localStorage.getItem(MODEL_KEY); } catch {}
  return BROWSER_MODELS.some((m) => m.id === id) ? id : BROWSER_MODELS[1].id;
}
export function setBrowserModel(id) {
  try { localStorage.setItem(MODEL_KEY, id); } catch {}
}

let worker = null;
let nextId = 0;
const pending = new Map();
const progressListeners = new Set();

/** Calls fn({ pct, model, ready }) while the in-browser model downloads. Returns an unsubscribe function. */
export function onModelProgress(fn) {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

function resetWorker(message) {
  const previous = worker; worker = null;
  previous?.terminate();
  for (const p of pending.values()) p.reject(new Error(message));
  pending.clear();
}
function getWorker() {
  if (worker) return worker;
  const created = new Worker("/asr-worker.js", { type: "module" });
  worker = created;
  created.onmessage = (e) => {
    if (worker !== created) return;
    const d = e.data;
    if (d.type === "progress") { progressListeners.forEach((fn) => fn(d)); return; }
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    d.error ? p.reject(new Error(d.error)) : p.resolve({ text: d.text });
  };
  created.onerror = (e) => {
    if (worker === created) resetWorker(e.message || "Speech recognition failed to load.");
  };
  return created;
}

/** Returns { text }, or throws. `quick` asks for the fast model, for live transcripts. */
export async function transcribe(pcm, { quick = false, signal } = {}) {
  signal?.throwIfAborted();
  const place = await speechLocation();
  signal?.throwIfAborted();
  if (place === "off") throw new Error("Speech recognition is turned off on this server.");
  if (place === "browser") {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); pending.delete(id); };
      const cancel = () => { cleanup(); reject(signal.reason); };
      const timer = setTimeout(() => resetWorker("Speech recognition took too long. End practice and try again with the faster model."), 45000);
      pending.set(id, {
        resolve: value => { cleanup(); resolve(value); },
        reject: err => { cleanup(); reject(err); },
      });
      signal?.addEventListener('abort', cancel, { once: true });
      try { getWorker().postMessage({ id, pcm, model: browserModel() }, [pcm.buffer]); }
      catch (err) { cleanup(); reject(err); }
    });
  }
  const deadline = AbortSignal.timeout(50000);
  const res = await fetch(`/api/transcribe${quick ? "?quick=1" : ""}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength), signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Speech recognition returned HTTP ' + res.status + '.');
  return { text: data.text || "", speech_backend: data.speech_backend, speech_model: data.speech_model, latency_ms: data.latency_ms };
}

// Warm the model before asking someone to speak; abort stops the waiting caller.
export async function prepareSpeech({ signal } = {}) {
  signal?.throwIfAborted();
  const place = await speechLocation({ refresh: true });
  signal?.throwIfAborted();
  if (place === "off") throw new Error("Speech recognition is turned off on this server.");
  if (place === "voiceclaude") {
    const timeout = AbortSignal.timeout(50000);
    const response = await fetch("/api/speech/prepare", { method: 'POST', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    const data = await response.json();
    if (!response.ok || !data.ready) throw new Error(data.error || "VoiceClaude speech recognition is unavailable.");
    return data;
  }
  if (place !== "browser") return;
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); pending.delete(id); };
    const cancel = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => resetWorker("The speech model did not finish loading. Check your connection and try again."), 120000);
    pending.set(id, { resolve: value => { cleanup(); resolve(value); }, reject: err => { cleanup(); reject(err); } });
    signal?.addEventListener("abort", cancel, { once: true });
    try { getWorker().postMessage({ type: "load", id, model: browserModel() }); }
    catch (err) { cleanup(); reject(err); }
  });
}
