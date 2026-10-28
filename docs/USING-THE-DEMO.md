# Use the sales-coaching demo

Open **http://localhost:3137** in Chrome or Edge on this workstation. The key is already configured privately. If the app is not running, open a terminal in this repository and run `npm start`.

## Practice a call with your voice

1. Pick **Price objection**, **Vehicle history**, or **Book a visit**.
2. Open **Demo facts you can use**. These are the approved sample facts for that exercise, not actual dealership inventory or prices.
3. Choose your microphone under **Audio setup** and use **Check customer audio** to test your headphones. Press **Practice out loud** and allow microphone access. Setup tests VoiceClaude with a synthetic speech phrase before opening the exercise; service availability and a passed speech test are shown separately. No screen share or phone call is required. Wait for the listening message.
4. Hear the customer's question, then answer naturally. Pause briefly when finished. Your words appear as the rep's transcript, and Jev updates the suggested next move, reply feedback and checkpoints.
5. Review the guidance. You can add more to your answer. When the reply is transcribed, press **Hear next question**. Use **Repeat question** if needed.
6. Finish the last answer and press **Finish practice**, or use **End practice** at any time. The microphone is turned off and the transcript stays visible for review.

Customer playback prefers an installed browser/OS voice, with bundled synthesized customer clips as a fallback. If the browser blocks audio playback, the question remains visible and the microphone exercise still works. Headphones help keep speaker sound out of your microphone. The microphone is muted while the scripted customer voice plays.

This workstation uses VoiceClaude Whisper large-v3-turbo on the personal GPU, with the working local Turbo service as fallback. The recognition source and measured speech latency are visible. The speech dropdown appears only when optional browser-model recognition is configured.

If transcription gets a word wrong, end practice and add a correction in the text field, with **Sales rep speaking** selected. The keyboard path is also a complete fallback if microphone access is blocked. Speech setup errors now appear beside the microphone controls with their underlying message. The visible error explains provider or speech failures; use **Try again** for a failed coaching request.

## What the coach checks

- Greet and introduce yourself or the dealership.
- Understand the customer's vehicle needs.
- Discuss the customer's budget.
- Understand purchase timing.
- Know who is involved in the decision.
- Address the customer's current question directly, including saying what must be verified.
- Ask for a visit or test drive.
- Agree on a specific day and time with the customer.

**Stated**, **Not stated**, and **Unclear** are the model's readings of the transcript. They are not a staff performance grade. The current-question checkpoint can change when the customer asks a new question. The coach currently uses the latest 40 turns; it does not promise full-call memory.

The rep-reply feedback distinguishes a direct answer, an incomplete answer, and a claim that conflicts with the exercise's reference facts. It also flags unverified financing guarantees. On real calls without a reference source, it cannot independently verify arbitrary vehicle/pricing claims.

An agreed appointment in this demo is a conversation checkpoint. It does **not** create a calendar or CRM booking. A shopping stage is not a sale probability.

## Watch instead of speaking

**Run demo** plays the prewritten conversation through real Jev inference. Pause, advance one line, restart, or type your own customer/rep line. The three exercises are clearly marked as synthetic.

## Real call options

**Capture a browser call** is a separate experimental path for a call running in a browser. It requests call/tab audio and microphone permissions, uses separate role lanes and requires audio sharing support. It does not automatically capture desk-phone calls.

**Connect live call** follows a selected session from the authenticated transcript bridge. The existing production Telnyx producer has not been connected to this local demo. Its missing production ingest route needs a separate governed fix and a bounded real-call test.

## Verification limits

The updated demo was rendered and exercised in Chromium with synthetic WebAudio microphone input, the actual AudioWorklet, the running GPU service and real Jev inference. Permission refusal, disconnected recognition, reply capture, question advancement and stop were exercised. Desktop and mobile layouts were inspected. See [the browser receipt](browser-journey-receipt.json).

Physical microphone pickup, whether you actually hear playback, optional browser WebGPU/WASM recognition, and a production phone call still require their own checks. The synthetic browser run does not establish real-call accuracy or latency percentiles.

Use **Download diagnostics** after a problem. Its bounded report contains setup states, random session ID, segment numbers, timing and coded microphone failures. It excludes audio, transcript text, keys, device names and device identifiers. No diagnostic upload is automatic. Last-voice-to-cue timing is explicitly an estimate from worklet frame silence and browser presentation timing; physical device latency is unmeasured.

To repeat the automated browser journey with the Playwright CLI installed and this local server running:

```sh
playwright-cli -s=jev-acceptance open http://localhost:3137
playwright-cli -s=jev-acceptance --raw run-code --filename=tools/browser-journey.js
playwright-cli -s=jev-acceptance close
```

This uses simulated microphone input and paid synthetic inference. It replaces microphone methods only inside its isolated browser page. It writes screenshots and sanitized diagnostics under `/tmp`, and exits with an error if a journey check fails.
