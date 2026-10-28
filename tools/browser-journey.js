async page => {
  await page.unroute('**/api/speech/health');
  await page.unroute('**/api/speech/prepare');
  await page.goto('http://localhost:3137');
  await page.waitForFunction(() => document.querySelector('#startPractice') && document.querySelector('#connectionText').textContent === 'Jev connected');
  const results = [];
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied for test', 'NotAllowedError'); };
  });
  await page.locator('#startPractice').click();
  await page.waitForFunction(() => document.querySelector('#practiceStatus').textContent.includes('site permissions'));
  results.push({check:'permission_denied_recovery',passed:await page.locator('#practiceStop').textContent()==='Start again'});
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext({sampleRate:16000}); await ctx.resume();
      const output = ctx.createMediaStreamDestination();
      const track = output.stream.getAudioTracks()[0]; const stop = track.stop.bind(track);
      track.stop = () => { stop(); if(ctx.state!=='closed')ctx.close().catch(()=>{}); };
      window.__testTrack = track;
      (window.__testTracks ??= []).push(track);
      window.__playTestReply = async () => {
        const response = await fetch('/demo-audio/price-0.wav');
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(output);source.start();
      };
      return output.stream;
    };
  });
  await page.route('**/api/speech/prepare', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Recognizer disconnected for test.'})}));
  await page.locator('#practiceStop').click();
  await page.waitForFunction(() => document.querySelector('#practiceStatus').textContent.includes('Recognizer disconnected'));
  results.push({check:'speech_unavailable_stops_mic',passed:await page.evaluate(()=>window.__testTrack.readyState==='ended')});
  await page.unroute('**/api/speech/prepare');
  let loadingRoute;
  await page.route('**/api/speech/prepare', route=>{loadingRoute=route;});
  const loading=page.waitForRequest('**/api/speech/prepare');
  await page.locator('#practiceStop').click();await loading;
  await page.locator('#practiceStop').click();
  results.push({check:'stop_during_loading_ends_track',passed:await page.evaluate(()=>window.__testTrack.readyState==='ended')});
  await loadingRoute.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true,warmed:true,backend:'gpu'})}).catch(()=>{});
  await page.unroute('**/api/speech/prepare');
  await page.locator('#practiceStop').click();
  await page.waitForFunction(() => document.querySelector('#practiceStatus').textContent.includes('microphone is listening'),{},{timeout:60000});
  await page.evaluate(()=>window.__playTestReply());
  await page.waitForFunction(() => document.querySelector('#micLevel').value>0,{},{timeout:10000});
  results.push({check:'real_audio_worklet_meter',passed:true});
  await page.waitForFunction(() => !document.querySelector('#practiceNext').disabled,{},{timeout:60000});
  const transcriptCount = await page.locator('#transcript li').count();
  const speechLatency = await page.locator('#speechLatency').textContent();
  results.push({check:'synthetic_audio_to_gpu_to_jev_to_cue',passed:transcriptCount===2 && speechLatency!=='—',transcript_lines:transcriptCount,speech_latency:speechLatency});
  await page.locator('#practiceNext').click();
  await page.waitForFunction(() => document.querySelector('#practiceProgress').textContent.includes('2 of 4'));
  results.push({check:'advance_after_captured_reply',passed:true});
  const practiceTrackEndedBeforeSwitch = await page.evaluate(()=>window.__testTrack.readyState==='ended');
  await page.evaluate(()=>{ navigator.mediaDevices.getDisplayMedia = () => navigator.mediaDevices.getUserMedia(); });
  await page.locator('#capture').click();
  await page.waitForFunction(()=>document.querySelector('#transcriptSource').textContent==='Browser call audio');
  results.push({check:'capture_switch_stops_practice_owner',passed:!practiceTrackEndedBeforeSwitch && await page.evaluate(()=>window.__testTracks.slice(0,-2).every(track=>track.readyState==='ended'))});
  results.push({check:'device_locked_during_capture',passed:await page.locator('#microphoneDevice').isDisabled()});
  await page.locator('#capture').click();
  results.push({check:'stop_ends_track',passed:await page.evaluate(()=>window.__testTracks.every(track=>track.readyState==='ended'))});
  const downloadPromise=page.waitForEvent('download');await page.locator('#diagnosticDownload').click();
  await (await downloadPromise).saveAs('/tmp/jev-browser-diagnostics.json');
  // Isolate this race so the five-second health deadline is respected.
  let delayedHealth;
  await page.route('**/api/speech/health', route=>{delayedHealth=route;});
  await page.goto('http://localhost:3137');
  await page.waitForFunction(()=>document.querySelector('#connectionText')?.textContent==='Jev connected');
  await page.evaluate(()=>{
    navigator.mediaDevices.getUserMedia=async()=>{
      const ctx=new AudioContext({sampleRate:16000});await ctx.resume();
      const output=ctx.createMediaStreamDestination();const track=output.stream.getAudioTracks()[0];const stop=track.stop.bind(track);
      track.stop=()=>{stop();if(ctx.state!=='closed')ctx.close().catch(()=>{});};return output.stream;
    };
    navigator.mediaDevices.getDisplayMedia=()=>navigator.mediaDevices.getUserMedia();
  });
  await page.locator('#capture').click();
  await page.waitForFunction(()=>document.querySelector('#transcriptSource').textContent==='Browser call audio');
  const healthResponse=page.waitForResponse('**/api/speech/health',{timeout:5000});
  await delayedHealth.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:true,backend:'gpu'})});
  await (await healthResponse).finished();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  results.push({check:'late_health_cannot_overwrite_active_capture',passed:(await page.locator('#speechReadiness').textContent()).includes('capture active')});
  await page.locator('#capture').click();await page.unroute('**/api/speech/health');
  await page.setViewportSize({width:390,height:844});
  results.push({check:'mobile_no_horizontal_overflow',passed:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)});
  results.push({check:'no_browser_runtime_errors',passed:errors.length===0,errors});
  await page.screenshot({path:'/tmp/jev-browser-mobile.png',fullPage:true});
  if(results.some(result=>!result.passed)) throw new Error(JSON.stringify(results));
  return {at:new Date().toISOString(),scope:'real Chromium with synthetic WebAudio microphone; actual AudioWorklet, local GPU and Jev; no physical microphone or audibility proof',results};
}
