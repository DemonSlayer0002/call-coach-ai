// Executes the shipped AudioWorklet DSP against audio without a browser/device.
// This checks segmentation only: it does not establish ASR or acoustic quality.
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { wavToFloat } from '../lib/speech-readiness.mjs';
const source = await readFile(new URL('../public/segmenter.worklet.js', import.meta.url), 'utf8');
export function replay(samples, { tailMs = 900 } = {}) {
  const messages = []; let Processor;
  const context = vm.createContext({ Float32Array, Uint8Array, Math,
    AudioWorkletProcessor: class { port = { postMessage: message => messages.push(message) }; },
    registerProcessor: (_name, constructor) => { Processor = constructor; },
  });
  vm.runInContext(source, context);
  const processor = new Processor({ numberOfInputs: 1, processorOptions: { watch: [0] } });
  const audio = new Float32Array(samples.length + Math.ceil(tailMs * 16)); audio.set(samples);
  for (let i = 0; i < audio.length; i += 128) processor.process([[audio.subarray(i, i + 128)]]);
  return messages;
}
export function readSamples(wav) {
  const bytes = wavToFloat(wav);
  return Float32Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readFloatLE(i * 4));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const filename of process.argv.slice(2)) {
    const samples = readSamples(await readFile(filename)); const messages = replay(samples);
    const segments = messages.filter(event => event.type === 'segment');
    console.log(JSON.stringify({ fixture: filename.split('/').at(-1), input_ms: Math.round(samples.length / 16), segments: segments.length, retained_ms: segments.reduce((sum, event) => sum + (event.pcm?.length || 0) / 16, 0) }));
  }
}
