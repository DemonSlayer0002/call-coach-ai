# Sales desk

A focused automotive sales-coaching and spoken-practice demo, forked from [ZeroGold/call-coach-ai](https://github.com/ZeroGold/call-coach-ai). The original main screen has been replaced with a transcript-first sales workspace and real Jev inference.

## Run

Use Node.js 22.9 or newer:

```sh
cp .env.example .env
# Add your TypeSafe key to .env, then:
npm start
```

Open [localhost:3137](http://localhost:3137). The workstation's private configuration is already set up; do not overwrite an existing `.env`. With no configured port, the server defaults to 3000.

The browser demo runs without an npm dependency install. CSS and icons are inline; the typeface is served locally. This workstation now uses the existing VoiceClaude Whisper Turbo service, with its personal GPU route first and local recognition as fallback. It does not load a recognition model in the browser. Optional browser recognition remains available through configuration.

## Try the demo

For the full voice flow, see [Using the demo](docs/USING-THE-DEMO.md). Press **Practice out loud** to hear the scripted customer and answer through your microphone, then review reply feedback and eight call checkpoints. No screen sharing is needed for practice.

- Pick **Price objection**, **Vehicle history**, or **Book a visit**. Each starts with a short synthetic conversation and a real coaching request.
- Press **Run demo** to continue. Pause, advance one line, or restart whenever you want.
- Type a customer's words to test how the coach responds. The speaker selector also accepts a rep's line.
- See one next move, a suggested question, the shopping stage, and whether key qualification topics have been stated. Model probability is shown separately from shopping stage; neither is a measured chance of closing a sale.
- **Connect live call** follows a selected role-tagged transcript session when a producer is connected. **Capture a browser call** uses shared call audio and a microphone, subject to browser support and permissions.

Scripted customers and vehicles are examples, not dealership inventory or actual calls. Jev chooses among structured options; wording comes from curated playbooks. The assistant does not confirm inventory, quote unverified financing terms, write CRM records, or contact customers.

## Verify

```sh
npm test
npm run check-modes
npm run check-demo
```

These checks make no paid requests. GitHub Actions runs them on pushes and PRs.

Explicit paid synthetic checks, using your private TypeSafe key:

```sh
npm run eval:live  # 16 labeled development cases; server not required
npm run demo:live  # All three demo scripts through the running local server
npm run eval:practice # Verified facts, reply feedback and appointment agreement
```

Recorded evidence lives in `docs/synthetic-evaluation.json`, `docs/synthetic-http-smoke.json`, `docs/demo-smoke.json`, `docs/practice-evaluation.json`, and `docs/speech-smoke.json`. These are synthetic development checks, not independent real-call accuracy or acoustic acceptance. Browser visual acceptance remains a separate check.

## Integration

The local transcript adapter accepts authenticated `session_start`, role-tagged `segment`, and `session_end` events. It separates customer/staff roles, ignores interim revisions, deduplicates finals, reports coverage gaps and keeps bounded, expiring state in memory.

The existing phone-system producer is not connected to this demo. Restoring a missing production ingest route and conducting a real call test require a separate native rollout. See [the adapter contract](docs/LIVE-TRANSCRIPTS.md) and [implementation notes](docs/FORK-NOTES.md).

`.env` stays out of Git. Use a distinct local ingest token; never copy production credentials into this repository.

## License

MIT. The upstream license and attribution are retained in [LICENSE](LICENSE). This fork independently implements the additional coaching and transcript behaviors; it does not include private dealership modules or customer records.
