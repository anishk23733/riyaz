'use strict';
// Practice: a graded riyaz course. Edit freely; the Practice view builds itself from this file.
//
// Every exercise has a purpose, exact notes, a taal and a tempo plan, what to listen for, the
// usual mistakes and how to make it harder. Most are built over a scale you choose in the app
// (Bilawal, as alankars are first taught, or the notes of your current raga), so the same
// exercise works in any raga.
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
  nios: { name: 'NIOS, Hindustani Music (242), Practical lesson 3: Alankaras', url: 'https://www.nios.ac.in/media/documents/Hindustani_Music_242/LG/eng/LG_HM_242_E_prac_L3.pdf' },
  senders: { name: 'Warren Senders, Thinking about palta exercises', url: 'https://www.warrensenders.com/journal/?p=552' },
  sendersTempo: { name: 'Warren Senders, More notes on practicing (tempo)', url: 'https://www.warrensenders.com/journal/?p=613' },
  swRiyaz: { name: 'SwarGanga, How to practice Hindustani music', url: 'https://www.swarganga.org/articles/icmconcepts/icm44' },
  swTaan: { name: 'SwarGanga, Taan and its types', url: 'https://swarganga.org/articles/icmconcepts/icm8.php' },
  swAlankar: { name: 'SwarGanga, Alankar (kan, andolan)', url: 'https://swarganga.org/articles/icmconcepts/icm11.php' },
  orn: { name: 'Raag Hindustani, Ornamentation (meend, kan, andolan, gamak, khatka, murki)', url: 'https://raag-hindustani.com/Embellishment.html' },
  murki: { name: 'Wikipedia, Murki', url: 'https://en.wikipedia.org/wiki/Murki' },
  meru: { name: 'Wikipedia, Merukhand', url: 'https://en.wikipedia.org/wiki/Merukhand' },
  prastaar: { name: 'Gandharv Shastra, Swar prastaar (khandameru)', url: 'https://sites.google.com/view/gandharvshastra/TheoryofMusic/GayanVadanShastra/swarprastaar' },
  riyaz: { name: 'Gandharv Shastra, Riyaaz (mandra sadhna, slow first)', url: 'https://sites.google.com/view/gandharvshastra/TheoryofMusic/GayanVadanShastra/voice/riyaz' },
  laya: { name: 'DigiTabla, Layakari (thah, dugun, tigun, chaugun, aad, kuaad)', url: 'https://digitabla.com/reference/concepts-and-definitions/layakari/' },
  tihai: { name: 'Wikipedia, Tihai', url: 'https://en.wikipedia.org/wiki/Tihai' },
  tala: { name: 'Wikipedia, Tala (music): tali, khali, sam', url: 'https://en.wikipedia.org/wiki/Tala_(music)' },
  darbari: { name: 'Wikipedia, Darbari Kanada', url: 'https://en.wikipedia.org/wiki/Darbari_Kanada' },
};

const TRACKS = [
  { id: 'swar', name: 'Swar', about: 'Sa and steady notes: the voice settled on the drone' },
  { id: 'alankar', name: 'Alankars', about: 'Paltas: patterns moved through the scale, in thah, dugun and chaugun' },
  { id: 'orn', name: 'Ornaments', about: 'Meend, kan, khatka, murki, andolan and gamak, one at a time' },
  { id: 'raga', name: 'Raga', about: "Your current raga's aaroh, pakad and phrases, in time" },
  { id: 'taan', name: 'Taans', about: 'Speed with control: bursts, sapaat and alankar taans landing on sam' },
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
  // every ordering of the given degrees (merukhand / khandameru)
  perms(a) {
    if (a.length <= 1) return [a];
    return a.flatMap((x, i) => X.perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  },
  // the call, then the same notes again as your turn
  echo(call) { return [...call, ...call.map(t => /^[SrRgGmMPdDnN(~^]/.test(t) ? '?' + t : t)]; },
  // a raga line like "N. R G R, P R" -> tokens and breaks
  ragaLine(str) { return [...str.matchAll(/([SrRgGmMPdDnN][.']?)|,/g)].map(m => m[1] || ','); },
  isNote(t) { return /[SrRgGmMPdDnN]/.test(t); },
  // slots -> matra tokens of k slots each (the last one filled with holds)
  beats(s, k) { const b = []; for (let i = 0; i < s.length; i += k) { const g = s.slice(i, i + k); while (g.length < k) g.push('-'); b.push(g.join('')); } return b; },
  // fill to whole cycles of M matras with rests
  fill(b, M) { while (b.length % M) b.push('_'); return b; },
  // pitch of a token in semitones from madhya Sa (for the raga's resting notes)
  letter(t) { const m = /([SrRgGmMPdDnN])/.exec(t); return m ? m[1] : null; },
};

// Raga phrase -> slots: each note `per` slots; a note before a comma (a phrase end, where the
// voice rests) and the vadi/samvadi are held longer.
function ragaSlots(str, r, per, restAtEnd = true) {
  const toks = X.ragaLine(str), out = [];
  toks.forEach((t, i) => {
    if (t === ',') { out.push(...X.rest(per)); return; }
    const last = i === toks.length - 1 || toks[i + 1] === ',';
    const strong = X.letter(t) === r.vadi || X.letter(t) === r.samvadi;
    out.push(...X.hold(t, per * (last ? 3 : strong ? 2 : 1)));
  });
  if (restAtEnd) out.push(...X.rest(per));
  return out;
}

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
  { id: 'slowline', track: 'swar', level: 2, name: 'Aaroh and avaroh, 4 matras a note', minutes: 5, taal: 'Teentaal',
    bpm: { start: 80, target: 56, step: -4 }, lays: [1], scale: true,
    purpose: 'Long notes in sequence: each one placed and held, with clean changes. It joins swar sadhana to the scale you will use for alankars.',
    how: ['Each note held 4 matras, changing exactly on the vibhag lines.', 'Breathe quickly before a new note, never in the middle of one.'],
    listen: 'Every note flat on the graph, and each change a clean step: no slide in, no slide out.',
    mistakes: 'Notes going flat on the way down (the avaroh is where most singers sag); running out of breath on the last matra.',
    harder: 'Slower; then in one breath per two notes.',
    seq: c => X.line(c).flatMap(t => X.hold(t, 4)) },
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

  // ======================= Alankars =======================
  { id: 'a-line', track: 'alankar', level: 1, name: 'Aaroh and avaroh', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 120, step: 4 }, lays: [1, 2, 4], ladder: true, scale: true,
    purpose: 'The first alankar: every note of the scale in order, up and down. In thah it is exactly one Teentaal cycle, so it also teaches where each note falls in the taal.',
    how: ['Sing in sargam first, then in akaar.', 'One note per matra (thah), then two (dugun), then four (chaugun). Ladder sings all three back to back.'],
    listen: 'Each note on the matra, not after it. In dugun and chaugun, notes evenly spaced: no rushing up, no slowing down.',
    mistakes: 'Ni and komal notes sagging; the avaroh speeding up; a gap at the top before turning.',
    harder: 'Raise the tempo 4 BPM at a time, and only when chaugun is clean. Then switch the scale to your raga.',
    src: ['nios', 'swRiyaz'],
    seq: c => X.line(c) },
  { id: 'a-double', track: 'alankar', level: 1, name: 'Each note twice', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 112, step: 4 }, lays: [2, 4], ladder: true, scale: true,
    purpose: 'Saying each note twice, the second one re-struck without a slide, teaches clean articulation: the start of fast singing.',
    how: ['SS RR GG… one pair per matra in dugun, two pairs in chaugun.', 'Re-strike the second note with a light push of breath, not a glottal click.'],
    listen: 'Two separate, equal notes at the same pitch. On the graph, two bars at exactly the same height.',
    mistakes: 'The second note louder and sharper than the first; smearing the pair into one long note.',
    harder: 'Chaugun at higher tempo; then three times each (SSS RRR) in tigun.',
    seq: c => X.palta(c, [0, 0]) },
  { id: 'a-pairs', track: 'alankar', level: 1, name: 'Pairs: SR RG Gm…', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 120, step: 4 }, lays: [1, 2, 4], ladder: true, scale: true,
    purpose: 'The smallest moving cell. Each pair starts on the next note, so you keep restarting from a new place: the basis of every palta.',
    how: ['Sing the pairs up to taar Sa, then the mirror pairs down (S\'N ND DP…).'],
    listen: 'Equal notes. The first of each pair slightly accented, so the pattern is audible.',
    mistakes: 'Swallowing the second note of each pair; landing short of taar Sa on the turn.',
    harder: 'Higher tempo in chaugun.',
    src: ['nios'],
    seq: c => X.palta(c, [0, 1]) },
  { id: 'a-threes', track: 'alankar', level: 1, name: 'Threes: SRG RGm GmP…', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 112, step: 4 }, lays: [1, 3], ladder: true, scale: true,
    purpose: 'The classic first palta. In tigun each cell fills one matra exactly, which teaches three-to-a-beat (tisra) feel.',
    how: ['Up in threes to D N Ṡ, then down Ṡ N D, N D P … to G R S.', 'Accent the first note of each three, lightly.'],
    listen: 'In tigun, three even notes in every matra and the first of each on the beat.',
    mistakes: 'Turning tigun into "two fast, one long"; dropping the accent so the cells blur.',
    harder: 'Faster; then sing it in chaugun (four to a matra), where the cells cross the beat; see Threes against four.',
    src: ['nios'],
    seq: c => X.palta(c, [0, 1, 2]) },
  { id: 'a-fours', track: 'alankar', level: 1, name: 'Fours: SRGm RGmP…', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 120, step: 4 }, lays: [1, 2, 4], ladder: true, scale: true,
    purpose: 'Four-note cells fit the matra in chaugun and the vibhag in thah. This one is the backbone of alankar taans.',
    how: ['Up in fours to P D N Ṡ, then down Ṡ N D P … to m G R S.'],
    listen: 'In chaugun the first note of every cell exactly on the matra.',
    mistakes: 'Rushing the cell and leaving a gap before the next one; getting lost in the avaroh.',
    harder: 'Higher tempo; then in your raga scale.',
    src: ['nios'],
    seq: c => X.palta(c, [0, 1, 2, 3]) },
  { id: 'a-skip', track: 'alankar', level: 2, name: 'Skip a note: SG Rm GP…', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 112, step: 4 }, lays: [1, 2, 4], ladder: true, scale: true,
    purpose: 'Leaps of a third without a guide note in between. You have to hear the target before you sing it.',
    how: ['S G, R m, G P … up to D Ṡ, then Ṡ D, N P … down to G S.'],
    listen: 'The upper note arrives in tune at once, with no scoop.',
    mistakes: 'Sneaking the skipped note in on the way; the second note of each leap flat.',
    harder: 'Faster; then Skip two (fourths).',
    src: ['nios'],
    seq: c => X.palta(c, [0, 2]) },
  { id: 'a-dip', track: 'alankar', level: 2, name: 'Dip below and back: S N̤ S, R S R…', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 112, step: 4 }, lays: [1, 3], ladder: true, scale: true,
    purpose: 'Each note is touched, left for its lower neighbour and returned to: the turn that most raga phrases are made of.',
    how: ['S Ṇ S, R S R, G R G … up to taar Sa, then its mirror coming down (touching the note above).'],
    listen: 'The returning note exactly where it started.',
    mistakes: 'Coming back a little flat; making the neighbour note too short to hear.',
    harder: 'Faster, then in the raga scale (check the raga allows each turn).',
    src: ['senders'],
    seq: c => X.palta(c, [0, -1, 0]) },
  { id: 'a-upback', track: 'alankar', level: 2, name: 'Three up, one back: SRGR RGmG…', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 112, step: 4 }, lays: [2, 4], ladder: true, scale: true,
    purpose: 'A vakra (turning) cell that climbs while stepping back. It trains the voice to change direction quickly without losing pitch.',
    how: ['S R G R, R G m G … then the mirror coming down.'],
    listen: 'The turn note as clear as the others.',
    mistakes: 'The third note overshooting; the return note flat.',
    harder: 'Faster in chaugun.',
    seq: c => X.palta(c, [0, 1, 2, 1]) },
  { id: 'a-down3', track: 'alankar', level: 2, name: 'Threes from above: GRS mGR…', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 112, step: 4 }, lays: [1, 3], ladder: true, scale: true,
    purpose: 'The same threes, but each cell falls while the pattern climbs. It breaks the habit of always singing a cell upward.',
    how: ['G R S, m G R, P m G … up to Ṡ N D, then rising cells coming down.'],
    listen: 'The first note of each cell, the highest, lands in tune with no reach.',
    mistakes: 'Hesitating before each cell; the lowest note of the cell going flat.',
    harder: 'Faster in tigun.',
    seq: c => X.palta(c, [2, 1, 0]) },
  { id: 'a-fives', track: 'alankar', level: 3, name: 'Fives: SRGmP RGmPD…', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 104, step: 4 }, lays: [1, 2, 4], ladder: true, scale: true,
    purpose: 'Five-note cells do not fit two or four to a matra, so in dugun and chaugun the cells start in different places of the beat. You have to keep count.',
    how: ['Up in fives to m P D N Ṡ, then down in fives.'],
    listen: 'Even notes regardless of where a cell starts; the taal stays steady under you.',
    mistakes: 'Adding a beat to make the cell "fit"; drifting ahead of the tabla.',
    harder: 'Faster in chaugun.',
    src: ['nios'],
    seq: c => X.palta(c, [0, 1, 2, 3, 4]) },
  { id: 'a-fourths', track: 'alankar', level: 3, name: 'Skip two: S m, R P, G D…', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 104, step: 4 }, lays: [1, 2, 4], ladder: true, scale: true,
    purpose: 'Leaps of a fourth. Sa to Ma and Re to Pa are the intervals that tune the whole scale; this makes them automatic.',
    how: ['S m, R P, G D, m N, P Ṡ, then Ṡ P, N m, D G, P R, m S.'],
    listen: 'Each leap like a bell: the two notes consonant with each other.',
    mistakes: 'Tivra Ma or komal notes making the fourth slightly off; aiming too high on the leap.',
    harder: 'Faster; then fifths (Chhut alankar).',
    seq: c => X.palta(c, [0, 3]) },
  { id: 'a-chhut', track: 'alankar', level: 3, name: 'Chhut alankar: S P, R D, G N…', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 100, step: 4 }, lays: [2, 4], scale: true,
    purpose: 'Leaps of a fifth up and down: the movement of chhut taans, which jump instead of walking.',
    how: ['S P, R D, G N, m Ṡ, then Ṡ m, N G, D R, P S.'],
    listen: 'Clean landings with no slide. Pa against Sa should sound perfectly open.',
    mistakes: 'Leaping short (flat) on the way up; a breath between leaps.',
    harder: 'Faster in chaugun.',
    seq: c => X.palta(c, [0, 4]) },
  { id: 'a-meru3', track: 'alankar', level: 3, name: 'Merukhand on three notes', minutes: 5, taal: 'Teentaal',
    bpm: { start: 60, target: 100, step: 4 }, lays: [1, 3], ladder: true, scale: true,
    purpose: 'Merukhand is singing every ordering of a set of notes. Three notes give 6 orders; doing it on S R G, then R G m and so on up, makes any turn of those notes available to you.',
    how: ['S R G, S G R, R S G, R G S, G S R, G R S; then the same six on R G m, and so on up to D N Ṡ.'],
    listen: 'Each group of three clearly separate, and every note equally sure in every position.',
    mistakes: 'Skipping or repeating an order; losing the pitch of a note when it comes first.',
    harder: 'Faster in tigun; then four notes.',
    src: ['meru', 'prastaar'],
    seq: c => {
      const out = [];
      for (let s = 0; s + 2 <= c.n; s++) for (const p of X.perms([0, 1, 2])) for (const k of p) out.push(X.tok(c, s + k));
      return out;
    } },
  { id: 'a-meru4', track: 'alankar', level: 4, name: 'Merukhand on four notes', minutes: 6, taal: 'Teentaal',
    bpm: { start: 56, target: 96, step: 4 }, lays: [2, 4], scale: true,
    purpose: "Four notes give 24 orders. Do them on the lower tetrachord S R G m, then on the upper P D N Ṡ. Amir Khan is quoted as recommending four-note paltas over trying all 5040 orders of seven.",
    how: ['All 24 orders of S R G m, then all 24 of P D N Ṡ.'],
    listen: 'No order sounds less sure than another.',
    mistakes: 'Repeating an order or missing one; watch the graph.',
    harder: 'Faster; then in your raga, skipping the orders the raga does not allow.',
    src: ['meru', 'prastaar'],
    seq: c => [0, 4].flatMap(b => X.perms([0, 1, 2, 3]).flatMap(p => p.map(k => X.tok(c, b + k)))) },
  { id: 'a-2oct', track: 'alankar', level: 4, name: 'Fours across two octaves', minutes: 5, taal: 'Teentaal',
    bpm: { start: 60, target: 108, step: 4 }, lays: [2, 4], scale: true,
    purpose: 'The same fours from mandra Pa to taar Pa: a taan-length line across the full range at speed.',
    how: ['Up in fours from P̣ to Ṗ, then down.'],
    listen: 'The same tone and evenness in the mandra notes as at the top.',
    mistakes: 'The low notes going quiet and getting lost; strain over taar Sa.',
    harder: 'Faster. If taar Pa is not comfortable, practise to taar Ga first.',
    seq: c => X.palta(c, [0, 1, 2, 3], -3, c.n + 4) },
  { id: 'a-3in4', track: 'alankar', level: 4, name: 'Threes against four', minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 96, step: 4 }, lays: [4], scale: true,
    purpose: 'Three-note cells sung four to a matra, so the cell and the beat line up only every three matras. It trains you to keep the pattern and the taal apart in your head.',
    how: ['The threes palta in chaugun. Keep the tabla on and do not let the cells pull you off the beat.'],
    listen: 'Even notes; the cell accent moving across the beat (on, then the 4th, then the 3rd quarter…).',
    mistakes: 'Slowing down to make the cells match the beat.',
    harder: 'Faster.',
    seq: c => X.palta(c, [0, 1, 2]) },

  // ======================= Ornaments =======================
  { id: 'o-meend1', track: 'orn', level: 2, name: 'Slow meend, one step', minutes: 5, taal: 'Teentaal',
    bpm: { start: 60, target: 40, step: -4 }, lays: [1], scale: true,
    purpose: 'A meend is a smooth glide from one note to another. Gliding slowly between neighbours is the way to learn to control it: the voice passes through every point in between at an even speed.',
    how: ['Hold a note 2 matras, glide up to the next over 2, glide back over 2.', 'Re to Ga, Ga to Ma … up to taar Sa.'],
    listen: 'On the graph, a straight slope, not a curve that rushes at the start or at the end. The arrival note exactly in tune.',
    mistakes: 'A step instead of a glide (the voice jumps then corrects); arriving sharp; a bump of volume in the middle.',
    harder: 'Slower: the slower the glide, the harder it is to keep even.',
    src: ['orn'],
    seq: c => {
      const out = [];
      for (let i = 0; i < c.n; i++) out.push(...X.hold(X.tok(c, i), 2), ...X.hold('~~' + X.tok(c, i + 1), 2), ...X.hold('~~' + X.tok(c, i), 2));
      return out;
    } },
  { id: 'o-meend3', track: 'orn', level: 2, name: 'Meend across a third', minutes: 5, taal: 'Teentaal',
    bpm: { start: 60, target: 40, step: -4 }, lays: [1], scale: true,
    purpose: 'A longer glide that passes over a note. Real meends often span several notes; the skipped note is felt, not sung.',
    how: ['Hold a note, glide up a third, glide back. S to G, R to m … to D to Ṡ.'],
    listen: 'An even glide that does not pause on the note in between.',
    mistakes: 'Stopping on the middle note; overshooting the top.',
    harder: 'Slower.',
    src: ['orn'],
    seq: c => {
      const out = [];
      for (let i = 0; i + 2 <= c.n; i++) out.push(...X.hold(X.tok(c, i), 2), ...X.hold('~~' + X.tok(c, i + 2), 2), ...X.hold('~~' + X.tok(c, i), 2));
      return out;
    } },
  { id: 'o-kanup', track: 'orn', level: 2, name: 'Kan from above', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 96, step: 4 }, lays: [1], scale: true,
    purpose: 'A kan is a grace note: a quick touch of a neighbour before the main note. Touching the upper neighbour is the most common kan.',
    how: ['Each note held 2 matras, touched first by the note above it: (R)S, (G)R, (m)G … and back down.'],
    listen: 'The kan is heard but takes no time: the main note still starts on the matra.',
    mistakes: 'Making the kan a full note; the kan arriving late so the main note is late.',
    harder: 'Faster; then Kan from below.',
    src: ['orn', 'swAlankar'],
    seq: c => X.line(c).flatMap((t, k, a) => { const i = k <= c.n ? k : 2 * c.n + 1 - k; return X.hold(`(${X.tok(c, i + 1)})${t}`, 2); }) },
  { id: 'o-kandown', track: 'orn', level: 3, name: 'Kan from below', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 96, step: 4 }, lays: [1], scale: true,
    purpose: 'A kan from the note below is harder to keep quick: the voice wants to slide up from it.',
    how: ['Each note touched first by the note below: (Ṇ)S, (S)R … and back down.'],
    listen: 'A flick, not a scoop.',
    mistakes: 'The kan turning into a meend; the main note flat.',
    harder: 'Faster.',
    src: ['orn'],
    seq: c => X.line(c).flatMap((t, k) => { const i = k <= c.n ? k : 2 * c.n + 1 - k; return X.hold(`(${X.tok(c, i - 1)})${t}`, 2); }) },
  { id: 'o-khatka', track: 'orn', level: 3, name: 'Khatka on each note', minutes: 3, taal: 'Teentaal',
    bpm: { start: 56, target: 88, step: 4 }, lays: [1], scale: true,
    purpose: 'A khatka sings one note as a quick cluster: the note above, the note, the note below, the note, then it rests. It is sung with a little force.',
    how: ['In one matra: upper, note, lower, note. Then hold the note one matra. From Sa up to taar Sa.'],
    listen: 'Four crisp notes and a steady landing.',
    mistakes: 'Blurring the cluster into a wobble; landing off the note.',
    harder: 'Faster.',
    src: ['orn'],
    seq: c => {
      const out = [];
      for (let i = 0; i <= c.n; i++) { out.push(X.tok(c, i + 1) + X.tok(c, i) + X.tok(c, i - 1) + X.tok(c, i), '-'); }
      return out;
    } },
  { id: 'o-murki', track: 'orn', level: 3, name: 'Murki on each note', minutes: 3, taal: 'Teentaal',
    bpm: { start: 56, target: 88, step: 4 }, lays: [1], scale: true,
    purpose: 'A murki is lighter than a khatka: a quick turn through the note above and back, like an inverted mordent, used all through thumri and light classical.',
    how: ['In one matra: note, upper, note. Then hold the note one matra. Sa up to taar Sa and back.'],
    listen: 'Light and fast, with the weight on the landing note.',
    mistakes: 'Singing it as three equal heavy notes; the upper note too high.',
    harder: 'Faster, and softer.',
    src: ['murki', 'orn'],
    seq: c => X.line(c).flatMap((t, k) => { const i = k <= c.n ? k : 2 * c.n + 1 - k; return [t + X.tok(c, i + 1) + t, '-']; }) },
  { id: 'o-sapa', track: 'orn', level: 3, name: 'Meend Sa to Pa and back', minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 40, step: -4 }, lays: [1],
    purpose: 'A wide meend over a fifth, the span of the big glides in slow aalap. Every note in between is passed, none is stopped on.',
    how: ['Sa 4 matras, glide to Pa over 4, hold Pa 4, glide back to Sa over 4.', 'Then Sa to Ma and back.'],
    listen: 'An even, unhurried slope; both ends in tune.',
    mistakes: 'Steps on the way (the glide catching on Re or Ga); rushing the last part.',
    harder: 'Slower.',
    src: ['orn'],
    seq: () => [...X.hold('S', 4), ...X.hold('~~P', 4), ...X.hold('P', 4), ...X.hold('~~S', 4), ...X.hold('S', 4), ...X.hold('~~m', 4), ...X.hold('m', 4), ...X.hold('~~S', 4)] },
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
  { id: 'o-gamak', track: 'orn', level: 4, name: 'Gamak aaroh and avaroh', minutes: 3, taal: 'Teentaal',
    bpm: { start: 56, target: 96, step: 4 }, lays: [2], scale: true, gamak: true,
    purpose: 'A gamak is sung with force so the note shakes: each note is struck from the one above. It is heavy and needs breath support, not throat.',
    how: ['Two notes per matra, each shaken. Push from the diaphragm, keep the throat open.'],
    listen: 'Each note clearly itself, shaken but not blurred into the next.',
    mistakes: 'A goat-like bleat from the throat; the shake hiding the pitch.',
    harder: 'Faster; then gamak taans.',
    src: ['orn', 'swTaan'],
    seq: c => X.line(c) },

  // ======================= Raga (your current raga) =======================
  { id: 'r-aaroh', track: 'raga', level: 1, name: 'Aaroh and avaroh with its resting notes', minutes: 4, taal: 'Teentaal', raga: 'current',
    bpm: { start: 60, target: 80, step: 4 }, lays: [1, 2],
    purpose: "The raga's way up and down, with its vadi and samvadi held longer, so that you hear which notes it leans on.",
    how: ['Each note one slot; vadi and samvadi two; the last note of each line three.'],
    listen: 'The vadi should feel like a place to rest, not just a longer note.',
    mistakes: 'Singing the aaroh straight when the raga turns (vakra); using a note the raga leaves out going up or down.',
    harder: 'Dugun; then sing it with the guide off.',
    seq: c => [...ragaSlots(c.raga.aaroh, c.raga, 1), ...ragaSlots(c.raga.avaroh, c.raga, 1)] },
  { id: 'r-pakad', track: 'raga', level: 2, name: 'Pakad, slow then in dugun', minutes: 4, taal: 'Teentaal', raga: 'current',
    bpm: { start: 60, target: 84, step: 4 }, lays: [1, 2], ladder: true,
    purpose: 'The pakad is the phrase that identifies the raga. Sung slowly with its rests, then twice as fast, it becomes something your voice reaches for by itself.',
    how: ['Each phrase ends on a held note: that is where the raga rests. Breathe at the gaps.'],
    listen: 'The ends of phrases exactly in tune; they are what the listener remembers.',
    mistakes: 'Rushing the held notes; flattening the shape into a scale.',
    harder: 'Ladder (thah then dugun); then guide off.',
    seq: c => ragaSlots(c.raga.pakad || c.raga.aaroh, c.raga, 1) },
  { id: 'r-echo', track: 'raga', level: 2, name: 'Key phrases: listen, then answer', minutes: 5, taal: 'Teentaal', raga: 'current',
    bpm: { start: 60, target: 76, step: 4 }, lays: [1],
    purpose: 'Call and response, the oldest way of learning a raga: the phrase is played, then you sing it back in the same time.',
    how: ['Each phrase is played once; in the gap that follows, sing it back. The graph shows your turn as outlined notes.'],
    listen: 'Your answer starts on the same matra the phrase did, one cycle later.',
    mistakes: 'Starting early; changing the rhythm of the phrase.',
    harder: 'Turn Sing on and aim for 80% in tune; then try the phrases with the guide off.',
    seq: c => [c.raga.pakad, ...(c.raga.phrases || [])].filter(Boolean).flatMap(p => {
      const call = ragaSlots(p, c.raga, 1, false);
      while (call.length % 8) call.push('_');
      return X.echo(call);
    }) },
  { id: 'r-chalan', track: 'raga', level: 3, name: 'Chalan: phrases strung together', minutes: 5, taal: 'Teentaal', raga: 'current',
    bpm: { start: 56, target: 76, step: 4 }, lays: [1, 2],
    purpose: "The raga's phrases joined into one movement, from Sa up and back to Sa, the way an aalap moves through it.",
    how: ['Sing it as one line, resting where the phrases end.'],
    listen: 'Each phrase leading into the next, not a list.',
    mistakes: 'Losing the raga in the joins (a note out of place between two phrases).',
    harder: 'Dugun; guide off; then make your own phrases in the Library style.',
    seq: c => [...ragaSlots(c.raga.aaroh, c.raga, 1), ...[c.raga.pakad, ...(c.raga.phrases || [])].filter(Boolean).flatMap(p => ragaSlots(p, c.raga, 1)), ...ragaSlots(c.raga.avaroh, c.raga, 1)] },

  // ======================= Taans =======================
  { id: 't-bursts', track: 'taan', level: 2, name: 'Speed bursts', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 116, step: 4 }, lays: [1], scale: true,
    purpose: 'Four fast notes, then a long rest on the fifth. The burst is short enough to sing cleanly well above your sapaat speed, and the hold resets the voice.',
    how: ['Four notes in one matra, the fifth held for three. Climbing from Sa to Ṡ, then falling.'],
    listen: 'Every burst even, and the held note exactly in tune; that is the proof the burst was controlled.',
    mistakes: 'The last note of the burst rushed into the hold; the held note sharp after the effort.',
    harder: 'Faster; then two bursts joined before the hold.',
    seq: c => {
      const out = [];
      for (let s = 0; s + 4 <= c.n; s++) out.push([0, 1, 2, 3].map(k => X.tok(c, s + k)).join(''), X.tok(c, s + 4), '-', '-');
      for (let s = c.n; s - 4 >= 0; s--) out.push([0, 1, 2, 3].map(k => X.tok(c, s - k)).join(''), X.tok(c, s - 4), '-', '-');
      return out;
    } },
  { id: 't-sapaat2', track: 'taan', level: 2, name: 'Sapaat in dugun, landing on sam', minutes: 3, taal: 'Teentaal',
    bpm: { start: 70, target: 120, step: 4 }, lays: [1], scale: true, lands: 'sam',
    purpose: 'A sapaat taan goes straight up and straight down. This one is timed to finish on sam, which is the point of a taan in performance.',
    how: ['Two notes per matra, up to taar Sa and down, and the last Sa exactly on sam.'],
    listen: 'The final Sa together with the tabla\'s Dha on sam.',
    mistakes: 'Arriving early (rushing the avaroh) or late.',
    harder: 'Faster; then chaugun.',
    src: ['swTaan'],
    notes: c => { const l = X.line(c); const b = []; for (let i = 0; i < l.length; i += 2) b.push(l[i] + (l[i + 1] || '-')); return b.join(' ') + ' S'; } },
  { id: 't-sapaat4', track: 'taan', level: 3, name: 'Sapaat in chaugun, landing on sam', minutes: 3, taal: 'Teentaal',
    bpm: { start: 60, target: 120, step: 4 }, lays: [1], scale: true, lands: 'sam',
    purpose: 'Four notes a matra: the speed of a real taan. The scale twice up and down, then Sa on sam.',
    how: ['Breathe before you start, sing it in one breath, land on sam.'],
    listen: 'Notes evenly spaced the whole way; no swallowed notes at the turns.',
    mistakes: 'Notes merging into a slide at speed; going flat as breath runs out.',
    harder: 'Faster; at 120 BPM this is 8 notes a second.',
    src: ['swTaan'],
    notes: c => { const l = [...X.line(c), ...X.line(c)]; const b = []; for (let i = 0; i < l.length; i += 4) b.push(l.slice(i, i + 4).join('')); return b.join(' ') + ' S'; } },
  { id: 't-alankar', track: 'taan', level: 3, name: 'Alankar taan in fours', minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 112, step: 4 }, lays: [1], scale: true, lands: 'sam',
    purpose: 'An alankar taan is an alankar sung at taan speed. The fours palta in chaugun, ending on sam.',
    how: ['Each cell of four in one matra. Up and down, Sa on sam.'],
    listen: 'Each cell starting exactly on the matra.',
    mistakes: 'Rushing the descending cells.',
    harder: 'Faster; then with threes in tigun.',
    src: ['swTaan', 'nios'],
    notes: c => { const l = X.palta(c, [0, 1, 2, 3]); const b = []; for (let i = 0; i < l.length; i += 4) b.push(l.slice(i, i + 4).join('')); return b.join(' ') + ' S'; } },
  { id: 't-tigun', track: 'taan', level: 3, name: 'Tigun taan in threes', minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 108, step: 4 }, lays: [1], scale: true, lands: 'sam',
    purpose: 'Three notes a matra, the threes palta up and down, landing on sam. Tigun feels very different from chaugun and needs its own practice.',
    how: ['One cell per matra.'],
    listen: 'A rolling, even three-feel.',
    mistakes: 'Uneven threes (long-short-short).',
    harder: 'Faster.',
    src: ['laya'],
    notes: c => { const l = X.palta(c, [0, 1, 2]); const b = []; for (let i = 0; i < l.length; i += 3) b.push(l.slice(i, i + 3).join('')); return b.join(' ') + ' S'; } },
  { id: 't-2oct', track: 'taan', level: 4, name: 'Two-octave sapaat', minutes: 3, taal: 'Teentaal',
    bpm: { start: 56, target: 112, step: 4 }, lays: [1], scale: true, lands: 'sam',
    purpose: 'Mandra Pa to taar Pa and back in chaugun: range and speed together.',
    how: ['One breath if you can; if not, plan one quick breath at the top.'],
    listen: 'The bottom notes as clear as the top ones.',
    mistakes: 'The lowest notes inaudible; the top cramped.',
    harder: 'Faster.',
    notes: c => { const l = X.line(c, -3, c.n + 4); while (l.length % 4) l.push('-'); const b = []; for (let i = 0; i < l.length; i += 4) b.push(l.slice(i, i + 4).join('')); return b.join(' ') + ' S'; } },
  { id: 't-tihai', track: 'taan', level: 4, name: 'Taan ending in a tihai', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 112, step: 4 }, lays: [1], scale: true, lands: 'sam',
    purpose: 'A sapaat taan, then a short phrase three times, the third landing on sam: how a taan is finished in performance.',
    how: ['The taan in chaugun, then "G R S" three times in dugun with a held Sa between, the last Sa on sam.'],
    listen: 'The three repeats identical, the last Sa with the tabla on sam.',
    mistakes: 'Uneven gaps between the three repeats.',
    harder: 'Faster; then make your own tihai (phrase × 3 + 2 gaps = cycle length).',
    src: ['tihai', 'swTaan'],
    notes: c => { const l = X.line(c); const b = []; for (let i = 0; i < l.length; i += 4) b.push(l.slice(i, i + 4).join('')); return b.join(' ') + ` ${X.tok(c, 2)}${X.tok(c, 1)} S- ${X.tok(c, 2)}${X.tok(c, 1)} S- ${X.tok(c, 2)}${X.tok(c, 1)} S`; } },

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

  // ======================= Further work for intermediate and advanced singers =======================
  { id: 'a-vakra', track: 'alankar', level: 3, name: 'Vakra palta: up two, back one', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 104, step: 4 }, lays: [1, 2, 4], ladder: true, scale: true,
    purpose: 'The cell S G R m (skip up, step back, skip up) moved through the scale. It breaks the habit of singing the next note in line, which is exactly what vakra ragas ask of you.',
    how: ['S G R m, R m G P, G P m D … up to taar Sa, then the mirror image down.', 'Ladder: thah, dugun, then chaugun, each filling the same time.'],
    listen: 'The step back (G to R) as clean as the skip; no extra note slipping in between.',
    mistakes: 'Turning the cell into a straight run at speed (S R G m); the backward step going flat.',
    harder: 'Chaugun at 100+; then in your raga, where some cells will break its rules: notice which.',
    seq: c => X.palta(c, [0, 2, 1, 3]) },
  { id: 'a-sixes', track: 'alankar', level: 4, name: 'Turnaround sixes across the beat', minutes: 5, taal: 'Teentaal',
    bpm: { start: 56, target: 96, step: 4 }, lays: [3, 4], scale: true,
    purpose: 'A six-note cell that climbs four and turns back (S R G m G R). In tigun each cell fills two matras; in chaugun it fills one and a half, so it starts on the beat only every third matra.',
    how: ['S R G m G R, R G m P m G … to the top, then down.', 'Tigun first; in chaugun keep the tabla on and let the cells cross the beat.'],
    listen: 'The turn (m G R) as even as the climb; in chaugun, the beat still clear in your head.',
    mistakes: 'Leaning on the first note of each cell in chaugun and so dragging it onto the beat.',
    harder: 'Chaugun at 96; then guide off.',
    src: ['laya'],
    seq: c => X.palta(c, [0, 1, 2, 3, 2, 1]) },

  { id: 'r-pakad-lay', track: 'raga', level: 4, name: 'Pakad through the layakari', minutes: 5, taal: 'Teentaal', raga: 'current',
    bpm: { start: 56, target: 80, step: 4 }, lays: [1, 2, 3, 4], ladder: true,
    purpose: "Your raga's pakad, with its resting notes, sung in thah, dugun, tigun and chaugun one after another. At speed the phrase must stay the raga's, not turn into a scale run.",
    how: ['Ladder: each speed fills the same time, so the pakad comes once in thah, twice in dugun, three times in tigun and four in chaugun.', 'Tigun is the hard one: three to a matra against a four-beat feel.'],
    listen: 'The held notes still held (shorter, but there) at chaugun; the raga still recognisable.',
    mistakes: 'Dropping the rests at speed, so the phrases run into each other.',
    harder: 'Guide off; then the same with a key phrase of your own.',
    src: ['laya'],
    seq: c => ragaSlots(c.raga.pakad || c.raga.aaroh, c.raga, 1) },
  { id: 'r-taan', track: 'raga', level: 4, name: "Raga taan on its own aaroh and avaroh", minutes: 4, taal: 'Teentaal', raga: 'current',
    bpm: { start: 56, target: 100, step: 4 }, lays: [1], lands: 'sam',
    purpose: "A sapaat taan that follows the raga's aaroh and avaroh, turns and skipped notes included, in chaugun, the last Sa on sam. The scale taans are no use in a raga that skips Pa going up.",
    how: ["Four notes a matra, up by the aaroh and down by the avaroh, Sa on sam."],
    listen: 'The vakra turns and skipped notes still there at speed.',
    mistakes: 'Filling in the notes the raga leaves out; the turn smoothed into a straight line.',
    harder: 'Faster; then end it with a tihai of the last three notes.',
    src: ['swTaan'],
    notes: c => {
      const a = X.ragaLine(c.raga.aaroh).filter(X.isNote), d = X.ragaLine(c.raga.avaroh).filter(X.isNote);
      const all = [...a, ...d.slice(1)], last = all.pop() || 'S';
      return X.beats(all, 4).join(' ') + ' ' + last;
    } },

  { id: 't-athgun', track: 'taan', level: 4, name: 'Athgun bursts: eight in a matra', minutes: 4, taal: 'Teentaal',
    bpm: { start: 44, target: 72, step: 3 }, lays: [1], scale: true,
    purpose: 'Eight notes in one matra (up five, back three), then a held note. At 60 BPM that is eight notes a second, the speed of a fast drut taan; the hold checks you arrived in tune.',
    how: ['S R G m P m G R in one matra, then back on S for a matra; then from R, and so on up to taar Sa.', 'Then the mirror image from taar Sa: down five, back up three, and land on the note you started from.'],
    listen: 'All eight notes there, evenly; the held note dead in tune.',
    mistakes: 'Notes 6 to 8 smeared into a slide; the hold arriving late.',
    harder: 'Raise the tempo 3 BPM at a time; then join two bursts before the hold.',
    notes: c => {
      const b = [];
      for (let s = 0; s + 4 <= c.n; s++) b.push([0, 1, 2, 3, 4, 3, 2, 1].map(k => X.tok(c, s + k)).join(''), X.tok(c, s));
      for (let s = c.n; s - 4 >= 0; s--) b.push([0, 1, 2, 3, 4, 3, 2, 1].map(k => X.tok(c, s - k)).join(''), X.tok(c, s));
      return X.fill(b, 16).join(' ');
    } },
  { id: 't-gamak', track: 'taan', level: 4, name: 'Gamak taan in tigun, landing on sam', minutes: 4, taal: 'Teentaal',
    bpm: { start: 52, target: 84, step: 4 }, lays: [1], scale: true, gamak: true, lands: 'sam',
    purpose: 'Every note shaken, three to a matra, up to taar Sa and back, Sa on sam. The gamak must survive the speed without turning into a wobble.',
    how: ['Three notes a matra, each struck from the note above; support from the breath, not the throat.'],
    listen: 'Each note still recognisable inside its shake.',
    mistakes: 'The shake going wider as you tire; losing the tigun into dugun.',
    harder: 'Faster; then chaugun.',
    src: ['swTaan', 'orn'],
    notes: c => { const l = X.updown(c); const last = l.pop(); return X.beats(l, 3).join(' ') + ' ' + last; } },
  { id: 't-laya', track: 'taan', level: 4, name: 'Dugun, tigun, chaugun in one taan', minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 92, step: 4 }, lays: [1], scale: true, lands: 'sam',
    purpose: 'Up in dugun, down in tigun, up and down in chaugun, then a tihai to sam: three speeds back to back, each change exactly on a matra.',
    how: ['Two a matra up to taar Sa; three a matra back down to Sa; four a matra up and down; then "G R S" three times, the last Sa on sam.'],
    listen: 'Each new speed starting exactly on its matra; no blur at the changes.',
    mistakes: 'Tigun sliding into chaugun; the speed changes arriving early.',
    harder: 'Faster; then swap the order (chaugun first).',
    src: ['laya', 'tihai'],
    notes: c => {
      const up = X.up(c, [0]), down = [...up].reverse().slice(1), t = i => X.tok(c, i);
      const ud = X.updown(c);
      return [...X.beats(up, 2), ...X.beats(down, 3), ...X.beats(ud, 4)].join(' ') + ` ${t(2)}${t(1)} S- ${t(2)}${t(1)} S- ${t(2)}${t(1)} S`;
    } },

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
