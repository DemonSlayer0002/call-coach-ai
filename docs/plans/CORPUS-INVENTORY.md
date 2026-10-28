# D1 corpus feasibility and L1 consumer inventory

Observed **2026-10-28, approximately 18:09–18:12 UTC**, on `amd-main-01`.
This is an aggregate inventory, not a selected dataset or a quality benchmark.
No recordings, customer text, identifiers, credentials or model inputs were exported.
No production service, schema, gate or source was changed.

## Evidence and query scope

- Read the host contract, selected native operating guidance, the relevant lane map and current Core source.
- Used the installed Core `automations.inbox.coaching_recordings.projection()` inside the running Command Center artifact. This native projection opens the interaction and transcription-corpus stores read-only, resolves canonical staff attribution and deduplicates exact media references. The audit queried aggregate SQL over its `sources` and `recordings` CTEs; it did not call transcript hydration or recording-detail HTTP routes.
- Queried the coaching-artifact and historical live-STT stores using SQLite `mode=ro` and `PRAGMA query_only=ON`. Only counts, capability flags, bounded category labels and timestamps were returned.
- Counted recording filenames and paired suffixes on the host; no audio was opened or played. Tested stored-path visibility inside the Command Center container without guessing path remappings.
- Read bridge aggregate metrics, service metadata, running image provenance and the absent consumer-file inventory. An unauthenticated loopback `GET /api/internal/live-stt/events` returned HTTP 404. No ingestion request was submitted.

Relevant native source:

- Core `automations/inbox/coaching_recordings.py`: read-only projection and deduplication.
- Core `automations/inbox/coaching_artifacts.py`: retained original transcription capabilities.
- Core `phone_pipeline/transcription_completion.py`: full-source completion contract.
- Core `automations/inbox/call_transcribe_job.py`: post-call writer and retired live-transcript consumer stub.
- Ops `lib/amd_live_stt.py`: existing role-separated Telnyx producer.
- Ops `docs/COMMS-LANES.md`: native lane and activation boundaries. Its description of a working Core consumer is stale relative to the inspected runtime.

## Candidate recording and transcript coverage

| Measure | Count | Definition |
| --- | ---: | --- |
| Transcription-corpus source rows | 16,958 | Native `calls` source; 16,151 contain transcript text |
| Call-interaction source rows | 19,882 | Native `call_interactions` source; 14,573 contain transcript text |
| Deduplicated call/media records | 22,010 | Native exact-reference projection, not a business-deal count |
| Source duplicates collapsed | 14,830 | Source-row total minus deduplicated projection total |
| Conflicting exact recording-path attribution | 1 | Recording path associated with multiple PBX call references; requires quarantine/reconciliation |
| Records with a recording reference | 16,611 | Nonempty path only; not proof of readable or valid audio |
| Records with transcript text | 16,166 | Nonempty source transcript, not independently corrected text |
| Records with both reference and transcript | 16,152 | Candidate discovery pool before audio/provenance checks |
| Records with `call-review-v1` analysis | 8,267 | Existing AI analysis, not expert gold labels |
| Records with canonical staff attribution | 20,588 | Attribution through the native projection; not acoustic role verification |
| Records with customer references | 16,000 | Existing linkage only; no fresh DealerCenter outcome verification was performed |
| Records with PBX call references | 16,962 | Existing exact-call reference |
| Records with positive duration | 19,577 | Stored duration; not verified full audio coverage |

Directions are represented by two historical naming conventions: 177 `in`,
3,136 `inbound`, 3,235 `out`, 15,443 `outbound`, and 19 other/unknown.
Normalize those conventions before sampling. Do not use the earliest stored
timestamp directly for chronological splits: the aggregate query encountered a
positive value of `2005` Unix seconds, which needs source validation rather than
interpretation as a real recording date.

The recording directory contains **29,697 WAV files**: **9,899 mixed recordings**,
each with a matching `-rx.wav` and `-tx.wav` file. There were no unmatched rx/tx
suffix pairs in this directory listing. These are filename-pair counts, not
decoded-audio, channel-direction, audibility or consent verification.

Of the 16,611 stored recording paths, **9,882 were visible as files inside the
Command Center container and 6,729 were not**. The latter are **unverified**, not
confirmed missing: old paths, other mounts and archival locations may explain
absence. Native path resolution and archive receipts must be checked before
declaring data loss or excluding candidates. File visibility does not establish
audio quality, content or completeness.

## Retained transcription capability

The native artifact store contains **1,223 artifacts for 1,223 distinct calls**,
all with schema `retained-transcription-v1`.

| Retained capability | Artifacts |
| --- | ---: |
| Trusted speaker-role mapping | 3 |
| Verified segment timestamps | 3 |
| Verified full-source completion | 3 |
| Trusted roles and full-source completion together | 3 |
| Verified word timestamps | 1 |
| Single-channel undiarized | 1,220 |

The three role-verified complete artifacts consist of one AI-classified sales
call, one technical test and one unknown call. Their capability flags do not
establish independent human transcription accuracy or production acoustic
acceptance. Large raw recording availability must not be confused with a large
existing pool of verified role-tagged decision moments.

AI call-kind labels across all retained artifacts are 510 sales, 9 service,
409 technical tests, 45 wrong numbers and 250 unknown. These labels are useful
for candidate discovery only; reviewers must label independently of the model.

Human-development tables currently contain:

- Goal evidence, goals, calibrations, teaching examples and review amendments: **0 each**.
- Timestamped recording notes: **18**; their count does not establish an expert-labeled corpus.

No fresh DealerCenter sale, appointment or deal-outcome reads were performed.
Customer references and model-estimated buying stages cannot substitute for
verified later outcomes or approved human labels.

## Historical role-separated live transcripts

The historical live-STT store remains present even though its current consumer
was removed. It contains:

- **3,279 sessions / 3,279 distinct call IDs**, spanning session starts from
  2026-09-24 20:15:39 UTC through 2026-10-16 22:14:21 UTC.
- **36,487 final segments**: 17,421 customer and 19,066 staff.
- **1,588 sessions with segments for both roles**.
- **2,880 sessions not marked incomplete** and **399 marked incomplete**.
- **1,585 sessions both not marked incomplete and containing both role labels**.
- **3,250 sessions reporting audio seconds for both roles**; this exceeds the
  number containing text for both roles and must not be treated as equivalent coverage.
- **12 speaker/session lanes with detectable sequence gaps**, using the
  structural test `min(seq) != 1 OR max(seq) != count(*)`.
- 3,275 sessions in the recorded `ended` state, four in other states. Last
  update: **2026-10-16 22:21:43 UTC**.

Those historic flags and role labels are candidate provenance, not proof of
correct words, full acoustic coverage, current identity linkage, permitted
external inference or expert-approved training use. The 1,585 count is not a
count of ready gold examples. The sequence test detects some gaps but cannot
prove no final audio was lost after the last retained sequence.

## Permissions and dataset boundary

The inspected interaction, corpus, coaching and historical live-STT database
files are mode **0600**, owned by the native application account. The recording
directory is mode **0755**; individual audio-file access and native staff grants
were not expanded or changed. Directory traversal permission is not permission
to export audio or expose it through this public fork.

D1 is feasible as a **private, on-host selection and review task**. The initial
approximately 100-call / 500–1,000-moment targets remain targets. Before creating
that dataset, validate exact audio references, original artifact hashes,
speaker-role evidence, transcript versions, timestamps, duplicate/call-family
grouping, permitted use and a reviewer-owned labeling process. Reprocess only a
bounded approved sample where retained capability is insufficient. Keep raw
audio and customer text on the native private side; public-fork artifacts must
remain synthetic or aggregate-only.

## L1 current blocker and next native task

The running Command Center artifact is image
`sha256:21d3d6b7c63e3bf62564c2557ed626c7c7f1b08a23ae9e349f922d2db17b5d27`,
with source revision `ee7e18783de30d45aa0a48bd49b9c28cabca7837`.
It contains neither `automations/inbox/live_stt.py` nor `live_stt_store.py`.
The expected loopback ingest URL still returns **404**.

The existing `amd-live-stt` producer is active, running since October 24. Fresh
aggregate counters show **672 ingest HTTP 404s and 672 refused/skipped taps**,
one ARI connection, zero active calls and zero audio seconds charged against
today's bridge budget. These are process/day counters, not all-time provider
usage. The producer correctly refuses to open an audio tap until session-start
ingestion returns HTTP 200 with `ok:true`. Thus an open lane map and active
service are not proof of a functioning transcript pipeline.

**Next concrete native task:** create an isolated AMD Core task branch to
restore the authenticated consumer against the current source and release
manifest, preserving the existing Ops producer contract. Keep the local fork
as its synthetic protocol fixture. Validate immutable call/staff binding,
authorization and owner-only delivery, per-speaker sequence/deduplication,
interim supersession, gaps, partial ends and fail-closed start acknowledgment.
Review retention/schema compatibility with the existing historical store;
do not recreate, delete or silently migrate it. Complete Core tests and the
native review/release proposal before any production adoption. Separate
native activation approval and a bounded internal acoustic test must prove
both roles, selected staff visibility and hangup cleanup. This inventory does
not authorize production activation or customer audio export.
