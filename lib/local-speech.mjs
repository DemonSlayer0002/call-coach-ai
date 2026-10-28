// Adapter to an already-running local VoiceClaude whisper.cpp server.
// Audio stays in memory; this adapter does not change or restart that service.
export function pcmFloatToWav(input) {
  if (!input.length || input.length % 4) throw Object.assign(new Error('Expected 16 kHz mono float32 audio.'), { status: 400 });
  const samples = input.length / 4;
  if (samples > 16000 * 30) throw Object.assign(new Error('Audio segment exceeds 30 seconds.'), { status: 413 });
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const value = input.readFloatLE(i * 4);
    if (!Number.isFinite(value)) throw Object.assign(new Error('Audio contains invalid samples.'), { status: 400 });
    const clipped = Math.max(-1, Math.min(1, value));
    wav.writeInt16LE(Math.round(clipped * (clipped < 0 ? 32768 : 32767)), 44 + i * 2);
  }
  return wav;
}

export function createLocalSpeechClient({ url = 'http://127.0.0.1:8910', gpuUrl = '', fetchImpl = fetch, timeoutMs = 45000, gpuTimeoutMs = 6000, now = Date.now } = {}) {
  function loopback(value) {
    const endpoint = new URL(value);
    if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.username || endpoint.password) {
      throw new Error('VoiceClaude must use an HTTP loopback URL.');
    }
    return endpoint;
  }
  const endpoint = loopback(url), gpu = gpuUrl ? loopback(gpuUrl) : null;
  let cooldownUntil = 0;
  const route = (base, path) => new URL(path, base).href;
  async function status() {
    if (gpu && now() >= cooldownUntil) {
      try {
        const r = await fetchImpl(route(gpu, '/health'), { signal: AbortSignal.timeout(1500) });
        const data = await r.json();
        if (r.ok && data.ready) return { ready: true, backend: 'gpu', busy: Boolean(data.busy), model: data.model || 'large-v3-turbo' };
      } catch {}
    }
    try {
      const response = await fetchImpl(route(endpoint, '/health'), { signal: AbortSignal.timeout(2500) });
      const data = await response.json();
      return { ready: response.ok && data.status === 'ok', backend: 'local', model: 'large-v3-turbo', gpu_retry_after_ms: Math.max(0, cooldownUntil - now()) };
    } catch { return { ready: false, backend: 'local', model: 'large-v3-turbo' }; }
  }
  async function health() { return (await status()).ready; }
  async function transcribe(pcm, signal) {
    const wav = pcmFloatToWav(pcm);
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const started = performance.now();
    let fallbackReason = null;
    try {
      if (gpu && now() >= cooldownUntil) {
        const gpuDeadline = AbortSignal.timeout(gpuTimeoutMs);
        try {
          const response = await fetchImpl(route(gpu, '/transcribe'), {
            method: 'POST', body: wav.subarray(44),
            headers: { 'Content-Type': 'application/octet-stream' },
            signal: AbortSignal.any([combined, gpuDeadline]),
          });
          if (!response.ok) {
            await response.body?.cancel();
            fallbackReason = response.status === 429 ? 'gpu_busy' : 'gpu_unavailable';
            cooldownUntil = now() + (response.status === 429 ? 2000 : 30000);
          } else {
            const data = await response.json();
            if (typeof data.text !== 'string') throw new Error('Invalid GPU transcript');
            return { text: data.text.trim(), speech_provider: 'voiceclaude', speech_backend: 'gpu', speech_model: data.model || 'large-v3-turbo',
              inference_ms: data.transcribe_ms, latency_ms: Math.round(performance.now() - started) };
          }
        } catch (err) {
          combined.throwIfAborted();
          fallbackReason = gpuDeadline.aborted ? 'gpu_timeout' : 'gpu_unavailable';
          cooldownUntil = now() + 30000;
        }
      } else if (gpu) fallbackReason = 'gpu_cooldown';
      const form = new FormData();
      form.set('file', new Blob([wav], { type: 'audio/wav' }), 'capture.wav');
      form.set('response_format', 'json'); form.set('temperature', '0.0'); form.set('language', 'en');
      const response = await fetchImpl(route(endpoint, '/inference'), { method: 'POST', body: form, signal: combined });
      if (!response.ok) throw new Error('VoiceClaude transcription returned HTTP ' + response.status + '.');
      const data = await response.json();
      if (typeof data.text !== 'string') throw new Error('VoiceClaude returned an unreadable transcript.');
      return { text: data.text.trim(), speech_provider: 'voiceclaude', speech_backend: 'local', speech_model: 'large-v3-turbo',
        fallback_reason: fallbackReason, latency_ms: Math.round(performance.now() - started) };
    } catch (err) {
      if (signal?.aborted) throw Object.assign(new Error('Speech request cancelled.'), { status: 499 });
      if (timeout.aborted) throw Object.assign(new Error('VoiceClaude took too long. End practice and retry.'), { status: 504 });
      throw Object.assign(new Error(err.message?.startsWith('VoiceClaude') ? err.message : 'Cannot reach the local VoiceClaude speech service. Check that it is running.'), { status: 502 });
    }
  }
  return { health, status, transcribe };
}
