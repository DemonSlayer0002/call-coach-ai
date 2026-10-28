// Follow committed text from one explicitly selected local session.
export function createLiveCallFollower({ fetchImpl = fetch, onUpdate, onError = () => {}, intervalMs = 1000 }) {
  let generation = 0, timer = null, controller = null;
  function stop() { generation++; clearTimeout(timer); controller?.abort(); controller = null; }
  function start(sessionId) {
    stop(); const version = generation; let revision = -1;
    async function poll() {
      controller = new AbortController();
      try {
        const response = await fetchImpl('/api/live/sessions/' + encodeURIComponent(sessionId), {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        const data = await response.json();
        if (version !== generation) return;
        if (!response.ok) throw new Error(data.error || 'Live transcript is unavailable.');
        if (data.revision !== revision) { revision = data.revision; onUpdate(data); }
        if (!data.ended) timer = setTimeout(poll, intervalMs);
      } catch (err) {
        if (version === generation) { stop(); onError(err.message || 'Live transcript disconnected.'); }
      }
    }
    poll();
  }
  return { start, stop };
}
