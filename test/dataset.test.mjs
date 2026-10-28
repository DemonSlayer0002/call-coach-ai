import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditDatasetJsonl, createDatasetAudit, validDatasetDate } from '../lib/dataset.mjs';

function example(overrides = {}) {
  return {
    schema_version: 1, id: 'example-1', provenance: 'real', call_id: 'call-1', thread_id: 'thread-1', split: 'train',
    source: { artifact_sha256: 'a'.repeat(64), transcript_version: 'human-correction-v1', role_provenance: 'human_verified', permitted_use: 'private_evaluation' },
    prefix: { as_of: '2026-10-01T10:00:03Z', cutoff_turn_id: 'turn-2', turns: [
      { id: 'turn-1', order: 1, speaker: 'staff', text: 'What matters most?', at: '2026-10-01T10:00:00Z' },
      { id: 'turn-2', order: 2, speaker: 'customer', text: 'The total price must stay under my budget.', at: '2026-10-01T10:00:02Z' },
    ] },
    labels: [{ criterion: 'budget', status: 'observed', evidence: [{ turn_id: 'turn-2', quote: 'total price must stay under my budget' }] }],
    review: { status: 'gold', reviewer: { id: 'reviewer-1', kind: 'human', independent: true, blinded: true }, reviewed_at: '2026-10-02T10:00:00Z' },
    ...overrides,
  };
}
const audit = (...rows) => auditDatasetJsonl(rows.map(row => JSON.stringify(row)).join('\n') + '\n');
const rejects = (row, code) => { const r = audit(row); assert.equal(r.ok, false); assert.equal(r.reasons[code], 1); return r; };

test('keeps real/synthetic and gold/draft denominators separate', () => {
  const synthetic = example({ id: 'example-2', provenance: 'synthetic', call_id: 'call-2', thread_id: 'thread-2', split: 'holdout' });
  synthetic.source.role_provenance = 'synthetic';
  synthetic.review = { status: 'draft', reviewer: { id: 'generator-1', kind: 'ai', independent: false, blinded: false }, reviewed_at: '2026-10-02T10:00:00Z' };
  const r = audit(example(), synthetic);
  assert.equal(r.ok, true); assert.equal(r.complete, true); assert.equal(r.valid, 2);
  assert.equal(r.provenance.real.gold, 1); assert.equal(r.provenance.synthetic.gold, 0);
  assert.equal(r.provenance.synthetic.draft, 1); assert.equal(r.provenance.synthetic.splits.holdout, 1);
  assert.equal(r.quality_verified, false);
});

test('real gold requires an independent blinded human; AI is never gold', () => {
  for (const flag of ['independent', 'blinded']) { const row = example(); row.review.reviewer[flag] = false; rejects(row, 'REAL_GOLD_NOT_INDEPENDENT_BLINDED'); }
  for (const provenance of ['real', 'synthetic']) {
    const row = example({ provenance }); row.source.role_provenance = provenance === 'real' ? 'human_verified' : 'synthetic'; row.review.reviewer.kind = 'ai';
    rejects(row, 'AI_NOT_GOLD');
  }
});

test('rejects thread/call leakage and duplicate IDs/prefixes even after an invalid row', () => {
  const first = example(); first.review.reviewer.blinded = false;
  const second = example({ id: 'other-id', split: 'holdout' });
  const r = audit(first, second);
  assert.equal(r.reasons.THREAD_SPLIT_OVERLAP, 1); assert.equal(r.reasons.CALL_SPLIT_OVERLAP, 1); assert.equal(r.reasons.DUPLICATE_PREFIX, 1);
  const duplicate = example(); duplicate.prefix.turns[0].text += ' Different prefix.';
  assert.equal(audit(example(), duplicate).reasons.DUPLICATE_ID, 1);
  const third = example({ id: 'third', split: 'dev', call_id: 'other-call' });
  assert.equal(audit(example(), third).reasons.THREAD_SPLIT_OVERLAP, 1);
});

test('rejects future/missing evidence and altered or empty quotations', () => {
  const future = example(); future.labels[0].evidence[0].turn_id = 'future-turn'; rejects(future, 'EVIDENCE_OUTSIDE_PREFIX');
  for (const quote of ['the total price must stay under my budget', 'not in the source', '']) {
    const row = example(); row.labels[0].evidence[0].quote = quote; rejects(row, 'EVIDENCE_QUOTE');
  }
  const row = example(); row.prefix.turns[1].at = '2026-10-01T10:00:04Z'; rejects(row, 'FUTURE_TURN');
});

test('all opportunity states require source context, without pretending absence is failure', () => {
  for (const status of ['observed', 'opportunity_without_behavior', 'not_applicable', 'insufficient_evidence']) {
    const row = example(); row.labels[0].status = status; assert.equal(audit(row).ok, true);
    row.labels[0].evidence = []; rejects(row, 'LABEL_EVIDENCE');
  }
  const row = example(); row.labels[0].status = 'missed'; rejects(row, 'LABEL_STATUS');
});

test('requires unique ordered role-tagged prefix turns and exact cutoff', () => {
  const duplicate = example(); duplicate.prefix.turns[1].id = 'turn-1'; duplicate.prefix.cutoff_turn_id = 'turn-1'; rejects(duplicate, 'TURN_ID');
  const order = example(); order.prefix.turns[1].order = 3; rejects(order, 'TURN_ORDER');
  const role = example(); role.prefix.turns[1].speaker = 'unknown'; rejects(role, 'TURN_ROLE');
  const reversed = example(); reversed.prefix.turns[1].at = '2026-10-01T09:00:00Z'; rejects(reversed, 'TURN_TIME_ORDER');
  const cutoff = example(); cutoff.prefix.cutoff_turn_id = 'turn-1'; rejects(cutoff, 'PREFIX_CUTOFF');
});

test('rejects malformed dates rather than Date.parse normalization', () => {
  for (const date of ['2026-02-30T10:00:00Z', '2026-02-29T10:00:00Z', '2026-10-01', '2026-10-01T25:00:00Z', '2026-10-01T10:00:00', 'private-date']) assert.equal(validDatasetDate(date), false);
  assert.equal(validDatasetDate('2024-02-29T10:00:00.123Z'), true);
  const row = example(); row.review.reviewed_at = '2026-02-30T10:00:00Z'; rejects(row, 'REVIEW_DATE');
  row.review.reviewed_at = '2026-09-01T10:00:00Z'; rejects(row, 'REVIEW_BEFORE_PREFIX');
});

test('rejects missing source rights, role provenance and misleading schema', () => {
  const row = example(); delete row.source.artifact_sha256; rejects(row, 'SOURCE_PROVENANCE');
  row.source.artifact_sha256 = 'a'.repeat(64); row.source.role_provenance = 'channel_A_assumed_staff'; rejects(row, 'ROLE_PROVENANCE');
  row.source.role_provenance = 'human_verified'; row.source.permitted_use = 'public_training'; rejects(row, 'SOURCE_PROVENANCE');
  rejects(example({ schema_version: 2 }), 'SCHEMA_VERSION');
});

test('bounded parsing reports malformed input without retaining or emitting it', () => {
  assert.equal(auditDatasetJsonl('').reasons.EMPTY_DATASET, 1);
  assert.equal(auditDatasetJsonl('\n').reasons.INVALID_JSON, 1);
  assert.equal(auditDatasetJsonl('null').reasons.EXAMPLE_NOT_OBJECT, 1);
  const hostile = example({ provenance: { toString: null }, call_id: { toString: null } });
  hostile.source.artifact_sha256 = { toString: null };
  hostile.prefix.turns[0].text = { toString: null };
  assert.doesNotThrow(() => audit(hostile)); assert.equal(audit(hostile).ok, false);
  const limited = createDatasetAudit({ examples: 1 }); limited.addLine(JSON.stringify(example())); assert.equal(limited.addLine(JSON.stringify(example())), false);
  assert.equal(limited.result().limits_reached, true); assert.equal(limited.result().complete, false);
  const oversized = auditDatasetJsonl('private text'.repeat(100), { bytes: 20 }); assert.equal(oversized.reasons.DATASET_LIMIT, 1);
  const r = audit(example({ id: 'PRIVATE_ID_MARKER' })); const output = JSON.stringify(r);
  for (const secret of ['PRIVATE_ID_MARKER', 'What matters most', 'reviewer-1', 'thread-1', 'total price']) assert.equal(output.includes(secret), false);
  assert.throws(() => createDatasetAudit({ examples: 10001 }), /Invalid/);
});

test('CLI streams private JSONL, returns only aggregates, and refuses oversized records', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'prefix-audit-'));
  try {
    const file = path.join(dir, 'PRIVATE_PATH_MARKER.jsonl');
    const row = example({ id: 'PRIVATE_ID_MARKER' });
    // Exercise UTF-8 and a record crossing stream chunk boundaries.
    row.prefix.turns[0].text = 'é'.repeat(7000);
    for (let n = 3; n <= 8; n++) row.prefix.turns.push({ id: 'turn-' + n, order: n, speaker: 'staff', text: 'é'.repeat(7000), at: '2026-10-01T10:00:02Z' });
    row.prefix.cutoff_turn_id = 'turn-8';
    await writeFile(file, JSON.stringify(row) + '\n');
    const cli = new URL('../tools/check-dataset.mjs', import.meta.url);
    let run = spawnSync(process.execPath, [cli.pathname, file], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout); assert.equal(JSON.parse(run.stdout).valid, 1); assert.equal(run.stderr, '');
    assert.equal(run.stdout.includes('PRIVATE_'), false);
    await writeFile(file, 'x'.repeat(300000));
    run = spawnSync(process.execPath, [cli.pathname, file], { encoding: 'utf8' });
    assert.equal(run.status, 1); assert.equal(JSON.parse(run.stdout).reasons.LINE_LIMIT, 1); assert.equal(JSON.parse(run.stdout).complete, false);
    run = spawnSync(process.execPath, [cli.pathname, path.join(dir, 'PRIVATE_MISSING')], { encoding: 'utf8' });
    assert.equal(run.status, 2); assert.equal(run.stdout.includes('PRIVATE_'), false); assert.equal(run.stderr, '');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
