// Prefer an installed browser voice; bundled synthetic clips cover missing voices.
export function createBrowserSpeaker({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, AudioCtor = globalThis.Audio, fallbackFor = () => null } = {}) {
  async function fallback(text, signal) {
    const url = fallbackFor(text);
    if (!url || !AudioCtor || signal?.aborted) return false;
    return new Promise(resolve => {
      const audio = new AudioCtor(url); let complete = false;
      const finish = result => {
        if (complete) return; complete = true;
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
        audio.pause(); audio.removeAttribute('src'); audio.load(); resolve(result);
      };
      const abort = () => finish(false);
      const timer = setTimeout(() => finish(false), Math.max(12000, text.length * 100));
      audio.onended = () => finish(true); audio.onerror = () => finish(false);
      signal?.addEventListener('abort', abort, { once: true });
      audio.play().catch(() => finish(false));
    });
  }
  return async function speak(text, signal) {
    if (signal?.aborted) return false;
    const voices = synth?.getVoices?.() || [];
    if (!synth || !Utterance || !voices.length) return fallback(text, signal);
    const spoken = await new Promise(resolve => {
      const utterance = new Utterance(text);
      utterance.lang = 'en-US'; utterance.rate = .97;
      const voice = voices.find(v => v.lang === 'en-US');
      if (voice) utterance.voice = voice;
      let complete = false;
      const finish = result => {
        if (complete) return; complete = true;
        clearTimeout(timer); signal?.removeEventListener('abort', abort); resolve(result);
      };
      const abort = () => { finish(false); synth.cancel(); };
      const timer = setTimeout(() => { finish(false); synth.cancel(); }, Math.max(12000, text.length * 100));
      utterance.onend = () => finish(true); utterance.onerror = () => finish(false);
      signal?.addEventListener('abort', abort, { once: true });
      try { synth.cancel(); synth.speak(utterance); } catch { finish(false); }
    });
    return spoken || fallback(text, signal);
  };
}
