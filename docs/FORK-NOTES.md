# Sales-coach fork

## Plan and completed scope

1. Make the decision pipeline dependable: bounded deadlines, typed response validation, stale-request cancellation, private local configuration, and honest probabilities.
2. Improve the sales utility: objection-specific prompts, discovery questions, a vehicle-sales coach, and repeatable synthetic evaluation.
3. Accept a role-separated transcript bridge locally, with exact session identity, authenticated ingestion, deduplication, bounded memory, and explicit coverage limits.

This remains an advisory assistant. Its recommendations do not change CRM data, make financing decisions, confirm inventory, place calls, or send customer messages.

## Run locally

Use Node 22.9 or newer. Copy `.env.example` to `.env`, supply a TypeSafe key, and run `npm start`. The browser version needs no npm dependency install; its speech worker fetches the configured Transformers.js runtime and model when used. The Electron and server-side speech paths need their optional/dev packages.

The local server binds to `127.0.0.1` by default. `.env` is ignored by Git. The configured provider key stays on the server; it is not served to the browser. The current workstation uses a private file with mode 0600. Never paste a provider key into committed files.

The primary screen is now a focused automotive sales demo. Choose one of its three scenarios, play/pause or advance the conversation, and add your own customer or rep wording. The general-sales API mode remains available for development. The automotive mode asks about needs, availability, total price, trade-ins, financing process, decision makers, concerns, visits, and follow-up. Suggested wording is curated in the playbook; Jev selects among typed options rather than generating unsupported product claims.

## Demo interface

The former multipurpose main screen was removed. The replacement uses a transcript-first layout, one prominent coaching recommendation, a separate ordinal shopping stage, and evidence states for vehicle needs, budget, timing and decision maker. Controls cover all three scenarios, pause/replay/single-step, manual input, microphone-only spoken practice, a live-session picker and optional browser-call capture. Spoken practice warms the recognizer, mutes the microphone during customer speech, distinguishes pending transcription from completed answers, and closes acquired streams on stop/source changes. It adds eight coverage checkpoints, reference-grounded rep-reply feedback, and bundled customer speech clips for browsers without installed voices. See USING-THE-DEMO.md for the operator flow. Errors remain visible and retryable.

The blue/white workspace, dark guidance area and local Schibsted typeface keep the conversation readable. CSS and icons are inline, small screens place coaching ahead of the transcript, keyboard focus is visible, and reduced-motion preferences suppress transcript animation. Scenario playback is tested for ordering, pause and switching cancellation. These checks supplement, rather than establish, visual acceptance.

## Reliability and uncertainty

- A six-second deadline covers the provider request, response body, and bounded retries. Set `JEV_TIMEOUT_MS` between 100 and 30000 if needed. Browser requests have a separate 7.5-second ceiling.
- New speech, reset, and call switching invalidate older results. Disconnecting the browser request also cancels the server's provider request.
- Every expected answer is checked for matching types, exact option sets, finite values, ranges, and a usable probability distribution. Bad data becomes an error rather than advice.
- Sales modes require model confidence of at least 0.35 and a top-two probability lead of 0.10. Proposals and visit suggestions have stronger original-probability thresholds. These are initial policy choices, not calibrated production guarantees.
- Excluded or completed actions no longer inflate the displayed probability of remaining actions. The action bar reports original **model probability**. The stage gauge is an ordinal shopping-stage index, not a measured probability of a sale.
- Objection-specific wording requires a clear matching objection classification. Discovery questions and ordinary requests for price are not automatically blocking objections.
- Common contact details and long numeric identifiers are masked before provider inference. Clear repeated-word ASR loops are rejected. These heuristics do not remove all personal data or prove transcription accuracy.
- Inference responses include the actual model, contract and redacted-state SHA-256 hashes, attempts, latency, usage, and transcript-window metadata. No transcript history is written to disk by this backend.

The workstation configuration pins `jev-1.14.0`, which accepted the live evaluation. Other accounts should verify available model access before adopting that version. Changing prompts, policy or model requires re-evaluation.

## Verification

Run `npm test` and `npm run check-modes` without a provider key. Tests include provider failures, cancellation, stale responses, probability gates, transcript quality, identity isolation, deduplication, incomplete coverage, and an HTTP path against a deterministic local provider.

`npm run eval:live` explicitly makes paid TypeSafe requests against authored synthetic fixtures. It writes `docs/synthetic-evaluation.json`, containing model/contract/input/policy identities, probabilities, usage and timing. The recorded run matched all 16 expected action and objection labels; median provider-wrapper time was 95 ms and p95 was 204 ms. One initial discovery/objection ambiguity was found and the rubric clarified before this recorded run.

These fixtures are development regressions, not a held-out benchmark, independent human labels, real-call accuracy, or an end-to-end audio latency measurement. Browser rendering, microphone permissions, acoustic quality and operator acceptance still need a connected-browser/real-call test. No computer-use browser was connected during this session.

For the bridge contract and integration limits, see [LIVE-TRANSCRIPTS.md](LIVE-TRANSCRIPTS.md).


## Existing VoiceClaude integration

The initial browser recognizer did not work in the user's browser; the previous synthetic CPU test did not establish that path. The primary workstation configuration now bypasses browser model loading and routes 16 kHz float32 audio through the demo backend into existing VoiceClaude services. The backend converts audio in memory, uses the personal GPU worker through its existing loopback SSH tunnel when available, and retains local whisper.cpp as fallback. Neither service is bundled or restarted by the application.

GPU requests have a six-second ceiling inside a 45-second overall recognition budget. Busy admission falls back immediately with a two-second cooldown; failures use a 30-second cooldown. Metadata reports the actual backend and measured speech time separately from Jev time. Configuration accepts only loopback provider URLs. The primary inference retains the native worker's Turbo/int8-float16/beam-5 quality settings.

`docs/gpu-speech-benchmark.json` records three warm synthetic trials: 282–300 ms of inference and 517–631 ms including the connection, for 12.8 seconds of speech. The first cold inference was 10.77 seconds; warm timing must not be presented as a cold-start or live-microphone guarantee. `docs/voiceclaude-smoke.json` records the actual browser-client/PCM/HTTP path with browser workers disabled. Refresh the page after changing recognition backend.
