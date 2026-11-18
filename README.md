# Riyaz

A small offline web app for Hindustani music practice: swara pads for any raga, harmonium with meend, and a tanpura tuned to your Sa.

Open it at **https://anishk23733.github.io/riyaz/** — on iPhone, open in Safari and use Share → Add to Home Screen. After the first load it works fully offline.

## What's in it

- **Pads** show only the chosen raga's swaras, from mandra to taar (plus an octave). Ragas that use both forms of a swara (m/M, n/N…) get a split pad: higher form on top.
- **Meend**: slide between pads; the pitch glides along the raga's notes and locks exactly onto a note when you slow down. Holding a note and pressing any other pad pulls the held note there and back (Settings can make the second finger play its own note instead). Quick taps are kept audible for fast taans.
- **Tanpura**: real recorded string plucks, pitch-shifted exactly to your Sa, strings set from the raga (changeable). A generated tanpura stands in while the recordings load.
- **Raga browser**: ragas grouped by thaat, with aaroh, avaroh, pakad, key phrases, rules, vadi/samvadi. Data lives in `ragas.js` — edit freely. Entries marked `check: true` were written from memory and are worth verifying.

Notation: lowercase = komal (and `m` = shuddh Ma), uppercase = shuddha (and `M` = tivra Ma); dot below = mandra, dot above = taar.

## Credits

Harmonium samples: recorded at the Euterpea Studio, Yale University, by Donya Quick —
[Freesound #330410](https://freesound.org/people/donyaquick/sounds/330410/) (CC0).
Cut into single notes by Nicholas Brosowsky in
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
([CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)).
For this app the notes were resampled, loudness-matched and given seamless loop points (files in `harmonium/`).

Tanpura samples: single string plucks recorded by luckylittleraven —
[Freesound pack 23512](https://freesound.org/people/luckylittleraven/packs/23512/) (CC0):
[#416597](https://freesound.org/people/luckylittleraven/sounds/416597/) (low C♯),
[#416598](https://freesound.org/people/luckylittleraven/sounds/416598/) (G♯),
[#416606](https://freesound.org/people/luckylittleraven/sounds/416606/) (A♯),
[#416605](https://freesound.org/people/luckylittleraven/sounds/416605/) (C♯).
For this app each pluck was trimmed, cleaned of sympathetic-string ringing and hiss between its harmonics,
resampled to 32 kHz mono, loudness-matched and faded out; its exact pitch was measured from its harmonics
so it can be retuned precisely (files in `tanpura/`).
