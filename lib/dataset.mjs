// Private dataset structure audit. Never return input IDs, quotes, text, or paths.
import { createHash } from 'node:crypto';

export const DATASET_LIMITS = Object.freeze({ bytes: 32 * 1024 * 1024, lineBytes: 256 * 1024, examples: 10000, turns: 1000, labels: 32, quoteChars: 4000, textChars: 8000 });
const statuses = new Set(['observed', 'opportunity_without_behavior', 'not_applicable', 'insufficient_evidence']);
const splits = ['train', 'dev', 'holdout'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Accept canonical UTC instants only; Date.parse alone silently normalizes Feb 30.
export function validDatasetDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z'));
}

function validate(example, limits) {
  const reasons = new Set();
  const fail = code => reasons.add(code);
  if (!object(example)) return ['EXAMPLE_NOT_OBJECT'];
  if (example.schema_version !== 1) fail('SCHEMA_VERSION');
  if (![example.id, example.call_id, example.thread_id].every(identifier)) fail('IDENTIFIER');
  if (!['real', 'synthetic'].includes(example.provenance)) fail('PROVENANCE');
  if (!splits.includes(example.split)) fail('SPLIT');
  const source = example.source;
  if (!object(source) || typeof source.artifact_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.artifact_sha256) || !identifier(source.transcript_version) || source.permitted_use !== 'private_evaluation') fail('SOURCE_PROVENANCE');
  if (example.provenance === 'real' && !['trusted_audio_lanes', 'human_verified'].includes(source?.role_provenance)) fail('ROLE_PROVENANCE');
  if (example.provenance === 'synthetic' && source?.role_provenance !== 'synthetic') fail('ROLE_PROVENANCE');

  const prefix = example.prefix;
  if (!object(prefix) || !validDatasetDate(prefix.as_of)) fail('PREFIX_DATE');
  const turns = prefix?.turns;
  const byId = new Map();
  if (!Array.isArray(turns) || !turns.length || turns.length > limits.turns) fail('PREFIX_TURNS');
  else {
    let previous = -Infinity;
    for (const [index, turn] of turns.entries()) {
      if (!object(turn)) { fail('TURN_SHAPE'); continue; }
      if (!identifier(turn.id) || byId.has(turn.id)) fail('TURN_ID');
      else byId.set(turn.id, turn);
      if (turn.order !== index + 1) fail('TURN_ORDER');
      if (!['staff', 'customer'].includes(turn.speaker)) fail('TURN_ROLE');
      if (!text(turn.text, limits.textChars)) fail('TURN_TEXT');
      if (!validDatasetDate(turn.at)) { fail('TURN_DATE'); continue; }
      const at = Date.parse(turn.at);
      if (at < previous) fail('TURN_TIME_ORDER');
      if (validDatasetDate(prefix.as_of) && at > Date.parse(prefix.as_of)) fail('FUTURE_TURN');
      previous = at;
    }
  }
  if (!identifier(prefix?.cutoff_turn_id) || !Array.isArray(turns) || prefix.cutoff_turn_id !== turns.at(-1)?.id) fail('PREFIX_CUTOFF');

  const labels = example.labels;
  if (!Array.isArray(labels) || !labels.length || labels.length > limits.labels) fail('LABELS');
  else {
    const criteria = new Set();
    for (const label of labels) {
      if (!object(label) || !identifier(label.criterion) || criteria.has(label.criterion)) { fail('LABEL_CRITERION'); continue; }
      criteria.add(label.criterion);
      if (!statuses.has(label.status)) fail('LABEL_STATUS');
      if (!Array.isArray(label.evidence) || !label.evidence.length || label.evidence.length > 16) { fail('LABEL_EVIDENCE'); continue; }
      for (const evidence of label.evidence) {
        if (!object(evidence) || !identifier(evidence.turn_id)) { fail('EVIDENCE_SHAPE'); continue; }
        const turn = byId.get(evidence.turn_id);
        if (!turn) { fail('EVIDENCE_OUTSIDE_PREFIX'); continue; }
        if (!text(evidence.quote, limits.quoteChars) || typeof turn.text !== 'string' || !turn.text.includes(evidence.quote)) fail('EVIDENCE_QUOTE');
      }
    }
  }

  const review = example.review;
  const reviewer = review?.reviewer;
  if (!object(review) || !['draft', 'gold'].includes(review.status) || !object(reviewer) || !identifier(reviewer.id) || !['human', 'ai'].includes(reviewer.kind) || typeof reviewer.independent !== 'boolean' || typeof reviewer.blinded !== 'boolean') fail('REVIEW');
  if (!validDatasetDate(review?.reviewed_at)) fail('REVIEW_DATE');
  else if (validDatasetDate(prefix?.as_of) && Date.parse(review.reviewed_at) < Date.parse(prefix.as_of)) fail('REVIEW_BEFORE_PREFIX');
  if (review?.status === 'gold' && reviewer?.kind !== 'human') fail('AI_NOT_GOLD');
  if (example.provenance === 'real' && review?.status === 'gold' && (reviewer?.kind !== 'human' || reviewer.independent !== true || reviewer.blinded !== true)) fail('REAL_GOLD_NOT_INDEPENDENT_BLINDED');
  return [...reasons];
}

export function createDatasetAudit(options = {}) {
  const limits = { ...DATASET_LIMITS, ...options };
  for (const [key, value] of Object.entries(limits)) if (!Object.hasOwn(DATASET_LIMITS, key) || !Number.isSafeInteger(value) || value < 1 || value > DATASET_LIMITS[key]) throw new Error('Invalid dataset audit limit.');
  const ids = new Set(), examples = new Set(), threads = new Map(), calls = new Map();
  const summary = {
    schema: 'private-prefix-audit-v1', ok: true, total: 0, valid: 0, invalid: 0, bytes: 0,
    reasons: {}, provenance: Object.fromEntries(['real', 'synthetic'].map(p => [p, { total: 0, valid: 0, gold: 0, draft: 0, splits: Object.fromEntries(splits.map(s => [s, 0])) }])),
    structure_only: true, quality_verified: false, limits_reached: false,
  };
  function reject(codes) {
    summary.ok = false; summary.invalid++;
    for (const code of new Set(codes)) summary.reasons[code] = (summary.reasons[code] || 0) + 1;
  }
  function stopAtLimit(code = 'DATASET_LIMIT') {
    if (!['DATASET_LIMIT', 'LINE_LIMIT'].includes(code)) throw new Error('Invalid dataset audit limit.');
    summary.limits_reached = true; summary.ok = false;
    summary.reasons[code] = (summary.reasons[code] || 0) + 1;
  }
  function addLine(line) {
    if (summary.limits_reached) return false;
    const bytes = Buffer.byteLength(line, 'utf8') + 1;
    summary.bytes += bytes;
    if (summary.bytes > limits.bytes || summary.total >= limits.examples) {
      stopAtLimit();
      return false;
    }
    summary.total++;
    if (bytes - 1 > limits.lineBytes) { reject(['LINE_LIMIT']); return true; }
    let example;
    try { example = JSON.parse(line); } catch { reject(['INVALID_JSON']); return true; }
    const bucket = typeof example?.provenance === 'string' && Object.hasOwn(summary.provenance, example.provenance) ? summary.provenance[example.provenance] : null;
    if (bucket) bucket.total++;
    const reasons = validate(example, limits);
    // Invalid drafts still reserve stable identities, preventing a bad row hiding leakage.
    if (object(example)) {
      if (identifier(example.id)) {
        const key = hash(example.id);
        if (ids.has(key)) reasons.push('DUPLICATE_ID');
        ids.add(key);
      }
      for (const [field, index, code] of [['thread_id', threads, 'THREAD_SPLIT_OVERLAP'], ['call_id', calls, 'CALL_SPLIT_OVERLAP']]) {
        if (!identifier(example[field]) || !splits.includes(example.split)) continue;
        const key = hash(example[field]);
        if (index.has(key) && index.get(key) !== example.split) reasons.push(code);
        else index.set(key, example.split);
      }
      if (identifier(example.call_id) && identifier(example.thread_id) && Array.isArray(example.prefix?.turns) && example.prefix.turns.length <= limits.turns && example.prefix.turns.every(t => object(t) && ['staff', 'customer'].includes(t.speaker) && text(t.text, limits.textChars))) {
        const key = hash([example.call_id, example.thread_id, example.prefix.turns.map(t => [t?.speaker, t?.text])]);
        if (examples.has(key)) reasons.push('DUPLICATE_PREFIX');
        examples.add(key);
      }
    }
    if (reasons.length) reject(reasons);
    else {
      summary.valid++; bucket.valid++; bucket[example.review.status]++; bucket.splits[example.split]++;
    }
    return true;
  }
  function result() {
    const result = structuredClone(summary);
    if (!result.total && !result.limits_reached) { result.ok = false; result.reasons.EMPTY_DATASET = 1; }
    result.complete = !result.limits_reached;
    return result;
  }
  return { addLine, stopAtLimit, result };
}

export function auditDatasetJsonl(jsonl, options) {
  const audit = createDatasetAudit(options);
  if (Buffer.byteLength(jsonl) > (options?.bytes ?? DATASET_LIMITS.bytes)) { audit.stopAtLimit(); return audit.result(); }
  const lines = jsonl.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const line of lines) if (!audit.addLine(line)) break;
  return audit.result();
}
