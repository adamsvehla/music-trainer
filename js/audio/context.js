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

// Calls fn once the context runs: now, or when a later gesture unlocks it. A resume()
// promise is no use for this: called before any gesture it can settle while the context
// stays suspended. Returns a function that cancels the wait.
export function whenAudioRuns(fn) {
  const c = audioContext();
  if (c.state === 'running') {
    fn();
    return () => {};
  }
  const onChange = () => {
    if (c.state !== 'running') return;
    c.removeEventListener('statechange', onChange);
    fn();
  };
  c.addEventListener('statechange', onChange);
  return () => c.removeEventListener('statechange', onChange);
}
