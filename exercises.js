'use strict';
// Practice: a graded riyaz course. Edit freely; the Practice view builds itself from this file.
//
// Every exercise has a purpose, exact notes, a taal and a tempo plan, what to listen for, the
// usual mistakes and how to make it harder. This file holds only the general work: the voice on
// the drone, laya and the ear, built over a scale you choose in the app (Bilawal or the notes of
// your current raga). Everything melodic is written per raga, in ragapaths.js and classnotes.js;
// the generic alankars, scale taans and any-raga templates were taken out on purpose.
//
// Fields
//   id, track, level (1 Warm-up, 2 Building, 3 Intermediate, 4 Advanced), name, minutes
//   purpose   why this exercise exists, in a sentence or two
//   how       what to do, step by step
//   listen    what a clean performance sounds like
//   mistakes  what usually goes wrong
//   harder    how to take it further once it's clean
//   taal      the theka it is counted in (taals.js)
//   bpm       { start, target, step }: matras a minute. Each time you mark it clean, the next
//             session moves `step` closer to `target`. A negative step means slower is harder
//             (long tones: a slower matra is a longer note).
//   lays      speeds it can be sung at, in notes per matra (1 thah, 2 dugun, 3 tigun, 4 chaugun).
//             'Ladder' sings them one after another, each filling the same time (the line twice
//             in dugun, four times in chaugun), the way layakari is practised.
//   seq(c)    the notes as slots (one note, '-' hold or '_' rest each); the lay groups them into
//             matras. c = { scale: ['S','R',…], n, raga, info }.
//   notes(c)  instead of seq: the exact notation, rhythm included (phrases.js notation), lay 1
//   lands     'sam': the last beat falls on sam
//   gamak     every note shaken from the note above
//   raga      the exercise belongs to this raga (andolan in Bhairav…); 'current' = your raga
//   src       keys into SOURCES: published teaching the exercise follows
//
// Notation (as in phrases.js): S r R g G m M P d D n N; N. = mandra, S' = taar.
//   ~X quick meend into X, ~~X slow meend (most of the note is the slide), (X) kan,
//   ^X andolan, ?X your turn: shown and timed but not played (sing it yourself).

const SOURCES = {
  swRiyaz: { name: 'SwarGanga, How to practice Hindustani music', url: 'https://www.swarganga.org/articles/icmconcepts/icm44' },
  swAlankar: { name: 'SwarGanga, Alankar (kan, andolan)', url: 'https://swarganga.org/articles/icmconcepts/icm11.php' },
  orn: { name: 'Raag Hindustani, Ornamentation (meend, kan, andolan, gamak, khatka, murki)', url: 'https://raag-hindustani.com/Embellishment.html' },
  riyaz: { name: 'Gandharv Shastra, Riyaaz (mandra sadhna, slow first)', url: 'https://sites.google.com/view/gandharvshastra/TheoryofMusic/GayanVadanShastra/voice/riyaz' },
  laya: { name: 'DigiTabla, Layakari (thah, dugun, tigun, chaugun, aad, kuaad)', url: 'https://digitabla.com/reference/concepts-and-definitions/layakari/' },
  tihai: { name: 'Wikipedia, Tihai', url: 'https://en.wikipedia.org/wiki/Tihai' },
  tala: { name: 'Wikipedia, Tala (music): tali, khali, sam', url: 'https://en.wikipedia.org/wiki/Tala_(music)' },
  darbari: { name: 'Wikipedia, Darbari Kanada', url: 'https://en.wikipedia.org/wiki/Darbari_Kanada' },
};

const TRACKS = [
  { id: 'swar', name: 'Swar', about: 'Sa and steady notes: the voice settled on the drone' },
  { id: 'orn', name: 'Andolan', about: 'The slow swing on a note, in the two ragas that depend on it most' },
  { id: 'laya', name: 'Laya', about: 'Taal and layakari: sam and khali, dugun to chaugun, aad, tihai' },
  { id: 'ear', name: 'Ear', about: 'Hear it, then sing it back: the app plays, you answer' },
];
const LEVEL_NAMES = ['', 'Warm-up', 'Building', 'Intermediate', 'Advanced'];

// ---------- building blocks ----------
const X = {
  // scale degree i (0 = madhya Sa, negative = mandra, n = taar Sa) as a note token
  tok(c, i) {
    const n = c.scale.length, o = Math.floor(i / n), l = c.scale[((i % n) + n) % n];
    return l + (o < 0 ? '.' : o > 0 ? "'" : '');
  },
  // a note held for k slots
  hold(t, k) { return [t, ...Array(Math.max(0, k - 1)).fill('-')]; },
  rest(k) { return Array(k).fill('_'); },
  // a palta: the cell moved up through the scale from `lo` until it reaches `top`, then its mirror
  // image back down (as alankars are written: SRG RGm … / S'ND NDP … GRS)
  palta(c, cell, lo = 0, top = c.n) {
    const out = [], hi = Math.max(...cell), lw = Math.min(...cell);
    for (let s = lo - lw; s + hi <= top; s++) for (const k of cell) out.push(X.tok(c, s + k));
    for (let s = top + lw; s - hi >= lo; s--) for (const k of cell) out.push(X.tok(c, s - k));
    return out;
  },
  // only the climbing half
  up(c, cell, lo = 0, top = c.n) {
    const out = [], hi = Math.max(...cell), lw = Math.min(...cell);
    for (let s = lo - lw; s + hi <= top; s++) for (const k of cell) out.push(X.tok(c, s + k));
    return out;
  },
  line(c, lo = 0, top = c.n) { return X.palta(c, [0], lo, top); },
  // straight up and straight down, the top note sung once (a sapaat taan)
  updown(c, lo = 0, top = c.n) { const u = X.up(c, [0], lo, top); return [...u, ...u.slice(0, -1).reverse()]; },
  // the call, then the same notes again as your turn
  echo(call) { return [...call, ...call.map(t => /^[SrRgGmMPdDnN(~^]/.test(t) ? '?' + t : t)]; },
  // slots -> matra tokens of k slots each (the last one filled with holds)
  beats(s, k) { const b = []; for (let i = 0; i < s.length; i += k) { const g = s.slice(i, i + k); while (g.length < k) g.push('-'); b.push(g.join('')); } return b; },
  // fill to whole cycles of M matras with rests
  fill(b, M) { while (b.length % M) b.push('_'); return b; },
};

const EXERCISES = [
  // ======================= Swar: Sa and steady notes =======================
  { id: 'sa', track: 'swar', level: 1, name: 'Lagao Sa: hold Sa', minutes: 4, taal: 'Teentaal',
    bpm: { start: 80, target: 48, step: -4 }, lays: [1],
    purpose: 'Everything rests on one note sung truly in tune with the tanpura. Holding Sa until your voice and the drone become one sound is the first riyaz in every tradition.',
    how: ['Tanpura on. Listen for a whole cycle before you sing.', 'Sing Sa in akaar ("aa", mouth open) from sam for 12 matras, breathe on the last 4.', 'Start softly and stay at one volume. Repeat for the whole time.'],
    listen: 'When you are exactly on Sa the tanpura seems to swallow your voice: no beating, no "two sounds". Beating means you are slightly off; adjust by ear, not by force.',
    mistakes: 'Starting a little flat and sliding up; going sharp as you push breath near the end; a wobble that is really tension in the jaw or throat.',
    harder: 'Slower tempo, so each hold is longer (at 48 BPM a hold is 15 seconds). Then hold it softly, then at full voice, without the pitch moving.',
    src: ['swRiyaz', 'riyaz'],
    seq: () => [...X.hold('S', 12), ...X.rest(4)] },
  { id: 'sapasa', track: 'swar', level: 1, name: "Sa, Pa, taar Sa", minutes: 4, taal: 'Teentaal',
    bpm: { start: 80, target: 52, step: -4 }, lays: [1],
    purpose: "These are the tanpura's own notes. Tuning Pa and taar Sa against the drone fixes the frame every other note is measured against.",
    how: ['Hold Sa 8 matras, then Pa 8, taar Sa 8, and back to Sa for 8.', 'Change note exactly on the matra; arrive on the pitch, do not scoop up to it.'],
    listen: 'Pa should lock with the drone as firmly as Sa does. Taar Sa should sound like the same note as Sa, only higher, not a separate strained one.',
    mistakes: 'Pa slightly flat (very common); reaching for taar Sa with a push of breath so it goes sharp; dropping back to Sa late.',
    harder: 'Slower; then go Sa to taar Sa directly with nothing in between.',
    seq: c => [...X.hold('S', 8), ...X.hold('P', 8), ...X.hold("S'", 8), ...X.hold('S', 8)] },
  { id: 'against', track: 'swar', level: 1, name: 'Each note against Sa', minutes: 6, taal: 'Teentaal',
    bpm: { start: 72, target: 52, step: -4 }, lays: [1], scale: true,
    purpose: "Learn where each swara sits relative to the drone. Starting each note from Sa makes you place it by its distance from Sa, not by sliding up the scale.",
    how: ['Each cycle: Sa for 2 matras, the note for 8, back to Sa for 4, breathe for 2.', 'One note per cycle, Re up to taar Sa.'],
    listen: 'Some notes "ring" with the tanpura (Ga, Ma, Pa, Dha in tune have a sweet consonance). Listen for that ring, not just for being near.',
    mistakes: 'Tivra Ma and komal notes drifting toward their neighbours; Ni going flat; coming back to Sa slightly off because you did not hear it again before singing.',
    harder: 'Slower. Then sing the note first, before the guide, and check with the graph.',
    seq: c => {
      const out = [];
      for (let i = 1; i <= c.n; i++) out.push(...X.hold('S', 2), ...X.hold(X.tok(c, i), 8), ...X.hold('S', 4), ...X.rest(2));
      return out;
    } },
  { id: 'kharaj', track: 'swar', level: 2, name: 'Kharaj: down to mandra Pa', minutes: 5, taal: 'Teentaal',
    bpm: { start: 72, target: 52, step: -4 }, lays: [1], scale: true,
    purpose: "Low-register practice (mandra sadhana) builds a full, relaxed voice. Bhimsen Joshi is said to have practised the mandra saptak for hours in his early mornings.",
    how: ['Sa for 4 matras, then each lower note for 4, with mandra Pa held for 8, and back up to Sa.', 'Let the voice go dark and relaxed. If mandra Pa is not comfortable, stop at the lowest note that is.'],
    listen: 'A low note that is soft and steady is the goal, not a loud one. It should feel like it comes from the chest, with an easy throat.',
    mistakes: 'Pressing the larynx down to reach the low notes; going breathy and flat; rushing back up.',
    harder: 'Slower; then add mandra Ma and Ga, only if they come without strain.',
    src: ['riyaz'],
    seq: c => {
      // down to mandra Pa (or the first note of the scale below it)
      let lo = -1;
      while ('SrRgGmMP'.indexOf(c.scale[((lo % c.n) + c.n) % c.n]) > 7 || !/[SrRgGmMP]/.test(c.scale[((lo % c.n) + c.n) % c.n]) && lo > -c.n) lo--;
      const down = []; for (let i = -1; i >= lo; i--) down.push(i);
      return [...X.hold('S', 4), ...down.flatMap(i => X.hold(X.tok(c, i), i === lo ? 8 : 4)),
        ...down.slice(0, -1).reverse().flatMap(i => X.hold(X.tok(c, i), 4)), ...X.hold('S', 8)];
    } },
  { id: 'volume', track: 'swar', level: 2, name: 'Swell and fade without moving', minutes: 4, taal: 'Teentaal',
    bpm: { start: 72, target: 52, step: -4 }, lays: [1],
    purpose: 'Most pitch drift comes from volume: louder goes sharp, softer goes flat. This trains the two to be independent.',
    how: ['Hold Sa, Ga, Pa and Sa again for 6 matras each, with 2 to breathe.', 'Start soft, grow to full voice by the middle, fade back to soft by the end.'],
    listen: 'On the graph with Sing on, your line should stay flat through the swell. If it bends up in the middle, you are pushing.',
    mistakes: 'Going sharp as you get louder; the fade turning breathy and flat.',
    harder: 'Slower, and a wider swell from a whisper to full voice.',
    seq: c => ['S', 'G', 'P', 'S'].flatMap(t => [...X.hold(c.scale.includes(t) ? t : 'S', 6), ...X.rest(2)]) },
  { id: 'twooct', track: 'swar', level: 3, name: 'Long tones from mandra Pa to taar Sa', minutes: 6, taal: 'Teentaal',
    bpm: { start: 66, target: 44, step: -4 }, lays: [1], scale: true,
    purpose: 'One even voice across the whole range, with no change of colour where the registers meet.',
    how: ['2 matras a note, from mandra Pa up to taar Sa and back.', 'Keep the same open akaar all the way; do not let the top notes get thin or the bottom ones growl.'],
    listen: 'An even line on the graph, and a voice that sounds like one instrument from bottom to top.',
    mistakes: 'A break or flip around madhya Pa to Ni; top notes sharp, bottom notes flat.',
    harder: 'Slower, so each note is longer.',
    seq: c => X.line(c, -3, c.n).flatMap(t => X.hold(t, 2)) },
  { id: 'taarsa', track: 'swar', level: 3, name: 'Reaching taar Sa', minutes: 4, taal: 'Teentaal',
    bpm: { start: 70, target: 50, step: -4 }, lays: [1], scale: true,
    purpose: 'Arriving on taar Sa from below and staying there in tune, without reaching for it.',
    how: ['Pa 4, Ni 4, taar Sa 8; Ni 2 and taar Sa 6 again; Pa 8.', 'Think of taar Sa as resting on top, not as a climb.'],
    listen: "Taar Sa should lock with the tanpura's high Sa string just as madhya Sa does with the low one.",
    mistakes: 'Overshooting and sliding down onto it; going sharp when you push volume.',
    harder: 'Slower; then go Pa to taar Sa directly.',
    seq: c => [...X.hold('P', 4), ...X.hold(X.tok(c, c.n - 1), 4), ...X.hold("S'", 8), ...X.hold(X.tok(c, c.n - 1), 2), ...X.hold("S'", 6), ...X.hold('P', 8)] },

  // ======================= Ornaments =======================
  { id: 'o-bhairav', track: 'orn', level: 3, name: "Andolan: Bhairav's komal Re and Dha", minutes: 4, taal: 'Teentaal', raga: 'Bhairav',
    bpm: { start: 56, target: 44, step: -4 }, lays: [1],
    purpose: 'An andolan is a slow oscillation on a note. In Bhairav it sits on komal Re and komal Dha and is much of what makes the raga sound like Bhairav rather than its scale.',
    how: ['G m then a long andolit Dha resolving to Pa; G m then a long andolit Re resolving to Sa.', 'Swing slowly, about once a second, mostly below the note and back to it.'],
    listen: 'A slow, wide sway that keeps coming back to the note, not a fast vibrato.',
    mistakes: 'A fast tremble; a swing so wide it becomes another note; going sharp.',
    harder: 'Slower, with the swing softer and smaller.',
    src: ['orn', 'swAlankar'], check: true,
    notes: () => "S - G m | ^d - - - | - - P - | - - - - | G m ^r - | - - - - | S - - - | _ _ _ _" },
  { id: 'o-darbari', track: 'orn', level: 4, name: "Andolan: Darbari's komal Ga and Dha", minutes: 4, taal: 'Teentaal', raga: 'Darbari Kanada',
    bpm: { start: 52, target: 40, step: -4 }, lays: [1],
    purpose: "Darbari's andolan on komal Ga and komal Dha is the slowest and heaviest in the raga system, and much of its gravity.",
    how: ['R, a long andolit Ga, m R S. Then P, a long andolit Dha, n P.', 'Swing slowly and low; the oscillation is part of the note, not decoration on top.'],
    listen: 'Unhurried and deep. Compare with recordings of Darbari aalaps.',
    mistakes: 'The swing too fast or too regular; Ga going toward shuddh Ga.',
    harder: 'Slower.',
    src: ['darbari', 'orn'], check: true,
    notes: () => "R ^g - - | - - m R | S - - - | _ _ _ _ | P ^d - - | - - n P | m P ^g - | - m R S" },

  // ======================= Laya =======================
  { id: 'l-samkhali', track: 'laya', level: 1, name: 'Sa on sam, Pa on khali', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 90, step: 6 }, lays: [1],
    purpose: 'Hear where the cycle begins (sam, X) and its empty half (khali, 0) in the tabla itself. Clap on sam and on the 2nd and 3rd tali, wave on khali.',
    how: ['Sa from sam for 8 matras, Pa from khali for 8. Clap 1, 5 and 13; wave on 9.'],
    listen: "Teentaal's khali vibhag has no bass (Tin Tin Ta); you should hear it change before you see it.",
    mistakes: 'Changing note a matra early because you were counting, not listening.',
    harder: 'Close your eyes and keep the claps going.',
    src: ['tala'],
    notes: () => "S - - - - - - - | P - - - - - - -" },
  { id: 'l-vibhag', track: 'laya', level: 1, name: 'One note per vibhag', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 96, step: 6 }, lays: [1], scale: true,
    purpose: 'Each vibhag (section of the taal) gets one note held for its whole length, so the four parts of Teentaal become something you feel.',
    how: ['Change note only on 1, 5, 9 and 13; clap or wave there.'],
    listen: 'Every change together with the tabla.',
    mistakes: 'Changing on the last matra of the vibhag (anticipating).',
    harder: 'Jhaptaal (2+3+2+3) in Settings changes the feel completely.',
    seq: c => [0, 1, 2, 3, 4, 3, 2, 1].flatMap(i => X.hold(X.tok(c, i), 4)) },
  { id: 'l-stair', track: 'laya', level: 2, name: 'Thah, dugun, tigun, chaugun in one cycle', minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 88, step: 4 }, lays: [1], scale: true,
    purpose: 'One note per matra in the first vibhag, two in the second, three in the third, four in the fourth, then Sa on sam. The four basic layakaris in one breath of the taal.',
    how: ['Keep the matra steady; only the number of notes inside it changes.', 'The line goes up and down the scale without stopping.'],
    listen: 'Each vibhag sounding twice, three times, four times as dense, and Sa landing on sam.',
    mistakes: 'Speeding up the matra in the chaugun vibhag; tigun uneven.',
    harder: 'Faster; then aad.',
    src: ['laya'],
    notes: c => {
      const zig = []; for (let k = 0; zig.length < 40; k++) { const p = k % (2 * c.n); zig.push(X.tok(c, p <= c.n ? p : 2 * c.n - p)); }
      let i = 0; const take = n => { const s = zig.slice(i, i + n).join(''); i += n; return s; };
      const v = [1, 2, 3, 4].map(k => [0, 1, 2, 3].map(() => take(k)).join(' '));
      return v.join(' | ') + ' | S - - - | _ _ _ _ | _ _ _ _ | _ _ _ _';
    } },
  { id: 'l-tigun', track: 'laya', level: 3, name: 'Tigun: the line three times in one cycle', minutes: 3, taal: 'Teentaal',
    bpm: { start: 56, target: 88, step: 4 }, lays: [1], scale: true,
    purpose: "The aaroh-avaroh sung three times in one cycle of 16 matras. Sam falls in the middle of the line's second and third times, so you must keep both counts.",
    how: ['Three notes per matra, the line repeated three times; it ends exactly at the end of the cycle.'],
    listen: "Even threes, and the line ending exactly as the cycle does.",
    mistakes: 'Restarting the line at sam instead of carrying on.',
    harder: 'Faster.',
    src: ['laya'],
    notes: c => { const l = [...X.line(c), ...X.line(c), ...X.line(c)]; const b = []; for (let i = 0; i < l.length; i += 3) b.push(l.slice(i, i + 3).join('')); return b.join(' '); } },
  { id: 'l-aad', track: 'laya', level: 3, name: 'Aad: three notes in two matras', minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 84, step: 4 }, lays: [1], scale: true,
    purpose: 'Aad is one and a half notes per matra (3:2). Every other note falls between the beats, which is why it sounds like it leans against the taal.',
    how: ['Count each matra in three: notes fall on 1, then 3 of the first matra… then 2 of the next. The graph shows exactly where.'],
    listen: 'The line floating across the beat but meeting it every two matras.',
    mistakes: 'Turning it into dugun with a gap; drifting.',
    harder: 'Faster; then kuaad.',
    src: ['laya'],
    notes: c => {
      const slots = X.line(c).flatMap(t => [t, '-']);
      return X.fill(X.beats(slots, 3), 16).join(' ');
    } },
  { id: 'l-jhap', track: 'laya', level: 2, name: 'Aaroh and avaroh in Jhaptaal', minutes: 3, taal: 'Jhaptaal',
    bpm: { start: 60, target: 100, step: 5 }, lays: [1], scale: true,
    purpose: 'Jhaptaal is 2+3+2+3. Fitting the scale to it, with a held note at the end of each half, teaches its uneven pulse.',
    how: ['Each vibhag one group of notes; clap on 1, 3 and 8, wave on 6.'],
    listen: 'The short-long-short-long feel of the vibhags.',
    mistakes: 'Squaring it off into fives.',
    harder: 'Faster; then dugun.',
    src: ['tala'],
    notes: c => {
      const t = i => X.tok(c, i);
      if (c.n !== 7) return X.fill(X.line(c), 10).join(' ');
      return `${t(0)} ${t(1)} | ${t(2)} ${t(3)} ${t(4)} | ${t(5)} ${t(6)} | ${t(7)} - - | ${t(7)} ${t(6)} | ${t(5)} ${t(4)} ${t(3)} | ${t(2)} ${t(1)} | ${t(0)} - -`;
    } },
  { id: 'l-rupak', track: 'laya', level: 3, name: 'Rupak: starting on khali', minutes: 3, taal: 'Rupak',
    bpm: { start: 60, target: 100, step: 5 }, lays: [1], scale: true,
    purpose: 'Rupak (3+2+2) starts on khali: its first beat is both sam and an empty beat. It trains you not to rely on a heavy downbeat.',
    how: ['Wave on 1, clap on 4 and 6.'],
    listen: 'The cycle starting softly, the claps on 4 and 6 carrying the weight.',
    mistakes: 'Hearing beat 4 as the start.',
    harder: 'Faster; then dugun.',
    src: ['tala'],
    notes: c => {
      const t = i => X.tok(c, i);
      if (c.n !== 7) return X.fill(X.line(c), 7).join(' ');
      return `${t(0)} ${t(1)} ${t(2)} | ${t(3)} ${t(4)} | ${t(5)} ${t(6)} | ${t(7)} - - | ${t(6)} ${t(5)} | ${t(4)} ${t(3)} | ${t(2)} ${t(1)} ${t(0)} | - - | _ _`;
    } },
  { id: 'l-tihai', track: 'laya', level: 3, name: 'Tihai to sam', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 96, step: 4 }, lays: [1], scale: true, lands: 'sam',
    purpose: 'A tihai repeats a phrase three times so that the end of the third lands on sam. Here: a 4-matra phrase, a 2-matra gap, three times (4+2+4+2+4 = 16).',
    how: ['Start where the app starts you (matra 2); the last Sa is on sam.'],
    listen: 'Three identical phrases and the last Sa with the tabla\'s sam.',
    mistakes: 'Shortening the gaps; the third phrase rushed.',
    harder: 'Make your own: phrase × 3 + gap × 2 must equal the cycle.',
    src: ['tihai'],
    notes: c => { const t = i => X.tok(c, i); const p = `${t(4)} ${t(2)} ${t(1)} S`; return `${p} - - ${p} - - ${p}`; } },
  { id: 'l-kuaad', track: 'laya', level: 4, name: 'Kuaad: five notes in four matras', minutes: 4, taal: 'Teentaal',
    bpm: { start: 52, target: 76, step: 4 }, lays: [1], scale: true,
    purpose: 'Kuaad is 5:4. The notes meet the beat only every four matras; in between they fall at four different places in the matra.',
    how: ['Count five in each matra; a note falls every four of those counts. Follow the graph.'],
    listen: 'A smooth, evenly spaced line, independent of the beat, meeting it on 1, 5, 9 and 13.',
    mistakes: 'Snapping to the beat.',
    harder: 'Faster.',
    src: ['laya'],
    notes: c => {
      const slots = X.line(c).flatMap(t => [t, '-', '-', '-']);
      return X.fill(X.beats(slots, 5), 16).join(' ');
    } },

  // ======================= Ear =======================
  { id: 'e-one', track: 'ear', level: 1, name: 'Echo one note', minutes: 3, taal: 'Teentaal',
    bpm: { start: 66, target: 80, step: 4 }, lays: [1], scale: true,
    purpose: 'The app plays a note, you sing it back. The leaps from Sa make you find each note from scratch.',
    how: ['Listen for 2 matras, then sing the same note for 2 (the outlined bar). Turn Sing on to see your line over it.'],
    listen: 'Your note matching the one you heard, from its very start.',
    mistakes: 'Starting near and sliding into the note.',
    harder: 'Faster; then One note, back to Sa.',
    seq: c => [0, c.n, 4, 0, 2, 4, 1, 3, 5, c.n - 1, 0].flatMap(i => X.echo(X.hold(X.tok(c, i), 2))) },
  { id: 'e-tosa', track: 'ear', level: 1, name: 'Hear a note, sing Sa', minutes: 3, taal: 'Teentaal',
    bpm: { start: 66, target: 84, step: 4 }, lays: [1], scale: true,
    purpose: 'After any note, find your way back to Sa without help. Knowing where Sa is at all times is what keeps a whole performance in tune.',
    how: ['The app plays a note for 2 matras; you sing Sa for 2.'],
    listen: 'Your Sa matching the tanpura, not the note you just heard.',
    mistakes: 'Singing Sa a little toward the previous note (flat after Ni, sharp after Re).',
    harder: 'Tanpura off.',
    seq: c => [4, 2, c.n - 1, 1, 3, 5, c.n, 2, 4].flatMap(i => [...X.hold(X.tok(c, i), 2), ...X.hold('?S', 2)]) },
  { id: 'e-interval', track: 'ear', level: 2, name: 'Intervals from Sa', minutes: 3, taal: 'Teentaal',
    bpm: { start: 66, target: 84, step: 4 }, lays: [1], scale: true,
    purpose: 'Sa then another note, and you answer with the same two. You learn each interval as a sound, which is how you will find notes in a new raga.',
    how: ['Two notes are played; sing both back.'],
    listen: 'The second note in tune from the start; the leap as one gesture.',
    mistakes: 'Small intervals too wide, large ones too narrow.',
    harder: 'Faster; then intervals from Pa.',
    seq: c => [2, 4, 3, 1, 5, 6, c.n].flatMap(i => X.echo([X.tok(c, 0), X.tok(c, i), '-', '_'])) },
  { id: 'e-three', track: 'ear', level: 2, name: 'Echo three-note phrases', minutes: 4, taal: 'Teentaal',
    bpm: { start: 66, target: 84, step: 4 }, lays: [1], scale: true,
    purpose: 'Short melodic cells, played once, answered once. This is memory as much as pitch.',
    how: ['Three notes and a breath; then your three.'],
    listen: 'The shape exactly right before you worry about the tuning.',
    mistakes: 'Reversing the middle note.',
    harder: 'Faster; then raga phrases (Raga → Key phrases).',
    seq: c => [[0, 1, 2], [2, 1, 0], [0, 2, 4], [4, 2, 0], [4, 5, 7], [7, 5, 4], [0, 4, 7], [2, 4, 3], [5, 3, 1]]
      .flatMap(p => X.echo([...p.map(i => X.tok(c, i)), '_'])) },
  { id: 'e-komal', track: 'ear', level: 3, name: 'Komal or shuddh?', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 76, step: 4 }, lays: [1],
    purpose: 'Each pair of notes a semitone apart (komal and shuddh Re, Ga, Dha, Ni; shuddh and tivra Ma), from Sa. Hearing and singing the half step is what separates ragas like Bhairav and Bilawal.',
    how: ['S, the lower form, S, the higher form; then sing all four back.'],
    listen: 'Komal notes really low and shuddh really high; the half step as a clear, small distance.',
    mistakes: 'Komal notes drifting up toward shuddh; tivra Ma going sharp.',
    harder: 'Faster; tanpura only.',
    seq: () => [['r', 'R'], ['g', 'G'], ['m', 'M'], ['d', 'D'], ['n', 'N']].flatMap(([a, b]) => X.echo(['S', a, 'S', b])) },
  { id: 'e-next', track: 'ear', level: 3, name: 'Sing the next note', minutes: 3, taal: 'Teentaal',
    bpm: { start: 66, target: 88, step: 4 }, lays: [1], scale: true,
    purpose: 'Three notes of the scale are played; you sing the fourth, the one nobody gave you.',
    how: ['Up from each note, then down.'],
    listen: 'The fourth note as sure as the three you heard.',
    mistakes: 'Repeating the third note; overshooting.',
    harder: 'In your raga scale, where the next note is not always the next semitone you expect.',
    seq: c => {
      const out = [];
      for (let s = 0; s + 3 <= c.n; s++) out.push(X.tok(c, s), X.tok(c, s + 1), X.tok(c, s + 2), '?' + X.tok(c, s + 3));
      for (let s = c.n; s - 3 >= 0; s--) out.push(X.tok(c, s), X.tok(c, s - 1), X.tok(c, s - 2), '?' + X.tok(c, s - 3));
      return out;
    } },
  { id: 'e-silent', track: 'ear', level: 4, name: 'Sing from the graph alone', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 96, step: 4 }, lays: [1, 3], scale: true,
    purpose: 'The threes palta with no harmonium at all: only the tanpura, the tabla and the note graph. Turn Sing on and see how close you come.',
    how: ['Read ahead on the graph. Sing in sargam.'],
    listen: 'Above 80% in tune on the result line.',
    mistakes: 'Drifting flat with nothing to correct you; check Sa with the tanpura at every Sa.',
    harder: 'Tigun.',
    seq: c => X.palta(c, [0, 1, 2]).map(t => '?' + t) },

  { id: 'l-half', track: 'laya', level: 3, name: 'Starting on the half beat', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 100, step: 4 }, lays: [1], scale: true,
    purpose: 'The scale in dugun, but every note shifted half a matra late, so each note starts between the beats. It trains you to place notes off the beat without losing the beat.',
    how: ['Rest on the beat, sing on the "and": _S RG mP …'],
    listen: 'The tabla beat landing in the middle of your pairs, every time.',
    mistakes: 'Drifting back onto the beat after a few notes.',
    harder: 'Faster; then the same in tigun starting a third late.',
    notes: c => X.fill(X.beats(['_', ...X.updown(c)], 2), 16).join(' ') },
  { id: 'l-quarters', track: 'laya', level: 4, name: 'Fours from each quarter of the matra', minutes: 4, taal: 'Teentaal',
    bpm: { start: 52, target: 84, step: 4 }, lays: [1], scale: true,
    purpose: 'The fours palta in chaugun, sung four times: starting on the beat, then a quarter late, half late and three quarters late. The same notes feel completely different against the taal each time.',
    how: ['Each time, rest for the gap shown on the graph and come in after it. Keep counting the matra, not the notes.'],
    listen: 'The cells sounding the same every time, only displaced.',
    mistakes: 'Shortening the rests so the cells creep back to the beat.',
    harder: 'Faster; guide off.',
    notes: c => {
      const cells = X.up(c, [0, 1, 2, 3]);
      const b = [];
      for (let k = 0; k < 4; k++) { const part = X.beats([...X.rest(k), ...cells], 4); while (part.length % 4) part.push('_'); b.push(...part); }
      return X.fill(b, 16).join(' ');
    } },
];
// in level order within each skill (stable: the order above is kept inside a level)
EXERCISES.sort((a, b) => a.level - b.level);

// ---------- laying an exercise out ----------
// lay: notes per matra (a number) or 'ladder'. M: matras in the taal. Returns phrases.js notation.
function exerciseNotes(ex, c, lay, M) {
  if (ex.notes) return ex.notes(c);
  const slots = ex.seq(c);
  const chunk = (s, k) => { const b = []; for (let i = 0; i < s.length; i += k) { const g = s.slice(i, i + k); while (g.length < k) g.push('-'); b.push(g.join('')); } return b; };
  const pad = b => { while (b.length % M) b.push('_'); return b; };
  if (lay === 'ladder') {
    // each speed fills the same time: the line once in thah, twice in dugun, four times in chaugun
    const base = Math.min(...ex.lays);
    return ex.lays.flatMap(k => pad(chunk(Array(Math.round(k / base)).fill(slots).flat(), k))).join(' ');
  }
  return pad(chunk(slots, lay)).join(' ');
}

// The scale an exercise runs over: Bilawal, or the notes of a raga (one form of each swara,
// the aaroh's form where a raga uses two, ignoring its vakra turns).
const BILAWAL = ['S', 'R', 'G', 'm', 'P', 'D', 'N'];
function ragaScale(r) {
  if (!r || r.isFree) return BILAWAL;
  const seen = new Map();
  const add = l => { const g = 'SrRgGmMPdDnN'.indexOf(l); const key = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6][g]; if (!seen.has(key)) seen.set(key, l); };
  for (const m of `${r.aaroh} ${r.avaroh}`.matchAll(/[SrRgGmMPdDnN]/g)) add(m[0]);
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
}

if (typeof module !== 'undefined') module.exports = { EXERCISES, TRACKS, LEVEL_NAMES, SOURCES, X, exerciseNotes, ragaScale, BILAWAL };
