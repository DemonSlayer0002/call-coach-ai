# Private prefix dataset contract v1

This contract audits dataset structure and evidence references on the private
host holding the data. It does not select calls, export data, run a model, verify
an outcome, establish recording permission or prove label quality. Keep real
audio, examples and reviewer identities out of this public repository.

Run directly; no provider key or dependency installation is required:

```sh
node tools/check-dataset.mjs /PRIVATE/approved-prefixes.jsonl
```

Exit codes: `0` means the complete input passed the structural audit; `1` means
validation failed or a safety limit stopped the audit; `2` means usage or file
reading failed. Standard output is one aggregate JSON object. Input paths,
example/call/thread/reviewer IDs, quotations, source text and native exception
messages are never included. Standard error is empty for expected failures.

## One JSON object per line

The following example is entirely synthetic. A real dataset uses the same
shape with permitted private source references and independently reviewed text.

```json
{
  "schema_version": 1,
  "id": "example-synthetic-001",
  "provenance": "synthetic",
  "call_id": "call-synthetic-001",
  "thread_id": "thread-synthetic-001",
  "split": "dev",
  "source": {
    "artifact_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "transcript_version": "synthetic-script-v1",
    "role_provenance": "synthetic",
    "permitted_use": "private_evaluation"
  },
  "prefix": {
    "as_of": "2026-10-01T10:00:03Z",
    "cutoff_turn_id": "turn-2",
    "turns": [
      {
        "id": "turn-1",
        "order": 1,
        "speaker": "staff",
        "text": "What matters most in your next vehicle?",
        "at": "2026-10-01T10:00:00Z"
      },
      {
        "id": "turn-2",
        "order": 2,
        "speaker": "customer",
        "text": "The total price must stay under my budget.",
        "at": "2026-10-01T10:00:02Z"
      }
    ]
  },
  "labels": [
    {
      "criterion": "budget",
      "status": "observed",
      "evidence": [
        {
          "turn_id": "turn-2",
          "quote": "total price must stay under my budget"
        }
      ]
    }
  ],
  "review": {
    "status": "gold",
    "reviewer": {
      "id": "reviewer-synthetic-001",
      "kind": "human",
      "independent": true,
      "blinded": true
    },
    "reviewed_at": "2026-10-02T10:00:00Z"
  }
}
```

The placeholder digest illustrates syntax only; it is not a real source hash.
The actual file contains one complete object per physical line, rather than
the formatted multiline example above. A final newline is optional. Blank
lines, comments, `null`, arrays and malformed JSON are rejected.

## Identity, provenance and prefix rules

- `id`, `call_id`, `thread_id`, turn IDs, criterion names, transcript versions
  and reviewer IDs use 1–128 ASCII letters/digits with `_`, `.`, `:`, `-` after
  the first character. Use stable opaque references, not names or phone numbers.
- `provenance` is `real` or `synthetic`; `split` is `train`, `dev` or `holdout`.
  Related real calls and derived synthetic variations must retain a common
  thread grouping so split checks can detect leakage.
- Source metadata requires a lowercase 64-character SHA-256 digest, a retained
  transcript version and the explicit `private_evaluation` use declaration.
  Real role provenance must be `trusted_audio_lanes` or `human_verified`;
  stereo channel labels alone do not qualify. Synthetic provenance must say
  `synthetic`. The auditor checks declarations, not the underlying rights,
  digest contents, acoustic roles or identity registry.
- Prefix turns start with `order:1` and increase consecutively. IDs are unique
  within the prefix; roles are exactly `staff` or `customer`; text is nonblank.
  Preserve the full conversation prefix available to the model, rather than
  cherry-picking only favorable evidence. `cutoff_turn_id` must identify the
  last retained turn.
- All dates must be canonical UTC ISO timestamps with seconds and either no
  fractional part or exactly three decimal places, ending in `Z`. Calendar
  overflow such as February 30 is rejected. Turn dates are nondecreasing;
  none may exceed `prefix.as_of`. Review time cannot precede that cutoff.
  Millisecond precision is a representation, not a claim of acoustic accuracy.

Choose and record a chronological holdout cutoff after source-date validation. The auditor checks timestamps within examples and customer/call split isolation; it does not prove that the holdout is newer than development data or has stayed frozen. Preserve a separate private split manifest and review that boundary before tuning.

The auditor cannot detect a source turn omitted and renumbered before the
file was supplied. Completeness must be checked against the retained source.
When replaying, send only the prefix to the model. Keep later outcomes and
review labels outside model inputs; do not reconstruct prefixes from summaries
that expose later events.

## Labels and human review

Each example has 1–32 labels, with a unique `criterion` per example. A label's
`status` is exactly one of:

| Status | Meaning |
| --- | --- |
| `observed` | The defined behavior is supported in this prefix |
| `opportunity_without_behavior` | A supported opportunity existed and the behavior was not observed |
| `not_applicable` | The prefix supports the criterion being inapplicable |
| `insufficient_evidence` | Available evidence cannot resolve the criterion |

Each label includes 1–16 evidence references. Every `turn_id` must exist inside
the supplied prefix and every nonblank `quote` must be an exact, case-sensitive
substring of that turn's text. References to future or missing turns and edited
quotations are rejected. For inapplicable or insufficient cases, quote the
available context being judged; do not fabricate an absence quotation. Exact
quotation matching proves a reference exists, not that it supports the label.

Review status is `draft` or `gold`. Every row identifies a reviewer with
`kind:human|ai`, boolean `independent` and `blinded` declarations, and a valid
`reviewed_at`. AI-authored drafts may be inventoried but **can never be gold**,
including for synthetic examples. Real gold additionally requires a human
reviewer explicitly marked independent and blinded. Blinded means the reviewer
made the assessment without first seeing the model's proposed label or cue.
These fields attest to the process; code cannot verify a person's identity,
independence, blinding or actual accuracy. Independent review, disagreement
resolution and a separately preserved holdout remain required.

## Leakage, duplicates and bounded output

Any reused example ID is rejected. The same call or thread cannot appear in
different splits, even when an earlier row was otherwise invalid. Identical
ordered speaker/text prefixes for the same call/thread are duplicates even if
their example IDs, turn IDs, timestamps or labels were changed. Corrected label
versions replace a selected dataset row; do not include both as independent
examples. Different prefixes of one call can coexist inside the same split.

Limits are 32 MiB per file, 256 KiB per line, 10,000 examples, 1,000 turns per
prefix, 8,000 characters per turn, 4,000 characters per evidence quote and
32 labels per example. The streaming CLI stops at file/line/example limits
without buffering an unlimited line. The library accepts lower limits for
tests, never higher ones. The in-memory convenience function accepts an already
available JSONL string; use the CLI for files.

Output includes total/valid/invalid row counts, reason-code counts and separate
`real` and `synthetic` buckets. Each bucket reports its own total, valid, gold,
draft and split counts. Gold/draft/split counts include only rows accepted when
processed, not malformed drafts. A later overlap invalidates the dataset even
though a previously counted row may remain in those diagnostic totals. Do not
treat counts from a failed dataset as an eligible evaluation denominator.

`limits_reached:true` and `complete:false` indicate only a bounded input prefix
was audited; remaining data is unknown. Every report carries
`structure_only:true` and `quality_verified:false`. A passing audit never proves
representative sampling, label correctness, ASR accuracy, legal permission,
real-world coaching quality, calibration or readiness for production.
