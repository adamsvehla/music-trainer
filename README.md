# Notový trenažér

A browser-only practice tool for reading music in the treble clef. Plain ES modules, no framework,
no build step, no server-side code: it is a folder of static files.

**Modes** (the UI is Czech, with Czech note names: H = B natural, B = B♭, Cis/Es/As…):

- **Čtení:** a note appears and you name it. With no accidentals in your selection one key press
  answers (`C D E F G A H`). With accidentals you type the name (`fis`, `es`, `b`): a name that
  cannot grow any longer submits by itself, otherwise press Enter. On a touch screen use the
  buttons.
- **Hraní podle not:** a note appears, you play it, and the microphone decides. A small tuner
  shows what it hears, in the *written* pitch of the selected instrument.
- **Hraní podle sluchu:** the app plays a note and you play it back. An optional reference c¹
  plays first. The staff shows the note once you have got it, or once you skip it. The microphone
  ignores everything until the app's own sound has died away, because echo cancellation is off
  for the sake of musical tones.
- **Poslech:** the app plays a note and you click its line or space on the staff. On a touch
  screen you tap once to place it and tap again to confirm. An optional reference c¹ plays first.

**Settings** (the sliders button) cover the instrument (piano, or alto sax in E♭), the clef (treble
for now) and exactly which notes to practise. For a quick selection you pick a key and a region:
- **Keys:** C dur to H dur and Des dur, i.e. up to five ♯ or ♭, or chromatic.
- **Regions:** on the staff, lines, spaces, below, above, or the whole range.

The app then selects that key's notes in that region, spelled as the key spells them. You can
still toggle single notes afterwards. Everything is saved in the browser's localStorage.

**Key signature.** By default the staff shows the chosen key's signature, so notes in the key
appear without their own accidentals. Reading then means reading the signature: a bare note on the
F line in G dur is Fis. Notes outside the key get their accidental, or ♮.
- **Poslech:** a click means the note as written. The ♭/♮/♯ buttons override that for one answer.
- **Turning it off:** a switch in the settings goes back to printing every accidental at the note.

## Running locally

```bash
npm start
```

That serves the folder on <http://127.0.0.1:8095/> using `scripts/serve.mjs`, a small Node server
with no dependencies. Any static server works as long as it sends `.js` as JavaScript.
Python's `http.server` on Windows often doesn't, because it takes MIME types from the registry.

To try it from a phone on the same network, run `node scripts/serve.mjs --host 0.0.0.0`. Over
plain `http://<lan-ip>` the reading and listening modes work, but **the microphone does not**:
browsers only allow it on HTTPS or localhost.

## Tests

```bash
npm test
```

The tests use Node's built-in runner and cover:
- the note model and Czech naming;
- the alto sax transposition;
- staff geometry (ledger lines, step ↔ y);
- the YIN pitch detector, on synthesised tones including a sax-like weak fundamental;
- the timing rules that decide a played note is right or wrong;
- settings persistence.

`?sim` on the URL replaces the microphone in both Hraní modes with the app's own sampler. Two extra
buttons then play the correct note or the one beside it into the detector, so that mode can be
checked end to end without an instrument.

## How the pieces fit

| File | What it does |
|---|---|
| `js/notes.js` | Note model (`{letter, acc, octave}`), MIDI and staff-step maths, Czech names and parsing |
| `js/instruments.js` | Instrument table: written range and transposition (alto sax: −9) |
| `js/clefs.js` | Clef table: glyph, anchor, bottom-line step. A bass clef is one more row |
| `js/staff.js` | SVG staff drawn with the Bravura SMuFL font; pointer → step hit-testing |
| `js/judge.js` | Decides when a heard note counts: right after 120 ms, wrong after 300 ms |
| `js/audio/pitch.js` | YIN pitch detection |
| `js/audio/listener.js` | Microphone → analyser → detector, ~40 times a second |
| `js/audio/sampler.js` | Per-note MP3 playback |
| `js/modes/*.js` | The three modes. Each is `start(ctx) → stop()` |
| `js/picker.js` | The settings dialog |

**Transposition.** The staff always shows the **written** pitch, and audio is always **sounding**
pitch (`written + transpose`). A written c² on the alto sax plays back as es¹, and a sounding es¹
from the microphone counts as c².

**Tuning detection.** The thresholds are constants at the top of their files, so they can be tuned
after trying a real instrument:
- `JUDGE_DEFAULTS` in `js/judge.js`: hold times and minimum clarity.
- `DEFAULTS.minRms` in `js/audio/pitch.js`: the noise gate.

## Deploying

The app is the folder as it stands: `index.html`, `css/`, `js/`, `assets/`. Everything else
(`scripts/`, `tests/`, `package.json`) is development-only. Every path is relative, so it can live
in a subfolder. Any HTTPS static host will do (GitHub Pages, or a folder on existing web hosting);
HTTPS is what makes the microphone available on a phone or tablet.

## Known limits

- **iOS:** the ring/silent switch mutes Web Audio, so the Poslech mode is silent with it on.
- **Pitch detection:** it expects one note at a time. Chords, or a piano with the sustain pedal
  smearing notes together, will confuse it.

## Credits

- **Music font:** [Bravura](https://github.com/steinbergmedia/bravura) 1.482 by Steinberg, under
  the SIL Open Font License (`assets/fonts/OFL.txt`).
- **Samples:** rendered per note by
  [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts). The piano is the
  Fluid R3 GM SoundFont (CC BY 3.0) and the alto sax is the FatBoy soundfont (CC BY-SA 3.0).
  See `assets/samples/ATTRIBUTION.md`.
