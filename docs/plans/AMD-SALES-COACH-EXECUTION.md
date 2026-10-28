# AMD sales coaching execution plan

Status: execution started. See [work-package status and receipts](EXECUTION-STATUS.md). Production activation remains gated.

Prepared: 2026-10-28. Baseline source: `3609115` in the sales-coach fork. Recheck runtime evidence before each rollout.

## Outcome and scope

Build a call-bound assistant that hears both sides correctly, remembers the relevant facts, answers from verified dealership information, and shows one useful next move at the right time. Improve it through reviewed business examples and measured outcomes.

The first release succeeds when an operator can reliably start, speak, correct a misunderstanding, see grounded checkpoints, handle a customer question, and agree on a clear next step without distracting prompts. Deployment, microphone acceptance, inference quality and actual business outcomes are separate completion claims.

This plan authorizes no production activation, customer contact, DealerCenter writes, model-data exports or service interruption. Those steps retain their native approval and release requirements. Planning and offline development can proceed independently.

## Starting position

| Area | Current evidence | Gap to close |
| --- | --- | --- |
| Practice and replay | Three scripted scenarios, typed input, microphone-only practice, curated prompts and eight checkpoints | Actual browser, input device and acoustic acceptance need proof |
| Speech | Existing VoiceClaude GPU-first adapter with bounded local fallback; dedicated personal GPU worker restored and persistent | Loaded/healthy is not the same as truly warmed; cold-start and degraded behavior need a repeatable acceptance suite |
| Capacity | The personal GPU worker has single-inference admission and returns busy on concurrency | It is not yet a proven multi-rep production speech pool |
| Speed | Three warm synthetic GPU requests: 517–631 ms total; one completed-audio-to-coaching trial: 841 ms | These exclude microphone capture and end-of-speech delay and are not a real-call p95 |
| Jev | Typed validation, original-probability gates, cancellation, 16 authored sales cases and nine authored practice cases | No independent representative real-call accuracy estimate |
| Call memory | Inference uses the latest 40 turns; local transcript store retains at most 80 segments | Early facts can leave the model window; corrections and checkpoint evidence need a durable call-state contract |
| Production audio | Existing Asterisk/Telnyx bridge and role-separated event contract | Last inspected production ingest route returned 404; recheck before planning its native restoration |
| Prior shadowing | Existing historical observations and review patterns | Broad collectors were retired; previous predictions are not gold labels or a current live coaching feed |
| Delivery | 58 offline tests and passing CI at the baseline | Test counts do not substitute for browser journeys, audio evaluation or business acceptance |

Existing evidence: [GPU speech](../gpu-speech-benchmark.json), [browser-client speech route](../voiceclaude-smoke.json), [service receipt](../gpu-service-receipt.json), [synthetic decisions](../synthetic-evaluation.json), [practice decisions](../practice-evaluation.json).

## System boundaries

- The fork owns the practice/replay experience and independently implemented reusable contracts.
- VoiceClaude owns the existing personal speech services, tunnel, model lifecycle and GPU admission. Changes go through that project's source/install path. Do not pause other GPU workloads to improve benchmark numbers.
- AMD Core owns authenticated staff/call visibility, production transcript ingestion, call state, review evidence and native business integrations.
- AMD Ops owns the existing PBX/Telnyx producer, units, limits, activation and release receipts.
- DealerCenter remains authoritative for customer, vehicle, deal, inventory and task facts. Reuse native reads and business write gates.
- Production transcript and business truth should have one canonical owner. The fork's ephemeral practice state is not a new customer database.

The existing role-separated Telnyx path is the first production integration candidate. The personal GPU path supports practice, replay and comparison. Select production ASR from the same controlled call-audio evaluation; a fast synthetic GPU result alone does not establish the best phone-call recognizer.

## Execution sequence

| Phase | Deliverable | Required exit gate |
| --- | --- | --- |
| 0 Reliability and loading | Truthful readiness states, stage timing and a reproducible microphone journey | Actual browser/device success, refusal and recovery demonstrated |
| 1 Learning data and baseline | Private evidence-linked corpus, agreed labels and frozen test set | Reviewed examples, split integrity and measured baseline |
| 2 Detection and memory | Better utterance handling, atomic intents and a full-call evidence ledger | Critical-error cases pass and detection improves on unseen examples |
| 3 Useful coaching | Verified answer context, quiet prompts and grounded post-call handoff | Reviewed cues are useful and factual, with bounded distraction |
| 4 Real call connection | Native restoration of authenticated ingestion and exact-call binding | Controlled call proves role separation, final delivery and recovery |
| 5 Shadow and pilot | Replayable shadow comparison, limited staff pilot and outcome review | Quality, usefulness, reliability and outcome gates support expansion |
| Later Model adaptation | A targeted training proposal for measured recurring errors | Beats the unchanged champion on held-out data without unacceptable latency or regressions |

Phase 1 can run alongside Phase 0 after private data access is established. Native ingest investigation can run alongside offline detection work. Staff-visible live coaching waits for the relevant quality and real-call gates.

## Phase 0 Reliability and loading

### R1 Show what is actually ready

Separate these states:

- Microphone: permission needed, selected device, receiving audio, muted for customer playback, stopped or unavailable.
- Speech: connecting, loading, warming with speech, available, busy, local fallback or unavailable.
- Coaching: available, evaluating, displaying current advice, stale or unavailable.
- Call coverage: complete for the observed interval, missing segments, truncated or ended.

Preflight speech in the background without starting microphone capture. Exercise the actual encoder/decoder with synthetic speech before declaring the cold model warm; a silence-only VAD pass is insufficient evidence. Respect the existing personal worker's admission and other workloads. Keep stop/cancel available during setup.

Show the underlying error next to the affected control. Offer one relevant recovery action. Keep configured credentials, responsive health, warmed inference and successful audio distinct.

Scope: `lib/local-speech.mjs`, `server.mjs`, `public/transcriber.js`, `public/voice-practice.js`, `public/sales-desk.js`; any native warmup change belongs to VoiceClaude's canonical project.

Acceptance: cold startup, warm startup, busy GPU, absent tunnel, provider timeout, local fallback, denied microphone, unplugged input, source switch and stop-during-loading each produce the correct state. No recording survives stop or changes owner. A provider or model change cannot leave the page using a silently cached old backend. Exercise two speaking roles and the expected call concurrency; measure admission, queueing and fallback explicitly. Keep the personal dictation service separate from any unproved staff-wide capacity claim.

### R2 Measure the complete user journey

Record content-free stage timings using monotonic clocks and call/utterance IDs: microphone start, detected speech onset, last voiced frame, segment finalization, ASR request/result, Jev request/result and rendered cue. Separate cold, warm, busy and fallback samples. Never add overlapping timers to fabricate an end-to-end result.

Add a sanitized diagnostic readback containing readiness, device status, request IDs, timings and error codes, excluding keys, audio and transcript text. Provide input-device selection with real level feedback and safe handling of device changes. Include an operator-triggered customer-audio output check; a playback-completed event alone does not prove the person heard it.

Acceptance: an actual browser/device run proves hear customer → speak → transcript → guidance/checkpoints → next question → stop. Repeat with a denied device and a disconnected recognizer. Source inspection, mocked microphone tests and generated-audio tests remain supplementary evidence. If automation is unavailable, use a short structured operator test with recorded results.

## Phase 1 Learning data and baseline

### D1 Create the private reference corpus

Inventory candidate recordings/transcripts through native sources before copying anything. Determine recording/role coverage, transcript versions, duplicates, missing audio, usable timestamps and outcome links.

Start with approximately 100 representative calls and 500–1,000 useful decision moments, adjusted after the coverage audit. These are seed targets, not a claim that the sample proves production accuracy. Include successful and unsuccessful sales calls, objections, finance questions, follow-ups, service/wrong-number calls, transfers, quiet speech, accents, noise and interruptions.

A reference example includes:

- Stable call/customer-thread references, source artifact hashes and trusted speaker roles.
- Audio interval, original transcript and independently corrected reference text.
- The conversation prefix available at that moment; later information is excluded from the live input.
- Human labels, exact supporting segments, the useful next action and an approved alternative response.
- Observed behavior, opportunity without behavior, not applicable or insufficient evidence.
- Actual later outcomes with canonical source and verification time, stored separately from the prefix.
- Dataset version, reviewer identity, review status and permitted use.

Keep raw audio private. Use access-controlled scrubbed derivatives for evaluation and external inference. Exclude credentials, full payment details and identity numbers from training exports. Preserve business-critical amounts and negations accurately where permitted. Do not put customer material in this public fork.

### D2 Establish trustworthy labels and tests

Have experts label without first seeing the model's proposed answer. Double-review a portion of the seed set and resolve disagreements by improving the rubric. AI can find candidates or prepare provisional drafts; model agreement is not independent correctness.

Keep related calls from the same customer together. Reserve a frozen, newer holdout and keep it out of prompt tuning, example selection and synthetic generation. Track a separate development set and eventually a new chronological release set. Evaluate live decisions on prefixes, not retrospective summaries that reveal what happened next.

Generate practice variations from approved business examples: reordered phrasing, interruptions, budget corrections, role reversals, uncertain dates, declined terms, request-versus-agreement and canceled/rescheduled appointments. Label synthetic provenance and report synthetic and real results separately.

Acceptance: an independent reviewer can reconstruct why each gold label is correct from its evidence. No customer-thread overlap or future-information leakage crosses the test boundary. Baseline error rates, abstentions and reviewer disagreement are reported with denominators.

## Phase 2 Detection and call memory

### Q1 Improve speech detection from measured failures

Build an audio replay matrix before tuning VAD: short yes/no/thank-you replies; quiet starts; pauses inside prices and dates; long answers; background audio; customer/rep overlap; headset echo; clipping; model failure and a late final after a source switch.

Current investigation points include the roughly 240 ms minimum-speech filter, roughly 700 ms finalization silence and 12-second segment cap. Measure lost short words, split numbers and extra delay before changing them. Use a tested profile for practice and another for real calls only if the evidence supports it.

Keep partial text provisional. Commit final turns once, handle corrections/retractions explicitly, preserve speaker identity and prevent late words from moving into a new question. Evaluate number/date/vehicle errors separately from ordinary word error rate.

Scope: `public/segmenter.worklet.js`, `public/capture.js`, `public/speech-quality.js`, `public/voice-practice.js`, and the selected ASR adapter.

Acceptance: replayed audio and actual-device checks retain critical terms and roles; a latency improvement cannot pass by losing words. New edge failures become permanent regression examples. Compare Telnyx and GPU recognition on the same permitted phone-audio sample.

### Q2 Introduce an evidence-linked call ledger

Retain full-call facts separately from the small recent-conversation window sent to Jev. Store needs, budget constraints, timing, participants, vehicle references, customer questions, objections and their resolutions, promises, requested times and accepted next steps.

Each fact carries source segment/quote, speaker, timing, confidence/status and revision. Corrections supersede prior facts. Unclear evidence remains unknown. A late contradiction withdraws stale advice. Avoid recursive AI summaries becoming the only evidence.

Use narrowly defined Jev questions and deterministic transition rules. Distinguish price inquiry from objection, requested time from mutual agreement, and conversation agreement from an actual booking receipt. Technical/wrong-number calls must not fail a sales checklist. Confirmed business state comes from the native system.

Scope: versioned contracts in the fork during offline evaluation; production ownership and persistence in AMD Core. Update `lib/coach.mjs`, `public/decide.js` and automotive questions against the frozen cases. Extend existing ingestion identity/deduplication instead of creating a second incompatible event protocol.

Acceptance: an early budget or resolved objection remains available after more than 40 turns; an explicit correction replaces it; transfer, duplicate, delayed, missing and reordered events cannot mix calls or silently imply complete coverage. Each checkpoint explains its evidence and opportunity state.

## Phase 3 Verified answers and quiet coaching

### C1 Ground answers in current business facts

Use native reads for inventory, current availability, approved pricing and policy. Each retrieved fact needs provenance, freshness and scope. Changes or expired evidence invalidate affected prompts. Failed reads are unknown, not zero or permission to use a stale answer.

Start with approved short response patterns and fill only verified fields. A more capable text model can draft a complex answer in a separate bounded path, but cannot invent facts or block fast detection. Keep practice facts explicitly synthetic and isolated from real calls.

Acceptance: correct reference answers appear for known facts, unknown facts trigger a useful verification response, and outdated/sold vehicles or unverified financing terms never become confident current claims. The system does not determine lender approval.

### C2 Make the interface earn its screen space

Display one primary cue. Prioritize the unanswered customer question, a material unsupported promise, or an appropriate next-step opportunity. Use a stable cue until evidence changes; suppress repetition, acknowledged steps and uncertain low-value suggestions. Put detailed transcript, evidence and scorecards behind deliberate expansion.

Keep coverage available without turning the call into a game of checking every box. Distinguish what the customer already stated from what the rep asked. Show provisional versus agreed next steps. After the call, produce a grounded short summary, explicit promises, missing details and a proposed next action with an owner only when supported.

Add Useful / Distracting / Wrong feedback tied to the exact cue and evidence. Reuse existing review/teaching workflows for deeper corrections.

Acceptance: staff can understand and act on the cue without reading a paragraph; the cue does not change on every fragment; it cannot remain attached to the previous call. Draft follow-ups and proposed bookings are visibly distinct from completed actions. Native writes and customer contact retain their separate authorization and receipts.

## Phase 4 Real call integration

### L1 Restore the native consumer and prove the contract

Recheck the missing production route and the deployed artifact before editing. Restore the authenticated consumer in AMD Core through the native development, review and release lane. Validate the existing producer's session-start acknowledgment before permitting taps, exact call/staff binding, trusted customer/staff lanes, interim revisions, final retries, sequence gaps and incomplete ends.

Staff access must be checked server-side. Do not expose the local demo's unrestricted loopback transcript viewer as a production staff endpoint. Maintain existing budgets, limits and fail-closed behavior. Do not revive retired broad collectors or open audio gates merely because the process is healthy.

Scope: AMD Core ingest/auth/store and AMD Ops producer compatibility. The public fork remains a practice/reference consumer, not the production release mechanism.

### L2 Run a bounded controlled call

After native release approval and readback, use an approved internal test call to prove audio capture → speaker-tagged text → call ledger → shadow decision → selected staff session. Verify acoustic role separation, reconnect, source/call switching, packet loss and hangup. Restore normal gates and retain the receipt.

Acceptance: real final transcripts and decisions are bound to the exact test call, both roles are correct, missing coverage is visible, all audio stops on hangup and the selected deployed artifact matches the release. A synthetic HTTP acknowledgment or service status alone does not close this phase.

## Phase 5 Shadow evaluation and staff pilot

### E1 Collect quality evidence before showing suggestions

Run proposed decisions without influencing the call. Store the call prefix reference, actual model, question/contract version, input hash, threshold/policy version, facts snapshot, proposed cue, latency, coverage and later human verdict. Keep these as evaluation traces, not automatic gold training labels.

Compare the current champion and each candidate on the same cases. Review false positives, missed opportunities, unknown/abstained cases and stale-fact errors. A candidate cannot appear accurate simply by refusing every case.

### E2 Enable a small staff pilot

Start with an owner/experienced rep and one defined call type. Expand only after reviewed calls demonstrate that suggestions are useful and quiet. Separate model accuracy, operator adoption and business outcomes. Compare appropriate call types and lead circumstances; a sale alone does not prove the advice caused it.

Starting acceptance targets below are proposed release gates. Calibrate them after the baseline; they are not current results or universal guarantees.

| Measure | Initial gate |
| --- | --- |
| Readiness feedback | Correct visible setup state within 250 ms of an action; microphone level feedback within 200 ms on tested hardware |
| Warm coaching latency | p95 at or below 2 seconds from last voiced frame to visible cue on the healthy GPU path; report sample size, failures and fallback timings separately |
| Useful displayed cues | At least 95% correct/relevant in a minimum 100 independently reviewed displayed cues, with uncertainty bounds reported |
| Opportunity coverage | At least 80% of the labeled actionable opportunities surfaced; report abstentions and reasons |
| Critical errors | No wrong-call attribution, invented verified price/approval, or false booked-appointment claim in the critical release suite; publish the suite size and limits |
| Distraction | No more than one human-marked distracting cue per pilot call on average; inspect the worst calls too |
| Recovery | Stop, denied mic, unplug, GPU busy/down, tunnel loss and late finals all pass the relevant browser/audio journeys |
| Business effect | Track appointment asks, conversation agreements, recorded bookings, attendance and completed follow-ups as separate outcomes; establish a baseline before attributing improvement |

Rollback the selected cue policy/model version if critical error or distraction gates fail. Preserve evidence and the previous champion. Do not compensate for poor detection with more UI or broader automatic actions.

## Later Model adaptation

Improve the system's prompts, facts, state transitions and thresholds first. Fine-tune speech or another locally controlled model only when the reviewed error distribution justifies it and the candidate beats the frozen benchmark under the same latency/cost budget.

Use independently owned audio, human corrections and expert business labels. Jev inference is not automatic training; self-service Jev fine-tuning has not been verified. Its published agreement restricts training models to imitate its outputs, so do not turn the old shadow ledger into a distillation corpus. Any training/export proposal needs its own data, permission, provider-terms and resource review. Inference on a 16 GB GPU does not establish feasibility or quality for a proposed training run.

Sources: [Jev data use](https://help.typesafe.ai/articles/5974925716-how-is-submitted-data-used-or-retained), [TypeSafe agreement](https://typesafe.ai/legal/mca), [confidence](https://docs.typesafe.ai/confidence), [Telnyx streaming lifecycle](https://developers.telnyx.com/docs/voice/stt/websocket-streaming), [Whisper adaptation guidance](https://huggingface.co/learn/audio-course/chapter5/fine-tuning).

## Ownership and operating review

| Responsibility | Execution owner to assign | Approval or review |
| --- | --- | --- |
| Product priorities and cue usefulness | Product owner | Ahmad |
| R1/R2 and practice audio reliability | One fork/VoiceClaude engineering owner per change | Independent correctness review and actual-device operator |
| D1/D2 and rubric consistency | Data/evaluation owner | Ahmad or a designated experienced sales reviewer; independent second review on a sample |
| Q1/Q2 and C1/C2 | Detection/coaching engineering owner | Gold-set evaluation plus sales review |
| L1/L2 | AMD Core owner with AMD Ops counterpart | Existing native release and bounded-call activation authority |
| E1/E2 | Pilot owner | Participating rep plus product owner reviewing usefulness and business outcomes |

Assign the named individual or agent when opening each execution task. No teammate is assigned work or given broader access by this plan. Give the sales reviewer short evidence-linked moments, not hours of unstructured transcripts. Budget and capacity expansion are separate decisions.

## Execution order and completion receipts

First implementation batch: R1 readiness/warmup truth and R2 actual microphone/browser diagnostics. First data batch: D1 corpus inventory and D2 label/split specification. Then execute Q1 and Q2 against that baseline. Build C1/C2 as the quiet production experience, complete L1/L2 through native AMD lanes, and use E1/E2 to decide expansion.

Give each work package a named execution owner and one reviewable change or tightly scoped PR. Keep bug fixes narrow. Reproduce a defect before fixing it where a valid seam exists. Finish required verification before broadening the change. Resolve critical startup/detection defects before adding features.

Each completed package needs source revision, actual affected artifact, executed checks, representative before/after evidence, known limitations and rollback procedure. Bind runtime claims to native adoption receipts. No real-call feature is complete until its stated operator and acoustic acceptance runs pass.

The first practical milestone is simple: the owner can start voice practice reliably, hear a question, speak a short or long reply, see accurate text and evidence-backed guidance, correct it, and stop cleanly. That is the entry gate to the more ambitious learning and live-call system.
