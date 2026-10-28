// Synthetic fixture only. Nothing from a microphone is retained for warmup.
export function wavToFloat(wav) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid warmup WAV.');
  let audio, format;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const size = wav.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > wav.length) throw new Error('Truncated warmup WAV.');
    const name = wav.toString('ascii', offset, offset + 4);
    if (name === 'fmt ') format = wav.subarray(start, start + size);
    if (name === 'data') audio = wav.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!format || format.length < 16 || format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 || format.readUInt32LE(4) !== 16000 || format.readUInt16LE(14) !== 16 || !audio?.length || audio.length % 2) throw new Error('Warmup requires 16 kHz mono PCM16.');
  const pcm = Buffer.alloc(audio.length * 2);
  for (let i = 0; i < audio.length / 2; i++) pcm.writeFloatLE(audio.readInt16LE(i * 2) / 32768, i * 4);
  return pcm;
}

export function createSpeechReadiness({ client, loadFixture, now = Date.now, ttlMs = 60000 }) {
  let completed = null, pending = null;
  async function prepare() {
    const health = await client.status();
    if (!health.ready) throw Object.assign(new Error('Speech service is unavailable. Check VoiceClaude, then retry.'), { status: 503 });
    if (completed && now() - completed.checked_at < ttlMs && health.backend === completed.backend && health.model === completed.model) return { ...completed, cached: true, busy: health.busy || false };
    if (pending) return pending;
    // Respect native single-flight admission; a busy health response is not warm proof.
    if (health.busy) return { ready: true, warmed: false, busy: true, backend: health.backend, model: health.model };
    pending = (async () => {
      const result = await client.transcribe(wavToFloat(await loadFixture()));
      if (!result.text?.trim()) throw Object.assign(new Error('Speech responded without recognizing the test phrase. Retry the speech check.'), { status: 503 });
      completed = { ready: true, warmed: true, backend: result.speech_backend, model: result.speech_model, checked_at: now(), latency_ms: result.latency_ms };
      return { ...completed, cached: false };
    })();
    try { return await pending; } finally { pending = null; }
  }
  return { prepare };
}
