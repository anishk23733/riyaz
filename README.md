# Riyaz

A small offline web app for Hindustani music practice: swara pads for any raga, harmonium with meend, and a tanpura tuned to your Sa.

Open it at **https://anishk23733.github.io/riyaz/** — on iPhone, open in Safari and use Share → Add to Home Screen. After the first load it works fully offline.

## What's in it

- **Pads** show only the chosen raga's swaras, from mandra to taar (plus an octave). Ragas that use both forms of a swara (m/M, n/N…) get a split pad: higher form on top.
- **Meend**: slide between pads; the pitch glides along the raga's notes and settles exactly on a note when you pause. Fast slides become crisp taans.
- **Tanpura**: generated in the browser, tuned to your Sa, strings set from the raga (changeable).
- **Raga browser**: ragas grouped by thaat, with aaroh, avaroh, pakad, key phrases, rules, vadi/samvadi. Data lives in `ragas.js` — edit freely. Entries marked `check: true` were written from memory and are worth verifying.

Notation: lowercase = komal (and `m` = shuddh Ma), uppercase = shuddha (and `M` = tivra Ma); dot below = mandra, dot above = taar.

## Credits

Harmonium samples: recorded at the Euterpea Studio, Yale University, by Donya Quick —
[Freesound #330410](https://freesound.org/people/donyaquick/sounds/330410/) (CC0).
Cut into single notes by Nicholas Brosowsky in
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
([CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)).
For this app the notes were resampled, loudness-matched and given seamless loop points (files in `harmonium/`).
