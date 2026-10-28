// New speech invalidates old advice even if a fetch implementation ignores abort.
export function createLatestRequest({ fetchImpl = fetch, headers = () => ({}), onBusy = () => {}, timeoutMs = 7500 } = {}) {
  let active = null;
  function invalidate() {
    if (!active) return;
    const old = active;
    active = null;
    old.abort();
    onBusy(false);
  }
  async function run(body) {
    invalidate();
    const controller = new AbortController();
    active = controller;
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([controller.signal, deadline]);
    onBusy(true);
    try {
      const res = await fetchImpl("/api/evaluate", {
        method: "POST", signal,
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (active !== controller) return null;
      signal.throwIfAborted();
      if (!res.ok) throw new Error(data.error || `The server returned status ${res.status}.`);
      return data;
    } catch (err) {
      if (active !== controller) return null;
      if (deadline.aborted) throw new Error("Coaching took too long. Keep talking and try again.");
      throw err;
    } finally {
      if (active === controller) { active = null; onBusy(false); }
    }
  }
  return { run, invalidate };
}
