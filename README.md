# Riyaz

A small offline web app for Hindustani music practice: swara pads for any raga, harmonium with meend, and a tanpura tuned to your Sa.

Open it at **https://anishk23733.github.io/riyaz/** — on iPhone, open in Safari and use Share → Add to Home Screen. After the first load it works fully offline.

## What's in it

- **Pads** show only the chosen raga's swaras, from mandra to taar (plus an octave). Ragas that use both forms of a swara (m/M, n/N…) get a split pad: higher form on top.
- **Meend**: slide slowly between pads and the pitch glides along the raga's notes, locking exactly onto a note when you slow down; a quick swipe steps through the notes instead (grace notes, as a harmonium player would). Settings > Steps turns gliding off everywhere. Phrases played by the app change note like a real harmonium (a 20 ms legato key change, no slide). Holding a note and pressing any other pad pulls the held note there and back (Settings can make the second finger play its own note instead). Quick taps are kept audible for fast taans.
- **Tanpura**: real recorded string plucks, pitch-shifted exactly to your Sa, strings set from the raga (changeable). A generated tanpura stands in while the recordings load.
- **Tabla**: plays the theka of the chosen taal (Teentaal, Jhaptaal, Ektaal, Rupak, Keherwa, Dadra, Jhoomra, Deepchandi, Tilwada) from recorded strokes, with the dayan tuned to your Sa; the top bar shows the matra, bol and sam/tali/khali mark. Theka data lives in `taals.js`.
- **Sing**: listens through the microphone and draws your voice's pitch as a line over the raga's swara lines, so you can see your meend, andolan and how steadily you hold a note. The line is saffron while you rest on a raga note, red when you rest on a note outside the raga, and grey while moving between notes. The right-hand column shows the swara you're on, how many cents sharp or flat you are, and, for a held note, how long you've held it and how much it wavers. The bottom bar shows how the last held note went. Tabla matras appear as vertical lines (sam in saffron). Everything you sing in a session is kept: each note you hold is written on the trace and in a transcript of sargam phrases along the top (tap a phrase to jump to it), so you can sing a song to find its notes. Drag the trace to look back; Live returns. Without the tabla, long silences are shortened so the trace only moves while you sing. Use earphones so the tanpura doesn't leak into the mic. Pitch detection (McLeod method) lives in `pitch.js`, the view in `sing.js`.
- **Raga browser**: ragas grouped by thaat, with aaroh, avaroh, pakad, key phrases, rules, vadi/samvadi. Data lives in `ragas.js` — edit freely. Entries marked `check: true` were written from memory and are worth verifying.

Notation: lowercase = komal (and `m` = shuddh Ma), uppercase = shuddha (and `M` = tivra Ma); dot below = mandra, dot above = taar.

## Credits

Harmonium samples: recorded at the Euterpea Studio, Yale University, by Donya Quick —
[Freesound #330410](https://freesound.org/people/donyaquick/sounds/330410/) (CC0).
Cut into single notes by Nicholas Brosowsky in
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
([CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)).
For this app every semitone from C2 to D5 (the set has no F♯4) was resampled to 32 kHz mono, its bellows swells gently evened out, loudness-matched and given a seamless loop; its exact pitch was measured from the loop so it can be retuned precisely (files in `harmonium/`).

Tanpura samples: single string plucks recorded by luckylittleraven —
[Freesound pack 23512](https://freesound.org/people/luckylittleraven/packs/23512/) (CC0):
[#416597](https://freesound.org/people/luckylittleraven/sounds/416597/) (low C♯),
[#416598](https://freesound.org/people/luckylittleraven/sounds/416598/) (G♯),
[#416606](https://freesound.org/people/luckylittleraven/sounds/416606/) (A♯),
[#416605](https://freesound.org/people/luckylittleraven/sounds/416605/) (C♯).
For this app each pluck was trimmed, cleaned of sympathetic-string ringing and hiss between its harmonics,
resampled to 32 kHz mono, loudness-matched and faded out; its exact pitch was measured from its harmonics
so it can be retuned precisely (files in `tanpura/`).

Tabla samples (files in `tabla/`; each pluck trimmed, faded, loudness-matched, dayan tuning measured):
- `m_*.wav`: "tabla bols" by mmiron — [Freesound pack 8162](https://freesound.org/people/mmiron/packs/8162/) (CC0).
- `s_*.wav`: "Tabla" by msarkar — [Freesound pack 3571](https://freesound.org/people/msarkar/packs/3571/),
  [Sampling+ 1.0](https://creativecommons.org/licenses/sampling+/1.0/). **These files may be shared only non-commercially, with credit**
  (they are not covered by the code's license).

Theka data compiled from [Ancient-Future](https://www.ancient-future.com/theka.html),
[Ragajunglism](https://ragajunglism.org/ragas/talas) and Wikipedia's "Tala (music)".
