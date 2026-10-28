// One deadline covers network I/O, response bodies, and retry delays.
import { setTimeout as sleep } from "node:timers/promises";

export class JevError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

const probability = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

export function validateAnswers(data, questions) {
  if (!data || typeof data.model !== "string" || !data.answers) throw new JevError("TypeSafe returned an incomplete response. Try again.");
  for (const [id, q] of Object.entries(questions)) {
    const a = data.answers[id];
    let valid = a?.type === q.type;
    if (q.type === "noul") valid &&= probability(a.noul);
    else {
      const keys = q.type === "choice" ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
      const p = a?.probabilities;
      valid &&= probability(a?.confidence) && !!p && keys.every((k) => Object.hasOwn(p, k) && probability(p[k]));
      valid &&= Object.keys(p).length === keys.length && Math.abs(Object.values(p).reduce((s, v) => s + v, 0) - 1) <= 0.05;
      if (q.type === "choice") valid &&= keys.includes(a?.choice);
      else valid &&= Number.isFinite(a?.score) && a.score >= 0 && a.score <= keys.length - 1;
    }
    if (!valid) throw new JevError("TypeSafe returned invalid coaching data. Try again.");
  }
  return data;
}

export function createJevClient({ endpoint, model, timeoutMs = 6000, maxRetries = 2, fetchImpl = fetch, random = Math.random }) {
  return async function ask(turns, mode, key, signal) {
    const deadline = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const started = performance.now();
    const body = JSON.stringify({ model, state: { [mode.transcript.key]: turns }, questions: mode.schema });
    try {
      for (let attempt = 0; ; attempt++) {
        combined.throwIfAborted();
        const res = await fetchImpl(endpoint, {
          method: "POST", signal: combined,
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body,
        });
        if ([429, 503, 529].includes(res.status) && attempt < maxRetries) {
          const retry = res.headers.get("retry-after");
          const seconds = retry == null ? NaN : Number(retry);
          const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now();
          const delay = Math.max(0, Number.isFinite(requested) ? requested : 250 * 2 ** attempt + random() * 100);
          await res.body?.cancel();
          // Do not retry sooner than the provider asked, or hold a live call indefinitely.
          if (delay + 100 >= timeoutMs - (performance.now() - started)) {
            return { status: res.status, data: {}, attempts: attempt + 1 };
          }
          await sleep(delay, undefined, { signal: combined });
          continue;
        }
        if (res.status !== 200) {
          await res.body?.cancel();
          return { status: res.status, data: {}, attempts: attempt + 1 };
        }
        let data;
        try { data = await res.json(); }
        catch (err) {
          if (combined.aborted) throw err;
          throw new JevError("TypeSafe returned an unreadable response. Try again.");
        }
        combined.throwIfAborted();
        return { status: 200, data: validateAnswers(data, mode.schema), attempts: attempt + 1 };
      }
    } catch (err) {
      if (signal?.aborted) throw new JevError("Coaching request cancelled.", 499);
      if (deadline.aborted) throw new JevError("Coaching took too long. Keep talking and try again.", 504);
      if (err instanceof JevError) throw err;
      throw new JevError("Cannot reach TypeSafe. Check your connection and try again.");
    }
  };
}
