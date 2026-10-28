// Ownership survives async worklet startup and delayed transcription after stop().
export function createOwnedCapture(startSession) {
  let active = null;
  async function stop() {
    const previous = active;
    active = null;
    if (previous?.session) await previous.session.stop();
  }
  async function start(sources, handlers) {
    const previous = active;
    const operation = {};
    active = operation;
    if (previous?.session) await previous.session.stop();
    if (active !== operation) return null;
    const guarded = Object.fromEntries(Object.entries(handlers).map(([name, callback]) => [name, (...args) => {
      if (active === operation) return callback(...args);
    }]));
    try {
      const session = await startSession(sources, guarded);
      if (active !== operation) { await session.stop(); return null; }
      operation.session = session;
      return session;
    } catch (err) {
      if (active !== operation) return null;
      active = null;
      throw err;
    }
  }
  return { start, stop };
}
