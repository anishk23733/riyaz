# Riyaz

A small offline web app for Hindustani music practice: swara pads for any raga, harmonium with meend, and a tanpura tuned to your Sa.

Open it at **https://anishk23733.github.io/riyaz/** — on iPhone, open in Safari and use Share → Add to Home Screen. After the first load it works fully offline.

## What's in it

- **Pads** show only the chosen raga's swaras, from mandra to taar (plus an octave). Ragas that use both forms of a swara (m/M, n/N…) get a split pad: higher form on top.
- **Meend**: slide slowly between pads and the pitch glides along the raga's notes, locking exactly onto a note when you slow down; a quick swipe steps through the notes instead (grace notes, as a harmonium player would). Settings > Steps turns gliding off everywhere. Phrases played by the app change note like a real harmonium (a 20 ms legato key change, no slide). Holding a note and pressing any other pad pulls the held note there and back (Settings can make the second finger play its own note instead). Quick taps are kept audible for fast taans.
- **Tanpura**: modelled tanpura strings with real jawari buzz and a long, overlapping ring, tuned exactly to your Sa, strings set from the raga (changeable). It plucks on the tabla's beat, on half or third beats at slow tempos, so the drone never thins out. A lighter generated tanpura stands in while the plucks load.
- **Tabla**: plays the theka of the chosen taal (Teentaal, Jhaptaal, Ektaal, Rupak, Keherwa, Dadra, Jhoomra, Deepchandi, Tilwada) from recorded strokes, with the dayan tuned to your Sa; the top bar shows the matra, bol and sam/tali/khali mark. Theka data lives in `taals.js`.
- **Sing**: listens through the microphone and draws your voice's pitch as a line over the raga's swara lines, so you can see your meend, andolan and how steadily you hold a note. The line is saffron while you rest on a raga note, red when you rest on a note outside the raga, and grey while moving between notes. The right-hand column shows the swara you're on, how many cents sharp or flat you are, and, for a held note, how long you've held it and how much it wavers. The bottom bar shows how the last held note went. Tabla matras appear as vertical lines (sam in saffron). Everything you sing in a session is kept: each note you hold is written on the trace and in a transcript of sargam phrases along the top (tap a phrase to jump to it), so you can sing a song to find its notes. Drag the trace to look back; Live returns. Without the tabla, long silences are shortened so the trace only moves while you sing. Use earphones so the tanpura doesn't leak into the mic. Pitch detection (McLeod method) lives in `pitch.js`, the view in `sing.js`.
- **Library** (the book icon, top right): aalap phrases and taans to learn by ear, for Yaman, Puriya Dhanashree, Miyan ki Todi, Malkauns, Darbari Kanada and Multani. Each raga has a badhat of slow aalaps (mandra Sa up to the taar saptak) and sapaat, vakra, gamak, chhut and tihai taans. Tap ▶ to hear one on the harmonium in time with the tabla: the tabla starts a vibhag ahead, and a taan that lands on sam really lands on sam. Speed ½× / 1× / 2× changes how many notes go to a matra; tempo sets the matras. Loop repeats it once per cycle. It keeps playing in the bottom bar if you close the Library. Notation shows the matra each beat falls on (X = sam), meend (⌒) and kan (small notes). Data lives in `phrases.js` with its rhythm notation explained at the top — add your own. Most phrases were composed for the app in the Kirana style, not transcribed from recordings, and say so; the ulti taans follow Chetan Karnani's description of Bhimsen Joshi's taans. Phrases marked "From notation" (a filter of their own) take their notes from raga writers — Rajan Parrikar, Ragajunglism and David Clarke's *Rāgs Around the Clock* — each linked from the phrase, with the rhythm set for the app; one is a Puriya Dhanashree phrase Ragajunglism notated from a 1972 Bhimsen Joshi recording.
- **Raga browser**: ragas grouped by thaat (plus an "Other" group for ragas like Charukeshi and Kirwani that fit none of the 10), with aaroh, avaroh, pakad, key phrases, rules, vadi/samvadi. Data lives in `ragas.js` — edit freely. Entries marked `check: true` were written from memory and are worth verifying.

Notation: lowercase = komal (and `m` = shuddh Ma), uppercase = shuddha (and `M` = tivra Ma); dot below = mandra, dot above = taar.

## Credits

Harmonium samples: recorded at the Euterpea Studio, Yale University, by Donya Quick —
[Freesound #330410](https://freesound.org/people/donyaquick/sounds/330410/) (CC0).
Cut into single notes by Nicholas Brosowsky in
[tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments)
([CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)).
For this app every semitone from C2 to D5 (the set has no F♯4) was resampled to 32 kHz mono, its bellows swells gently evened out, loudness-matched and given a seamless loop; its exact pitch was measured from the loop so it can be retuned precisely (files in `harmonium/`).

Tanpura: no recordings. Each pluck comes from a physical model of a tanpura string
(`tools/tanpura/tanpura.c`): a stiff string in two planes of motion whose vertical motion strikes
a gently curved bridge and rests on a cotton thread a few millimetres from its edge. That grazing
contact is the jawari, and it produces the tanpura's buzzing overtones that slide down through each
note. The model follows the tanpura studies of van Walstijn, Chatziioannou and Bridges
(DAFx 2016, ISMA 2014). `tools/tanpura/render.py` renders it every two semitones from C♯1 to B4,
two plucks per pitch with different pluck positions and thread placement, adds a body response,
and measures each file's exact pitch (files in `tanpura/`). The app shifts each string by at most a
semitone from the nearest file.

Tabla samples (files in `tabla/`; each pluck trimmed, faded, loudness-matched, dayan tuning measured):
- `m_*.wav`: "tabla bols" by mmiron — [Freesound pack 8162](https://freesound.org/people/mmiron/packs/8162/) (CC0).
- `s_*.wav`: "Tabla" by msarkar — [Freesound pack 3571](https://freesound.org/people/msarkar/packs/3571/),
  [Sampling+ 1.0](https://creativecommons.org/licenses/sampling+/1.0/). **These files may be shared only non-commercially, with credit**
  (they are not covered by the code's license).

Theka data compiled from [Ancient-Future](https://www.ancient-future.com/theka.html),
[Ragajunglism](https://ragajunglism.org/ragas/talas) and Wikipedia's "Tala (music)".
