# CLAUDE.md — music-trainer (Notový trenažér)

A browser-only practice tool for reading and hearing notes in the treble clef, for its owner's
piano and alto sax practice, used on a phone or tablet at the instrument. Live at
<https://adamsvehla.github.io/music-trainer/>. Plain ES modules, no framework, no build step, no
runtime dependencies, no backend: the repository root *is* the site. [README.md](README.md) is the
user-facing account; this file is the working one.

This is its own git repository, unrelated to the `kruhac` / `room4fitness` apps described by the
workspace `CLAUDE.md` one level up, and none of that file's cross-repo rules apply here.

## Run and test

```bash
npm start
```

serves the folder on <http://127.0.0.1:8095/> through [scripts/serve.mjs](scripts/serve.mjs); the
preview tooling knows it as `music-trainer` ([.claude/launch.json](.claude/launch.json)). Not
`python -m http.server`: on Windows it takes MIME types from the registry, which often maps `.js` to
`text/plain`, and browsers refuse to run module scripts served that way.

```bash
npm test
```

runs `node --test tests/` against the pure modules (no DOM). Keep logic that can be pure in pure
modules (`notes`, `keysig`, `selection`, `intervals`, `judge`, `quiz`, `settings`, `audio/pitch`,
the geometry half of `staff`) so it stays testable this way.

## Rules that hold everywhere

- **UI is Czech, with Czech note names:** H is B natural, B is B♭, accidentals are Cis/Des/Es/As…,
  octaves are written c¹ = C4 (`czName`, `czLabel`, `parseCz` in `notes.js`). Internally a note is
  `{ letter 0–6 = C D E F G A B, acc −1/0/1, octave }` with ids like `F#4`, never shown. Code,
  comments, commit messages and docs are English.
- **Written versus sounding pitch.** The staff, the answers and the tuner are always in *written*
  pitch, what the player reads. Audio is always *sounding*: `written + instrument.transpose`
  (alto sax −9). The microphone's pitch is converted back before anything judges it. Mixing the two
  is the bug to look for whenever the sax behaves differently from the piano.
- **Relative paths only.** The site lives under `/music-trainer/`, so a root-absolute `/js/…` would
  break the live copy while working locally.
- **Every push to `master` deploys publicly** (GitHub Pages, branch `master`, folder `/`,
  `.nojekyll` so nothing goes through Jekyll). Commits go straight to `master` at the owner's
  choice; commit and push only when asked. The repository is public, and its history was rewritten
  before the first push to carry only the GitHub noreply address, which the repository-local
  `user.email` is set to. Never commit under any other address.
- **Settings live in localStorage** under `music-trainer:v1`. `loadSettings()` validates every
  field and falls back to defaults, because storage can hold anything an older version wrote, or
  throw. A new setting needs its validation there and a test in `tests/settings.test.js`. The
  settings dialog saves on every change (`onChange`), not on close, so a reload or a phone killing
  the tab loses nothing.

## How it is put together

| Where | What |
|---|---|
| `js/main.js` | Boot, tabs, score, the settings dialog. `GROUPS` (in `settings.js`) are the header tabs; a group with several modes shows them as tabs on the staff card and remembers the last one (`settings.lastModes`). |
| `js/modes/*.js` | One module per mode, `start(ctx) → stop()`; switching or changing settings stops it and starts afresh. `read`, `play` (both Hraní variants, `prompt` 'staff' or 'ear'), `ear` (Poslech · Nota), `direction` (Nahoru / dolů), `intervals`. `reference.js` is shared: the reference c¹ column on the staff, and a prompter that plays notes and knows when they have fallen silent. |
| `js/staff.js` | SVG staff in the Bravura SMuFL font; pure geometry plus `render()` and `stepAtPoint()`. |
| `js/notes.js`, `keysig.js`, `selection.js`, `intervals.js` | Note model and Czech names; key signatures and which accidentals a row needs; keys and regions for quick note selection; note pairs, interval names and interval spelling. |
| `js/audio/` | One AudioContext (`context.js`), the sampler, YIN pitch detection, the microphone listener. |
| `js/judge.js` | When a heard note counts as right or wrong (hold times, clarity, re-arming). |
| `assets/` | Bravura font, per-note MP3s; sources and licences in `assets/samples/ATTRIBUTION.md`. |

## Traps worth knowing before touching things

- **Bravura glyphs are private-use code points** (`''` and friends written literally). Tool
  output shows them as empty strings, so a line holding one looks like `glyph: ''`. Never retype
  such a line in an edit; change the lines around it, or use the `\u` escape.
- **Build DOM with `h()` and `append()` from `dom.js`**, never the native `append()` with a
  `cond && el` argument: the native one prints `false` as text. That shipped once.
- **The staff reads a row of notes as one bar** (`accidentalsToDraw`): an accidental holds for its
  line or space, a departure from the key signature gets its accidental or a natural. Only single
  sharps and flats are drawn, so spelling that would need a double one falls back to the everyday
  spelling (`spellInterval`). The picker offers no Eis, His, Ces or Fes, which is why keys stop at
  five sharps or flats.
- **Audio before a gesture.** Browsers keep the AudioContext suspended until a tap or key press;
  `main.js` resumes it on the first one. To start sound "as soon as allowed", use
  `whenAudioRuns()` (the context's `statechange`); a `resume()` called before any gesture can
  settle while the context is still suspended. The in-app browser pane may not enforce this at all,
  so it will not catch a regression here.
- **The microphone hears the app.** Echo cancellation, noise suppression and auto gain are off on
  purpose (they treat a sustained tone as noise), so a mode that plays a prompt must ignore the
  microphone until `prompter.endsAt` plus a tail (Hraní podle sluchu does this).
- **The listener runs on `setInterval`, not `requestAnimationFrame`**, because rAF drops to a few
  frames a second whenever the page is not in front, which starves the judge's hold times.
- **Detection thresholds are tuned on samples, not yet on real instruments:** the noise gate
  (`DEFAULTS.minRms` in `audio/pitch.js`, low because piano notes decay fast while staying
  perfectly clear) and `JUDGE_DEFAULTS` in `judge.js`. Expect to adjust them after real use; noise
  is rejected by the clarity checks, not by the gate.
- **Samples.** Piano: Fluid R3 GM (CC BY 3.0). Alto sax: FatBoy (CC BY-SA 3.0), chosen by ear from
  four sets, and about 8 dB quieter than the rest, which `gain` in `instruments.js` makes up.
  `sampler.play()` takes the instrument (for its gain), `load()`/`preload()` take its folder. File
  names are the source's own, flats spelled `Db`, `Eb`, `Gb`, `Ab`, `Bb`.
- **iOS:** the ring/silent switch mutes Web Audio, and Safari may turn playback down while the
  microphone is on. Neither is verified on a device yet.

## Verifying without ears

Nobody working here can hear the output, so measure it:

- **What plays and when:** patch `AudioBufferSourceNode.prototype.start` in the page and compare
  `this.buffer` with `sampler.load(...)` results, or tap `sampler.output()` with an `AnalyserNode`
  for levels.
- **Pitch of a sample:** decode it and run `detectPitch()` on slices.
- **The microphone modes:** `?sim` on the URL replaces the microphone with the sampler's output and
  adds "Simulovat správný / vedlejší tón" buttons, so both Hraní modes can be driven end to end.
- **Layout:** the browser pane scales emulated phone sizes down, so measure (`scrollWidth` against
  `innerWidth`, button widths) at 375, 360 and 320 px rather than judging screenshots.
- Clear `localStorage` after testing in the pane, or the next check runs on leftover settings.
