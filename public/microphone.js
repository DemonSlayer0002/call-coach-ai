// Device IDs stay in page memory and never enter exported diagnostics or storage.
export function createMicrophoneSelection({ media = navigator.mediaDevices, select, isActive, onDisconnected = () => {} }) {
  let selected = '', serial = 0;
  async function refresh() {
    const revision = ++serial;
    if (!media?.enumerateDevices) return;
    const inputs = (await media.enumerateDevices()).filter(device => device.kind === 'audioinput');
    if (revision !== serial) return;
    const missing = selected && !inputs.some(device => device.deviceId === selected);
    select.replaceChildren(new Option('System default microphone', ''), ...inputs.filter(device => device.deviceId && device.deviceId !== 'default').map((device, index) => new Option(device.label || 'Microphone ' + (index + 1), device.deviceId)));
    if (missing) { selected = ''; if (isActive()) await onDisconnected(); }
    select.value = selected;
  }
  select.addEventListener('change', () => { if (!isActive()) selected = select.value; else select.value = selected; });
  media?.addEventListener?.('devicechange', () => refresh().catch(() => {}));
  return { refresh, selected: () => selected };
}
