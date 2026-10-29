# Instrument samples

Both folders are per-note MP3 renders of General MIDI soundfonts, as pre-rendered and published
by Benjamin Gleitzman in [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts)
(`gh-pages` branch).

| Folder | Soundfont | Source folder | Notes (sounding) | Licence |
|---|---|---|---|---|
| `piano/` | Fluid R3 GM (FluidR3_GM.sf2, by Frank Wen) | `FluidR3_GM/acoustic_grand_piano-mp3/` | F3 – C7 (44 files) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/us/) |
| `alto-sax/` | FatBoy ([fatboy.site](https://fatboy.site)) | `FatBoy/alto_sax-mp3/` | Db3 – A5 (33 files) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

The alto sax set replaced a Fluid R3 one on 2026-10-29, chosen by ear from Fluid R3, Musyng Kite,
FatBoy and a Karoryfer recording. Because it is share-alike, these sample files (and any
adaptation of them) stay under CC BY-SA 3.0; that licence does not extend to the app's code. It
plays back about 8 dB quieter than its predecessor, which `gain` in `js/instruments.js` makes up.

The file names are the source's own: flats spelled `Db`, `Eb`, `Gb`, `Ab`, `Bb`, octave in
scientific notation (`C4` = middle C). `js/audio/sampler.js` relies on that.

The music font in `assets/fonts/` is Bravura 1.482 by Steinberg Media Technologies, under the SIL
Open Font License (`assets/fonts/OFL.txt`).
