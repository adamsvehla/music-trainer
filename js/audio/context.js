// One AudioContext for the whole app.
//
// Browsers start a context suspended until a user gesture; iOS Safari will not play a
// sound at all until resume() has been called from inside one. main.js calls
// unlockAudio() on the first pointer or key press, and the modes check audioRunning()
// before relying on sound starting by itself.

let ctx = null;

export function audioContext() {
  if (!ctx) {
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    ctx = new Ctor({ latencyHint: 'interactive' });
  }
  return ctx;
}

export function unlockAudio() {
  const c = audioContext();
  return c.state === 'running' ? Promise.resolve() : c.resume().catch(() => {});
}

export function audioRunning() {
  return ctx?.state === 'running';
}
