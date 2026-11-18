// Riyaz — tabla theka data. Edit freely; the tabla builds itself from this file.
//
// Each taal: { name, matras, vibhags: [lengths], marks: [one per vibhag], theka: [one string per matra] }
//   marks: 'X' = sam (first beat, tali), numbers = tali (clap) count, '0' = khali (wave).
//   theka: one entry per matra. An entry may hold several strokes that share the matra equally:
//     'DhaGe'    -> Dha, Ge on the two halves
//     'TiRaKiTa' -> Ti, Ra, Ki, Ta on the four quarters (see TIRAKITA note below)
//     '-Dha'     -> rest on the first half, Dha on the second
//     '-'        -> a silent matra (the previous stroke keeps ringing)
//   split with splitMatra() below.
//
// Sources (checked 2026-11):
//   [AF]  Ancient-Future, "North Indian tal thekas": https://www.ancient-future.com/theka.html
//   [RJ]  Ragajunglism, Hindustani Tala Index: https://ragajunglism.org/ragas/talas
//   [WP]  Wikipedia, "Tala (music)" (beats, divisions, clap patterns): https://en.wikipedia.org/wiki/Tala_(music)
//   Sources agree on matras / vibhags / marks; bols differ slightly between gharanas, noted under `variants`.

const TAALS = [
  {
    name: 'Teentaal', matras: 16, vibhags: [4, 4, 4, 4], marks: ['X', 2, '0', 3],
    theka: ['Dha', 'Dhin', 'Dhin', 'Dha',  'Dha', 'Dhin', 'Dhin', 'Dha',
            'Dha', 'Tin', 'Tin', 'Ta',     'Ta', 'Dhin', 'Dhin', 'Dha'],
    variants: {
      // [AF] starts the khali vibhag with Na; [RJ] writes Na for Ta.
      af: '... | Na Tin Tin Ta | Ta Dhin Dhin Dha',
      rj: '... | Dha Tin Tin Na | Na Dhin Dhin Dha',
    },
    sources: ['AF', 'RJ', 'WP'],
  },
  {
    name: 'Jhaptaal', matras: 10, vibhags: [2, 3, 2, 3], marks: ['X', 2, '0', 3],
    theka: ['Dhi', 'Na',  'Dhi', 'Dhi', 'Na',  'Ti', 'Na',  'Dhi', 'Dhi', 'Na'],
    variants: { rj: 'Dhin Na | Dhin Dhin Na | Tin Na | Dhin Dhin Na' }, // Dhi = Dhin, Ti = Tin
    sources: ['AF', 'RJ', 'WP'],
  },
  {
    name: 'Ektaal', matras: 12, vibhags: [2, 2, 2, 2, 2, 2], marks: ['X', '0', 2, '0', 3, 4],
    theka: ['Dhin', 'Dhin',  'DhaGe', 'TiRaKiTa',  'Tu', 'Na',
            'Kat', 'Ta',     'DhaGe', 'TiRaKiTa',  'Dhi', 'Na'],
    variants: {
      af: 'Dhin Dhin | DhaGe TiRaKiTa | Tun Na | Kat Ta | DhaGe TiRaKiTa | Dhin DhaGe', // last vibhag differs
      rj: 'Dhin Dhin | Na TiRaKiTa | Tun Na | Te Te | DhaGi TeTe | GiTa KiTe',         // a more ornate form
    },
    sources: ['AF', 'RJ', 'WP'],
  },
  {
    // Rupak begins on khali: sam and khali fall on the same (first) beat, so the clap
    // pattern is usually written 0 1 2 (some books write X 2 3, or 0 2 3).
    name: 'Rupak', matras: 7, vibhags: [3, 2, 2], marks: ['0', 1, 2], samIsKhali: true,
    theka: ['Tin', 'Tin', 'Na',  'Dhi', 'Na',  'Dhi', 'Na'],
    variants: { rj: 'Tin Tin Na | Dhin Dha | Dhin Dha' },
    sources: ['AF', 'RJ', 'WP'],
  },
  {
    name: 'Keherwa', matras: 8, vibhags: [4, 4], marks: ['X', '0'],
    theka: ['Dha', 'Ge', 'Na', 'Ti',  'Na', 'Ka', 'Dhi', 'Na'],
    variants: {
      rj: 'Ge Tha Ti Na | Na Dha Dhin Na',
      // [AF] notes a 3-3-2 accent feel (on the half-beats: Dha . . Ge . . Na .).
    },
    sources: ['AF', 'RJ', 'WP'],
  },
  {
    name: 'Dadra', matras: 6, vibhags: [3, 3], marks: ['X', '0'],
    theka: ['Dha', 'Dhi', 'Na',  'Dha', 'Tu', 'Na'],
    variants: {
      af: 'Dhi Dhi Na | Dha Tun Na',
      rj: 'Dha Dhin Na | Dha Tun Na',
      common: 'Dha Dhin Na | Dha Tin Na',
    },
    sources: ['AF', 'RJ', 'WP'],
  },
  {
    // Vilambit (slow) taal: '-Dha' is a rest then Dha on the off-beat.
    name: 'Jhoomra', matras: 14, vibhags: [3, 4, 3, 4], marks: ['X', 2, '0', 3],
    theka: ['Dhin', '-Dha', 'TiRaKiTa',  'Dhin', 'Dhin', 'DhaGe', 'TiRaKiTa',
            'Tin', '-Ta', 'TiRaKiTa',    'Dhin', 'Dhin', 'DhaGe', 'TiRaKiTa'],
    sources: ['RJ', 'WP'],
  },
  {
    // Also called Chachar [AF]. The empty matras are part of the feel: let the previous stroke ring.
    name: 'Deepchandi', matras: 14, vibhags: [3, 4, 3, 4], marks: ['X', 2, '0', 3],
    theka: ['Dha', 'Dhin', '-',  'Dha', 'Dha', 'Tin', '-',
            'Ta', 'Tin', '-',    'Dha', 'Dha', 'Dhin', '-'],
    sources: ['AF', 'RJ', 'WP'],
  },
  {
    // Vilambit taal.
    name: 'Tilwada', matras: 16, vibhags: [4, 4, 4, 4], marks: ['X', 2, '0', 3],
    theka: ['Dha', 'TiRaKiTa', 'Dhin', 'Dhin',  'Dha', 'Dha', 'Tin', 'Tin',
            'Ta', 'TiRaKiTa', 'Dhin', 'Dhin',   'Dha', 'Dha', 'Dhin', 'Dhin'],
    sources: ['RJ', 'WP'],
  },
];

// ---------------------------------------------------------------------------
// Stroke vocabulary: what each spoken bol means on the two drums.
//   d = dayan (right, tuned) stroke class, b = bayan (left, bass) stroke class.
//   Dayan classes: 'na' (kinar, ringing, 3rd harmonic strong), 'tin' (sur, ringing, 2nd harmonic),
//                  'tun' (open centre, fundamental), 'te' (closed, flat fingers on syahi), 're' (closed, index).
//   Bayan classes: 'ge' (open, resonant, can bend), 'ke' (closed slap).
// Ta == Na (same stroke in most gharanas). Dhi == Dhin. Ti/Te/Tit/Tat are closed dayan strokes.
const STROKES = {
  Dha:  { d: 'na',  b: 'ge' },
  Dhin: { d: 'tin', b: 'ge' }, Dhi: { d: 'tin', b: 'ge' },
  Dhun: { d: 'tun', b: 'ge' },
  Na:   { d: 'na' },  Ta: { d: 'na' },
  Tin:  { d: 'tin' },
  Tu:   { d: 'tun' }, Tun: { d: 'tun' },
  Ti:   { d: 'te' },  Te: { d: 'te' }, Tit: { d: 'te' },
  Ra:   { d: 're' },  Re: { d: 're' },
  Ge:   { b: 'ge' },  Ga: { b: 'ge' }, Ghe: { b: 'ge' }, Gi: { b: 'ge' },
  Ke:   { b: 'ke' },  Ka: { b: 'ke' }, Ki: { b: 'ke' },
  Kat:  { b: 'ke', accent: 1 },         // a firm closed bayan slap, on its own matra
};

// Compound bols: their strokes and, optionally, the stroke class to use when a syllable
// means something different inside the compound (the final Ta of TiRaKiTa is a closed
// dayan stroke, not the ringing Na-type Ta).
const COMPOUNDS = {
  DhaGe:    [['Dha'], ['Ge']],
  TiRaKiTa: [['Ti'], ['Ra'], ['Ki'], ['Ta', { d: 'te' }]],
  TeTe:     [['Te'], ['Te']],
  GeNa:     [['Ge'], ['Na']],
};

// Split one matra's entry into [{ bol, frac, stroke }] — frac = start offset as a fraction of the matra.
// Returns [] for '-'. Display text for the top bar is the entry itself ('DhaGe', 'TiRaKiTa').
function splitMatra(entry) {
  if (entry === '-') return [];
  const parts = [];
  for (const tok of entry.match(/-|[A-Z][a-z]*/g)) {          // '-Dha' -> ['-', 'Dha']; 'DhaGe' -> ['Dha','Ge']
    parts.push(tok);
  }
  // Re-join known compounds so TiRaKiTa keeps its special final Ta.
  if (COMPOUNDS[entry]) {
    const c = COMPOUNDS[entry];
    return c.map(([bol, over], i) => ({ bol, frac: i / c.length, stroke: Object.assign({}, STROKES[bol], over) }));
  }
  return parts.map((bol, i) => bol === '-' ? null : ({ bol, frac: i / parts.length, stroke: STROKES[bol] }))
              .filter(Boolean);
}

// Matra -> vibhag index and mark (for the top-bar badge).
function vibhagOf(taal, matra) {
  let start = 0;
  for (let v = 0; v < taal.vibhags.length; v++) {
    if (matra < start + taal.vibhags[v]) return { v, mark: matra === start ? taal.marks[v] : null, first: matra === start };
    start += taal.vibhags[v];
  }
}

if (typeof module !== 'undefined') module.exports = { TAALS, STROKES, COMPOUNDS, splitMatra, vibhagOf };
