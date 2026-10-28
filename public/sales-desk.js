import { decide, trackStage, createMemory, markDone, DEFAULT_CONFIG } from './decide.js';
import { PLAYBOOK } from './modes/automotive/playbook.js';
import { createLatestRequest } from './latest-request.js';
import { createLiveCallFollower } from './live-call.js';
import { SCENARIOS, createDemoPlayer } from './demo-session.js';
import { startSession, getCallAudio, getMicAudio } from './capture.js';
import { apiHeaders } from './access.js';
import { createOwnedCapture } from './owned-capture.js';
import { createVoicePractice } from './voice-practice.js';
import { createBrowserSpeaker } from './speech-output.js';
import { prepareSpeech, onModelProgress, browserModel, setBrowserModel } from './transcriber.js';

const $ = id => document.getElementById(id);
const config = { ...DEFAULT_CONFIG, ...PLAYBOOK.config };
const app = { turns: [], memory: createMemory(), answers: null, result: null, source: 'demo', scenario: 'price', requests: 0, health: null };
let capture = null, startingCapture = false, switching = 0;
const ownedCapture = createOwnedCapture(startSession);
let pendingStreams = new Set();
let demoFacts = {};
const signalLabels = { rep_introduced: 'Greet & introduce yourself', needs_known: 'Understand their needs', budget_known: 'Discuss the budget', timeline_known: 'Understand their timing', buyer_involved: 'Know who decides', rep_addressed_question: 'Answer the current question', rep_asked_for_visit: 'Ask for the visit', appointment_agreed: 'Agree on a day & time' };
const objectionLabels = { price: 'Price or value', timing: 'Timing', competitor: 'Another offer', trust: 'History or trust', fit: 'Vehicle fit', authority: 'Another decision maker', none: 'No stated blocker' };

function error(message = '') { $('errorText').textContent = message; $('error').hidden = !message; }
function connection(text, good = false, working = false) {
  $('connectionText').textContent = text;
  $('connectionDot').className = 'dot' + (good ? ' good' : working ? ' working' : '');
}
const request = createLatestRequest({ headers: apiHeaders, onBusy: busy => {
  $('coach').classList.toggle('busy', busy);
  $('coach').setAttribute('aria-busy', String(busy));
} });
function setStatus(text, running = false) {
  $('callStatusText').textContent = text;
  $('callStatus').classList.toggle('running', running);
  $('callStatus').querySelector('.dot').className = 'dot' + (running ? ' good' : '');
}
function renderSignals() {
  $('signals').replaceChildren(...Object.entries(signalLabels).map(([key, label]) => {
    const probability = app.answers?.[key]?.noul;
    const known = probability != null && probability >= .7;
    const unclear = probability != null && probability > .3 && probability < .7;
    const row = document.createElement('div'); row.className = 'signal';
    const name = document.createElement('span'); name.textContent = label;
    const value = document.createElement('span'); value.className = 'signal-value' + (known ? ' known' : unclear ? ' unclear' : '');
    const dot = document.createElement('i'); dot.className = 'dot';
    value.append(dot, document.createTextNode(probability == null ? 'Waiting' : known ? 'Stated' : unclear ? 'Unclear' : 'Not stated'));
    row.append(name, value); return row;
  }));
  const covered = Object.keys(signalLabels).filter(key => (app.answers?.[key]?.noul ?? 0) >= .7).length;
  $('checkpointCount').textContent = app.answers ? covered + ' / ' + Object.keys(signalLabels).length + ' covered' : 'Waiting for context';
  const objection = app.answers?.objection_type;
  $('objection').textContent = !objection ? 'Waiting for context' : objection.confidence < .4 || objection.probabilities?.[objection.choice] < .65 ? 'Not clear yet' : objectionLabels[objection.choice] || 'Not clear yet';
}
function renderTranscript() {
  const nodes = app.turns.map((turn, index) => {
    const li = document.createElement('li'); li.className = 'turn' + (turn.speaker === 'rep' ? ' rep' : '') + (index === app.turns.length - 1 ? ' new' : '');
    const point = document.createElement('i'); point.className = 'speaker-point'; point.setAttribute('aria-hidden', 'true');
    const head = document.createElement('div'); head.className = 'turn-head';
    const name = document.createElement('strong'); name.textContent = turn.speaker === 'rep' ? 'You' : ['demo', 'manual', 'practice', 'practice-review'].includes(app.source) ? SCENARIOS[app.scenario].name : 'Customer';
    const time = document.createElement('span'); time.textContent = turn.at ? new Date(turn.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Demo';
    head.append(name, time); const text = document.createElement('p'); text.textContent = turn.text;
    li.append(point, head, text); return li;
  });
  if (!nodes.length) { const empty = document.createElement('li'); empty.className = 'transcript-empty'; empty.textContent = app.source === 'live' ? 'Waiting for final transcript segments from the selected call.' : 'The conversation will appear here as each person speaks.'; nodes.push(empty); }
  $('transcript').replaceChildren(...nodes);
  $('transcript').scrollTop = $('transcript').scrollHeight;
  $('sessionCount').textContent = app.turns.length + (app.turns.length === 1 ? ' line' : ' lines');
}
function renderAdvice() {
  const r = app.result;
  const alert = PLAYBOOK.alert;
  const alerting = (app.answers?.[alert.signal]?.noul ?? 0) >= alert.min;
  const acting = r?.status === 'act';
  const qualityAnswer = app.answers?.rep_response_quality;
  const unsupported = app.turns.at(-1)?.speaker === 'rep' && qualityAnswer?.choice === 'unsupported' && qualityAnswer.probabilities?.unsupported >= .7;
  const synthetic = ['demo', 'manual', 'practice', 'practice-review'].includes(app.source);
  const referenceAnswer = synthetic ? demoFacts[app.scenario]?.answers?.[r?.action] : null;
  const concern = app.answers?.objection_type?.choice;
  const useReference = referenceAnswer && (r?.action !== 'handle_objection' || (app.scenario === 'price' && ['price','competitor'].includes(concern)) || (app.scenario === 'history' && concern === 'trust'));
  const visitAgreed = (app.answers?.appointment_agreed?.noul ?? 0) >= .7;
  let prompt = useReference ? referenceAnswer : r?.tips?.[0] || 'Run a conversation or add a customer’s words to see what to ask next.';
  if (r?.action === 'book_visit' && visitAgreed) prompt = 'Repeat the exact vehicle, day and time back to the customer. Confirm who is coming and how they can reach you.';
  if (unsupported) prompt = 'Let me correct that: I need to verify the vehicle facts and confirmed terms before quoting them.';
  $('nextAction').textContent = alerting ? alert.title : unsupported ? 'Correct the claim first' : acting ? r.title : r ? 'Give them room to explain' : 'Ready when you are';
  $('suggestion').textContent = alerting ? alert.text : prompt;
  $('probability').hidden = !acting || alerting || unsupported;
  $('coachIdle').hidden = acting && !alerting && !unsupported;
  $('coachIdle').textContent = r ? 'Advisory guidance · you lead the call' : 'Guidance follows the conversation';
  $('done').hidden = !acting || alerting || unsupported;
  if (acting) { $('probabilityText').textContent = Math.round(r.score * 100) + '% model probability'; $('probabilityBar').style.width = Math.round(r.score * 100) + '%'; }
  $('coachNote').textContent = r?.note || '';
  $('coachNote').hidden = !r?.note;
  const extra = r?.tips?.slice(1) || [];
  $('morePrompts').hidden = extra.length === 0;
  $('tips').replaceChildren(...extra.map(tip => { const li = document.createElement('li'); li.textContent = tip; return li; }));
  const quality = app.answers?.rep_response_quality;
  const reply = app.turns.at(-1)?.speaker === 'rep';
  const clearQuality = quality && quality.confidence >= .4 && quality.probabilities?.[quality.choice] >= .65;
  const feedback = { clear: 'Your reply: direct and relevant. Check the facts before using it on a real call.', incomplete: 'Your reply may have missed part of their question. Answer that concern before moving on.', unsupported: 'Check that claim. Use the demo facts, and say you will verify anything that is unknown.' };
  $('replyFeedback').hidden = !reply || !clearQuality || !feedback[quality?.choice];
  $('replyFeedback').textContent = feedback[quality?.choice] || '';
  $('replyFeedback').classList.toggle('warn', quality?.choice === 'unsupported' || quality?.choice === 'incomplete');
  renderSignals();
}
async function evaluate() {
  if (!app.turns.some(turn => turn.speaker === 'customer')) return;
  try {
    const data = await request.run({ mode: 'automotive', turns: app.turns, ...(['demo', 'manual', 'practice', 'practice-review'].includes(app.source) ? { demo_scenario: app.scenario } : {}) });
    if (!data) return;
    error(); app.answers = data.answers; app.requests++;
    app.result = decide(data.answers, PLAYBOOK, app.memory, Date.now(), config);
    const stage = trackStage(data.answers.buying_stage, app.memory.stage, PLAYBOOK.stages, config);
    if (stage) {
      $('stageValue').textContent = stage.label;
      $('stageConfidence').textContent = stage.confidenceLabel || 'Model reading';
      [...$('stageTrack').children].forEach((el, index) => { el.className = index === stage.level ? 'current' : index < stage.level ? 'reached' : ''; });
    }
    $('latency').textContent = data.latency_ms + ' ms'; $('model').textContent = data.model;
    connection('Jev connected', true); renderAdvice();
  } catch (err) { connection('Jev needs attention'); error(err instanceof TypeError ? 'Cannot reach the local coach. Check that npm start is running, then try again.' : err.message); }
}
async function addTurn({ speaker, text, at = 0, speech }) {
  if (Number.isFinite(speech?.latency_ms)) $('speechLatency').textContent = speech.latency_ms + ' ms';
  if (speech?.speech_backend) $('localSpeechLabel').textContent = 'Speech recognition: VoiceClaude · Whisper Turbo · ' + (speech.speech_backend === 'gpu' ? 'GPU' : 'local fallback');
  request.invalidate(); app.turns.push({ speaker, text, at }); renderTranscript(); await evaluate();
}
const player = createDemoPlayer({
  onTurn: addTurn,
  onState(state) {
    $('playLabel').textContent = state.playing ? 'Pause demo' : state.finished ? 'Replay demo' : state.index > 2 ? 'Continue demo' : 'Run demo';
    $('play').querySelector('use').setAttribute('href', state.playing ? '#i-pause' : state.finished ? '#i-replay' : '#i-play');
    $('step').disabled = state.playing || state.finished;
    $('lineCount').textContent = state.index + ' / ' + state.total;
    $('playbackTrack').replaceChildren(...Array.from({ length: state.total }, (_, index) => { const el = document.createElement('i'); el.className = index < state.index ? 'done' : ''; return el; }));
    if (app.source === 'demo') setStatus(state.playing ? 'Demo playing' : state.finished ? 'Demo complete' : state.index > 2 ? 'Demo paused' : 'Demo ready', state.playing);
  },
});
function resetPanels() {
  request.invalidate(); app.turns = []; app.memory = createMemory(); app.answers = null; app.result = null;
  $('stageValue').textContent = 'Let’s hear their story.'; $('stageConfidence').textContent = 'Waiting for context';
  [...$('stageTrack').children].forEach(el => { el.className = ''; });
  $('latency').textContent = '—'; $('speechLatency').textContent = '—'; error(); renderAdvice(); renderTranscript();
}
function setSource(source) {
  app.source = source; const scripted = ['demo', 'manual', 'practice', 'practice-review'].includes(source);
  const practicing = source === 'practice' || source === 'practice-review';
  $('demoBadge').textContent = practicing ? 'Voice practice' : scripted ? 'Interactive demo' : 'Live transcript';
  $('transcriptSource').textContent = practicing ? 'Scripted customer · your live reply' : scripted ? 'Synthetic transcript' : source === 'capture' ? 'Browser call audio' : 'Role-separated transcript';
  $('playback').hidden = !scripted || practicing; $('compose').hidden = !scripted;
  $('practicePanel').hidden = !practicing; $('referencePanel').hidden = !scripted;
  $('liveBanner').hidden = scripted;
  $('captureLabel').textContent = source === 'capture' ? 'Stop capturing' : 'Capture a browser call';
  if (!scripted) { $('customerName').textContent = 'Current call'; $('vehicleName').textContent = 'Vehicle details have not been verified'; $('avatar').textContent = 'C'; }
}
async function stopCapture() {
  capture = null;
  for (const stream of pendingStreams) stream.getTracks().forEach(track => track.stop());
  pendingStreams.clear();
  await voicePractice.stop().catch(() => {});
  await ownedCapture.stop().catch(() => {});
}
const follower = createLiveCallFollower({
  onUpdate(session) {
    if (app.source !== 'live') return;
    const turns = session.segments.map(segment => ({ speaker: segment.speaker === 'staff' ? 'rep' : 'customer', text: segment.text, at: segment.at * 1000 }));
    if (JSON.stringify(turns) !== JSON.stringify(app.turns)) {
      request.invalidate(); app.turns = turns; renderTranscript(); evaluate();
    }
    const partial = session.incomplete || session.truncated || turns.length > 40;
    $('liveStatus').textContent = (session.ended ? 'Call ended.' : 'Following the selected call.') + (partial ? ' Transcript coverage is partial.' : '');
    setStatus(session.ended ? 'Call ended' : 'Connected', !session.ended);
  },
  onError(message) { request.invalidate(); setStatus('Disconnected'); $('liveStatus').textContent = 'Transcript disconnected. ' + message; },
});
async function selectScenario(id, preview = true) {
  const token = ++switching;
  player.pause(); follower.stop(); await stopCapture();
  if (token !== switching) return;
  app.scenario = id; setSource('demo'); resetPanels();
  const scenario = SCENARIOS[id];
  $('speaker').value = 'customer'; $('message').placeholder = '“What’s the total price with all the fees?”';
  renderReference();
  $('customerName').textContent = scenario.name; $('vehicleName').textContent = scenario.vehicle + ' · Synthetic example'; $('avatar').textContent = scenario.name[0];
  document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === id)));
  player.load(scenario);
  if (preview) { await player.step(); if (token === switching) await player.step(); }
}
$('scenarios').addEventListener('click', event => { const button = event.target.closest('[data-scenario]'); if (button) selectScenario(button.dataset.scenario); });
$('play').addEventListener('click', async () => {
  if (player.state().finished) {
    const pending = selectScenario(app.scenario, false), token = switching;
    await pending; if (token !== switching) return;
  }
  player.play();
});
$('step').addEventListener('click', () => player.step());
$('replay').addEventListener('click', () => selectScenario(app.scenario));
$('compose').addEventListener('submit', event => {
  event.preventDefault(); const text = $('message').value.trim(); if (!text) return;
  if (app.source === 'practice') {
    error('Use End practice before typing a reply, so microphone and typed answers stay separate.'); return;
  }
  player.pause(); if (app.source !== 'practice-review') app.source = 'manual'; setStatus('Your test');
  addTurn({ speaker: $('speaker').value, text, at: Date.now() }); $('message').value = '';
});
$('done').addEventListener('click', () => { if (app.result?.status === 'act') { markDone(app.memory, app.result.action); app.result = decide(app.answers, PLAYBOOK, app.memory, Date.now(), config); renderAdvice(); } });
$('retry').addEventListener('click', evaluate);
async function refreshLive() {
  $('followLive').disabled = true;
  try {
    const response = await fetch('/api/live/sessions'); const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The live call feed is unavailable.');
    const sessions = data.sessions.filter(session => !session.ended);
    const options = [Object.assign(document.createElement('option'), { value: '', textContent: 'Choose a call' })];
    for (const session of sessions) options.push(Object.assign(document.createElement('option'), { value: session.session_id, textContent: session.call_id + ' · ' + new Date(session.started_at * 1000).toLocaleTimeString() }));
    $('liveSession').replaceChildren(...options);
    $('liveDialogText').textContent = sessions.length ? 'Choose the exact call to follow. Only final, role-tagged transcript segments are used.' : 'No active call transcripts are available. The production Telnyx feed is not connected to this local demo. You can still run the scenarios or capture a browser call.';
  } catch (err) { $('liveDialogText').textContent = err.message; }
}
$('connectLive').addEventListener('click', () => { $('liveDialog').showModal(); refreshLive(); });
$('closeDialog').addEventListener('click', () => $('liveDialog').close());
$('refreshLive').addEventListener('click', refreshLive);
$('liveSession').addEventListener('change', () => { $('followLive').disabled = !$('liveSession').value; });
$('followLive').addEventListener('click', async () => {
  const id = $('liveSession').value; if (!id) return;
  const token = ++switching; player.pause(); follower.stop(); await stopCapture();
  if (token !== switching) return;
  setSource('live'); resetPanels(); $('liveStatus').textContent = 'Connecting to the selected call…';
  $('liveDialog').close(); follower.start(id);
});
$('disconnectLive').addEventListener('click', () => selectScenario(app.scenario));
$('capture').addEventListener('click', async () => {
  if (startingCapture) return;
  if (capture) { await selectScenario(app.scenario); return; }
  startingCapture = true; $('capture').disabled = true;
  const token = ++switching;
  const streams = [];
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('This browser cannot share call audio. Try Chrome or Edge, or use the scripted demo.');
    const call = await getCallAudio(); streams.push(call); pendingStreams.add(call);
    if (token !== switching) { call.getTracks().forEach(track => track.stop()); pendingStreams.delete(call); return; }
    const mic = await getMicAudio(); streams.push(mic); pendingStreams.add(mic);
    if (token !== switching) { streams.forEach(stream => stream.getTracks().forEach(track => track.stop())); return; }
    player.pause(); follower.stop(); setSource('capture'); resetPanels();
    $('liveStatus').textContent = 'Capturing call audio and your microphone. Everyone on the call should know and agree. Use headphones.';
    setStatus('Capturing', true);
    const session = await ownedCapture.start([{ stream: call, speaker: 'customer' }, { stream: mic, speaker: 'rep', echoOf: 0 }], {
      onText: (speaker, text, speech) => { if (app.source === 'capture') addTurn({ speaker, text, at: Date.now(), speech }); },
      onError: message => { if (app.source === 'capture') error(message); },
      onBehind: count => { if (count) error('Transcription is falling behind. Pause the conversation test or choose a faster speech model.'); },
      onEnded: () => { stopCapture(); request.invalidate(); setStatus('Capture ended'); $('liveStatus').textContent = 'Audio capture ended. The transcript shown is retained for review.'; $('captureLabel').textContent = 'Capture a browser call'; },
    });
    if (token !== switching || app.source !== 'capture') {
      await ownedCapture.stop();
      streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
      return;
    }
    capture = session;
  } catch (err) { streams.forEach(stream => stream.getTracks().forEach(track => track.stop())); if (token === switching) error(err.message || 'Unable to start audio capture.'); }
  finally { streams.forEach(stream => pendingStreams.delete(stream)); startingCapture = false; $('capture').disabled = false; }
});
function renderReference() {
  const reference = demoFacts[app.scenario];
  $('referenceFacts').replaceChildren(...(reference?.facts || []).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
}
const voicePractice = createVoicePractice({
  getMic: getMicAudio, prepareSpeech, startSession, speak: createBrowserSpeaker({ fallbackFor: text => {
    const index = demoFacts[app.scenario]?.questions.indexOf(text) ?? -1;
    return index >= 0 ? '/demo-audio/' + app.scenario + '-' + index + '.wav' : null;
  } }), onTurn: addTurn,
  onState(state) {
    if (!['practice', 'practice-review'].includes(app.source)) return;
    if (state.backend) $('localSpeechLabel').textContent = 'Speech recognition: VoiceClaude · Whisper Turbo · ' + (state.backend === 'gpu' ? 'GPU' : 'local fallback');
    const messages = {
      preparing: app.health?.transcribe === 'voiceclaude' ? 'Connecting to your existing VoiceClaude model. Allow microphone access to continue.' : 'Preparing speech recognition. The first download may take a moment. You can end practice at any time.',
      customer: 'Listen to the customer. Your microphone is paused while the customer speaks.',
      listening: state.spoken ? 'Your microphone is listening. Answer the customer, then pause.' : 'Customer voice playback is unavailable. Read their question above, then answer through your microphone.',
      transcribing: 'Turning your words into text. Pause briefly to finish your reply.',
      unclear: 'No clear reply was transcribed. Speak again, or repeat the customer’s question.',
      reviewing: 'Your reply is being added to the conversation. Check the coach for guidance.',
      feedback: 'Reply captured. Review the coach and checkpoints, then continue or add to your answer.',
      ended: 'Practice ended. Your microphone is off. Review the conversation or start again.',
      error: 'Speech could not start or continue. Your microphone is off. You can retry or type a reply below.',
    };
    const message = messages[state.phase] || '';
    if ($('practiceStatus').textContent !== message) $('practiceStatus').textContent = message;
    $('practiceProgress').textContent = 'Question ' + (state.index + 1) + ' of ' + state.total;
    $('practiceNext').disabled = !state.canAdvance || state.phase === 'ended' || state.phase === 'error';
    $('practiceNext').textContent = state.index === state.total - 1 ? 'Finish practice' : 'Hear next question';
    $('practiceRepeat').disabled = ['preparing', 'customer', 'ended', 'error', 'reviewing', 'transcribing'].includes(state.phase) || state.hearing;
    $('speechModel').disabled = !['ended', 'error'].includes(state.phase);
    $('micLevel').value = ['customer', 'preparing', 'ended', 'error'].includes(state.phase) ? 0 : Math.min(1, Math.max(0, state.level * 12));
    $('practiceStop').textContent = state.phase === 'ended' || state.phase === 'error' ? 'Start again' : 'End practice';
    setStatus(state.phase === 'ended' || state.phase === 'error' ? 'Mic off' : state.phase === 'preparing' ? 'Preparing audio' : state.phase === 'customer' ? 'Customer speaking' : state.hearing ? 'You’re speaking' : 'Mic listening', !['preparing', 'ended', 'error'].includes(state.phase));
    if (state.phase === 'ended' || state.phase === 'error') { setSource('practice-review'); $('micLevel').value = 0; }
  },
  onError(message) { $('practiceStatus').textContent = message + ' Your microphone is off. Retry, or type your reply below.'; error(message); if (!app.turns.length && demoFacts[app.scenario]) addTurn({ speaker: 'customer', text: demoFacts[app.scenario].questions[0] }); },
});
async function startPractice() {
  const reference = demoFacts[app.scenario];
  if (!reference?.questions?.length) { error('Demo questions are unavailable. Refresh and try again.'); return; }
  const token = ++switching; player.pause(); follower.stop(); await stopCapture();
  if (token !== switching) return;
  setSource('practice'); resetPanels(); renderReference();
  $('speaker').value = 'rep'; $('message').placeholder = 'Answer the customer in your own words…';
  $('customerName').textContent = SCENARIOS[app.scenario].name;
  $('vehicleName').textContent = reference.vehicle + ' · Voice practice';
  $('avatar').textContent = SCENARIOS[app.scenario].name[0];
  await voicePractice.start(reference.questions);
}
$('startPractice').addEventListener('click', startPractice);
$('practiceNext').addEventListener('click', () => voicePractice.next());
$('practiceRepeat').addEventListener('click', () => voicePractice.repeat());
$('practiceStop').addEventListener('click', () => { if (voicePractice.isActive()) voicePractice.stop(); else startPractice(); });
$('speechModel').addEventListener('change', () => setBrowserModel($('speechModel').value));
onModelProgress(progress => {
  if (app.source === 'practice' && $('speechModel').disabled && !progress.ready) $('practiceStatus').textContent = 'Loading speech recognition: ' + progress.pct + '%. This download stays cached in your browser.';
});
window.addEventListener('pagehide', () => { ++switching; player.pause(); follower.stop(); request.invalidate(); stopCapture(); });

renderSignals();
try {
  const response = await fetch('/api/health'); app.health = await response.json();
  $('model').textContent = app.health.model;
  $('speechModelControl').hidden = app.health.transcribe !== 'browser';
  $('localSpeechLabel').hidden = app.health.transcribe !== 'voiceclaude';
  connection(app.health.ready ? 'Key configured' : 'Add a TypeSafe key', false);
  if (!app.health.ready && !app.health.hosted) error('Add your TypeSafe key to the private .env file and restart npm start.');
} catch { connection('Coach offline'); error('Start the local server with npm start to connect Jev.'); }
try { demoFacts = await fetch('/demo-facts.json').then(response => response.json()); } catch { error('Demo reference facts could not load. Refresh before starting voice practice.'); }
$('speechModel').value = browserModel();
await selectScenario('price');
