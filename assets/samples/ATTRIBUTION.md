# Instrument samples

Both folders are per-note MP3 renders of the **Fluid R3 General MIDI SoundFont** (FluidR3_GM.sf2,
by Frank Wen), as pre-rendered and published by Benjamin Gleitzman in
[gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (`gh-pages` branch,
`FluidR3_GM/`).

They are licensed under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/us/).

| Folder | Source instrument | Notes (sounding) |
|---|---|---|
| `piano/` | `acoustic_grand_piano-mp3/` | F3 – C7 (44 files) |
| `alto-sax/` | `alto_sax-mp3/` | Db3 – A5 (33 files) |

The file names are the source's own: flats spelled `Db`, `Eb`, `Gb`, `Ab`, `Bb`, octave in
scientific notation (`C4` = middle C). `js/audio/sampler.js` relies on that.

The music font in `assets/fonts/` is Bravura 1.482 by Steinberg Media Technologies, under the SIL
Open Font License (`assets/fonts/OFL.txt`).
