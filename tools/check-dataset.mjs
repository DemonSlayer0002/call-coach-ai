// Run on the PRIVATE host holding the dataset. Output contains aggregate data only.
import { createReadStream } from 'node:fs';
import { createDatasetAudit, DATASET_LIMITS } from '../lib/dataset.mjs';

const filename = process.argv[2];
if (process.argv.length !== 3 || !filename || filename.startsWith('-')) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'USAGE', usage: 'node tools/check-dataset.mjs PRIVATE_FILE.jsonl' }) + '\n');
  process.exitCode = 2;
} else {
  const audit = createDatasetAudit();
  // Frame lines before decoding JSON; never accumulate an unbounded malicious line.
  let chunks = [], length = 0, total = 0, stopped = false;
  try {
    const stream = createReadStream(filename, { highWaterMark: 64 * 1024 });
    for await (const chunk of stream) {
      total += chunk.length;
      if (total > DATASET_LIMITS.bytes) { audit.stopAtLimit(); stopped = true; break; }
      let start = 0;
      for (let end = chunk.indexOf(10); end !== -1; end = chunk.indexOf(10, start)) {
        const piece = chunk.subarray(start, end);
        chunks.push(piece); length += piece.length;
        if (length > DATASET_LIMITS.lineBytes) { audit.stopAtLimit('LINE_LIMIT'); stopped = true; break; }
        const line = Buffer.concat(chunks, length).toString('utf8');
        chunks = []; length = 0; start = end + 1;
        if (!audit.addLine(line)) { stopped = true; break; }
      }
      if (stopped) break;
      const tail = chunk.subarray(start); chunks.push(tail); length += tail.length;
      if (length > DATASET_LIMITS.lineBytes) { audit.stopAtLimit('LINE_LIMIT'); stopped = true; break; }
    }
    if (!stopped && length) audit.addLine(Buffer.concat(chunks, length).toString('utf8'));
    const result = audit.result();
    if (stopped) result.ok = false;
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    process.stdout.write(JSON.stringify({ ok: false, error: 'DATASET_READ_FAILED', structure_only: true, quality_verified: false }) + '\n');
    process.exitCode = 2;
  }
}
