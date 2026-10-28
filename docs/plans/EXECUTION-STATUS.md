# Execution receipts

Updated 2026-10-28. Engineering owner: this fork's execution agent. Independent review: AMD shadowing agent. Private source inventory: AMD call-interfaces agent.

## First milestone

The demo now distinguishes available speech from an actual synthetic-speech inference check, offers input selection and an output check, reports actionable permission errors, and exports content-free diagnostics. Setup rechecks configured speech mode. Stopping cancels recognition and releases microphone tracks. Switching from practice to browser capture stops the previous owner before starting another.

Chromium acceptance exercised synthetic microphone audio through the actual AudioWorklet, GPU service and Jev. Twelve checks passed, including permission refusal, recognizer disconnect, capture ownership, device lock, question advancement, stop and mobile overflow. The exported timing includes the 690 ms DSP endpoint wait, recognition, coaching and browser rendering; it is not just an inference benchmark. All 82 offline tests pass, structural demo/mode checks pass, and the production dependency audit reports zero vulnerabilities. See [the browser receipt](../browser-journey-receipt.json), [speech warmup receipt](../readiness-receipt.json), and [direct recognition receipt](../voiceclaude-smoke.json).

These are synthetic development results on an already running GPU service. They do not establish cold-restart behavior, physical microphone pickup, human audibility, production capacity, real-call accuracy or a latency percentile.

## Work-package status

| Package | Delivered | Remaining gate |
| --- | --- | --- |
| R1 | Real synthetic speech preflight with single-flight/expiry, separate availability, selected input, specific errors, cancellation and source ownership | Physical device refusal/unplug/recovery; cold native service and shared-load acceptance |
| R2 | Bounded allowlisted diagnostic export and actual Chromium audio-to-cue journey; desktop/mobile rendering | Owner's physical input/output acceptance and representative latency distribution |
| D1 | Aggregate read-only native inventory and source/coverage defects | Private selection, exact audio/provenance validation and reviewed sample |
| D2 | Private reference contract and structural audit tooling | Independent blinded expert labels and frozen real holdout |
| Q1 | Shipped-worklet replay harness and regression probes | Representative audio matrix and same-audio recognizer comparison before changing thresholds |
| Q2, C1, C2 | Existing implementation unchanged | Reviewed baseline first, then full-call evidence ledger and grounded quiet-cue changes |
| L1 | Fresh native image and missing-consumer confirmation | Isolated AMD Core restoration task, native review/release/auth acceptance |
| L2, E1, E2 | Pending dependencies | Controlled real call, human shadow review, then bounded staff pilot |

The corpus audit found 16,152 records with both transcript and recording references, but only three retained artifacts with trusted roles and full-source completion, and no established human gold-label corpus. References and filename pairs are discovery evidence, not quality proof. See [aggregate inventory and the concrete native restoration task](CORPUS-INVENTORY.md).

## Detection decision

The replay harness executes the shipped DSP, rather than mirroring its behavior. Synthetic speech, silence/click rejection, pauses inside an answer and a 26-second continuation were exercised. A 180 ms tone is dropped by the existing speech-duration guard, while 300 ms passes. One generated natural-word `Yes` fixture passed without changing that guard. Neither tones nor one synthetic word establish human short-word recall. No global VAD threshold was changed without the reviewed audio matrix.

## Run and recover

Use `npm start` in the repository and open http://localhost:3137 with the existing private configuration. Choose an input, check customer audio, then start practice. Download diagnostics after a failure; no automatic upload is performed. See [operator instructions](../USING-THE-DEMO.md) for automated Chromium repetition and physical acceptance limits.

Rollback is source-only for this milestone: stop this demo, check out the previous fork revision in an isolated worktree, and run it with the existing private configuration. The native VoiceClaude and AMD services were not changed during this execution batch. Do not stop shared speech services to roll back demo UI or diagnostics.

The next dependency is a private, role-verified reviewed sample. A public-fork implementation cannot manufacture human gold labels, current dealership facts, native staff authorization or a recorded booking receipt. Those gates remain explicit before live coaching expands.
