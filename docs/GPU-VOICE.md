# Personal GPU speech path

The workstation uses the existing VoiceClaude system, not a new cloud transcription account:

```text
Browser microphone
  → demo's local PCM endpoint
  → existing authenticated SSH tunnel
  → personal Whisper large-v3-turbo CUDA worker
  → Jev typed coaching
```

The existing local whisper.cpp Turbo endpoint remains fallback. The browser never chooses or supplies provider URLs. Configure `TRANSCRIBE=voiceclaude`, `VOICECLAUDE_GPU_URL` and `VOICECLAUDE_URL` privately in `.env`.

## Activation receipt

The dedicated personal worker was stopped by its existing gaming-mode condition. At the user's explicit request to bring GPU voice up, the existing enable flag was restored, the existing personal user service was enabled/started, and user lingering was enabled so it can survive SSH logout. The gaming condition itself, loopback binding and `NoNewPrivileges` were preserved. No business recognizer was stopped or reconfigured.

The application does not start or control GPU services. Service activation is a separate workstation operation. Other enabled GPU workers may share memory; the observed idle snapshot did not establish compute contention.

## Measured performance

See `gpu-speech-benchmark.json` for the three warm synthetic trials. They retained the correct vehicle, $23,800 price, and 10 am visit request. Warm inference was 282–300 ms; complete tunneled requests were 517–631 ms. The first cold request took 10.77 seconds inside inference. These samples do not prove microphone, end-of-speech, network-tail or real-call latency.

Jev is already approximately a tenth of a second on the authored sales regression cases. Speech timing and Jev timing are displayed separately so a slow recognizer is not mistaken for slow reasoning. Listening feedback is immediate; recommendations require a committed transcript. Partial speech is not presented as a confirmed booking or fact.

The GPU service uses its existing quality settings. No beam reduction or premature word chopping was introduced to manufacture a better timing number.

## Recovery

A busy GPU returns immediate local fallback. An unavailable/slow GPU triggers bounded fallback and cooldown rather than repeated connection waits. The actual backend is shown in the practice panel. Errors retain a retryable microphone-off state, with the underlying message displayed inline.

After a backend change, reload the browser page before restarting practice. Physical microphone and browser acceptance still need the operator's check.
