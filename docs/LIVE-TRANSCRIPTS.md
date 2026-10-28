# Local live-transcript adapter

## Architecture

Use an existing role-separated transcription producer rather than inferring roles from mixed audio:

```text
PBX customer/staff audio lanes
    → two Telnyx streaming STT sockets
    → authenticated normalized transcript events
    → local in-memory session store
    → selected browser call
    → Jev typed decisions
    → deterministic coaching cards
```

The local adapter is implemented here. A production producer connection is **not activated**. It does not restore another application's missing ingest route or change a running phone system. A governed deployment and bounded live-call acceptance test remain separate work.

Telnyx supports server-side streaming transcription at `wss://api.telnyx.com/v2/speech-to-text/transcription`. The existing PBX approach can preserve roles using separate customer and staff audio taps and sockets. A normalized transcription frame alone does not establish the speaker's role. No Telnyx credentials are needed in this fork when the upstream bridge owns provider access.

Official references:

- [Streaming STT](https://developers.telnyx.com/docs/voice/stt/websocket-streaming)
- [Response messages and final/interim semantics](https://developers.telnyx.com/docs/voice/stt/websocket-streaming/responses)
- [Models](https://developers.telnyx.com/docs/voice/stt/models)
- [Audio formats](https://developers.telnyx.com/docs/voice/stt/websocket-streaming/parameters/audio-formats)

Nova-3 is the initial accuracy-oriented option. Flux is a candidate to benchmark for latency; adopting it requires handling its distinct turn events. Model choice and endpointing need an acoustic test, not an assumed latency promise.

## Authentication and exposure

Generate a fresh local `AMD_LIVE_STT_INGEST_TOKEN` in your private `.env`, independently from all production credentials. It is distinct from the TypeSafe key. Ingestion fails closed if it is unset. The first adapter permits loopback clients in local mode only; hosted mode rejects these routes. A future hosted integration must supply staff authentication, call visibility permissions and authenticated transport before enabling transcript reads.

```http
POST /api/internal/live-stt/events
Authorization: Bearer <local-ingest-token>
X-AMD-Intent: live-stt-ingest-v1
Content-Type: application/json
```

Body: `{"events":[...]}`. Success is HTTP 200 with `{"ok":true}`. A producer should require that acknowledgment for `session_start` before opening audio taps. Do not redirect a production bridge here without a separately reviewed rollout.

## Event contract

All events need nonempty `session_id`, `call_id`, `kind`, and `at` (Unix seconds). Use a fresh session ID for each call session. Session identity is immutable.

```json
{
  "events": [
    {
      "kind": "session_start",
      "session_id": "synthetic-session",
      "call_id": "synthetic-call",
      "amd_call_id": "",
      "staff_account": "synthetic-staff",
      "customer_endpoint": "telnyx",
      "at": 1000
    },
    {
      "kind": "segment",
      "session_id": "synthetic-session",
      "call_id": "synthetic-call",
      "speaker": "customer",
      "seq": 1,
      "final": true,
      "text": "Is the SUV available?",
      "audio_ms": 2000,
      "confidence": 0.92,
      "at": 1002
    },
    {
      "kind": "session_end",
      "session_id": "synthetic-session",
      "call_id": "synthetic-call",
      "incomplete": false,
      "at": 1010
    }
  ]
}
```

`speaker` accepts only `customer` or `staff`. It must come from the trusted audio lane, not guessed channel A/B labels. The browser maps `staff` to its internal `rep` role.

`seq` is an integer starting at 1 independently for each speaker. Interims are accepted but never appended to final transcript history. The first final supersedes interim revisions; duplicate final retries are idempotent. A conflicting repeated final is rejected. Late already-finalized sequences are ignored. Missing sequence numbers flag incomplete coverage.

`audio_ms` is cumulative audio sent to that role's recognizer, not utterance onset or precise segment duration. `at` is approximate producer receipt chronology, not an acoustic timestamp. The adapter does not claim precise overlap reconstruction.

Producer `incomplete` is preserved. Storage truncation is separately disclosed. Sessions expire after 30 idle minutes; at most 24 sessions and 80 final segments per session are retained in memory. Jev currently sees the latest 40 turns, with each turn bounded to 1500 characters. No on-disk transcript archive is created.

## Browser consumption

`GET /api/live/sessions` lists bounded session summaries. `GET /api/live/sessions/{session_id}` returns committed, scrubbed segments and coverage metadata. The browser's **Live call transcript** panel lets the operator explicitly select a call and polls once per second. Only changed final transcript revisions trigger re-evaluation; this avoids paying for intermediate STT revisions.

Selecting or clearing a call cancels older polling and advice. Manual speech/capture is disabled while following a selected session. The viewer reports ended calls and partial coverage. This is a local testable consumer, not proof that production calls are connected.
