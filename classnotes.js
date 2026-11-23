'use strict';
// Lessons from Anish's class notes (he is the teacher who wrote them), plus exercises composed
// for this app in the same method. Loaded after ragapaths.js, before practice.js.
//
// His notation, kept verbatim in the data below, and how it is read here:
//   S R G M P D N, komal in lowercase (r g d n). Ma is the other way round from the app:
//   his M is shuddha Ma (app m), his m is tivra Ma (app M).
//   N' (or N’) is mandra, S" (or S”) is taar.
//   Outside brackets a note is one matra. [ ] and { } are double speed: half a matra each.
//   ( ) in an aalap step: sing fast as one string, also double speed here.
//   - holds the note before it one note's length; a long dash (– or —) holds it two.
//   ~ and → are meends into the next note. ... and … are holds; a comma is a breath.
// Where a line doesn't come out to its beat count by these rules, the lesson says so; lines that
// don't fit at all are left out of the lessons and listed on the path (CN_UNPLACED).

const CN_LETTERS = { S: 'S', r: 'r', R: 'R', g: 'g', G: 'G', M: 'm', m: 'M', P: 'P', d: 'd', D: 'D', n: 'n', N: 'N' };

// His line -> units of time: { l: app letter, o: octave, glide, d: length in half-matras } | hold | rest
function cnUnits(src, opts = {}) {
  const aalap = !!opts.aalap, s = String(src).replace(/[​ ]/g, ' ');
  const out = [];
  let depth = 0, glide = 0, i = 0;
  const base = () => (depth > 0 ? 1 : 2);
  const hold = d => { if (out.length) out.push({ hold: true, d }); };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '[' || ch === '{' || (ch === '(' && opts.paren !== 'kan')) { depth++; i++; continue; }
    if (ch === ']' || ch === '}' || (ch === ')' && opts.paren !== 'kan')) { depth = Math.max(0, depth - 1); i++; continue; }
    if (CN_LETTERS[ch]) {
      let o = 0, j = i + 1;
      while (j < s.length && /['’"”]/.test(s[j])) { o += /['’]/.test(s[j]) ? -1 : 1; j++; }
      out.push({ l: CN_LETTERS[ch], o, glide, d: base() });
      glide = 0; i = j; continue;
    }
    if (ch === '-') { hold(base()); i++; continue; }
    if (ch === '–' || ch === '—') { hold(base() * (opts.dashOne ? 1 : 2)); i++; continue; }
    if (ch === '~' || ch === '→') { glide++; i++; continue; }
    if (ch === '.' || ch === '…') {
      let dots = 0;
      while (i < s.length && (s[i] === '.' || s[i] === '…')) { dots += s[i] === '…' ? 3 : 1; i++; }
      hold(base() * (dots > 3 ? 2 : 1));
      continue;
    }
    if (ch === ',' && aalap && out.length && !out[out.length - 1].rest) { out.push({ rest: true, d: 2 }); i++; continue; }
    i++;
  }
  return out;
}
const cnHalves = u => u.reduce((a, x) => a + x.d, 0);

// units -> half-matra slots -> matra tokens in the app's notation
function cnTok(x) {
  return (x.glide ? (x.glide > 1 ? '~~' : '~') : '') + x.l + (x.o < 0 ? '.' : x.o > 0 ? "'" : '');
}
function cnSlots(units) {
  const sl = [];
  for (const x of units) {
    const first = x.rest ? '_' : x.hold ? '-' : cnTok(x);
    sl.push(first);
    for (let k = 1; k < x.d; k++) sl.push(x.rest ? '_' : '-');
  }
  return sl;
}
function cnMatras(slots) {
  const out = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i], b = slots[i + 1] == null ? '-' : slots[i + 1];
    if (b === '-' && a !== '_') out.push(a);
    else if (a === '_' && (b === '_' || b === '-')) out.push('_');
    else out.push(a + b);
  }
  return out;
}
const cnNotes = (src, opts) => cnMatras(cnSlots(cnUnits(src, opts)));

// The grid format (his Yaman Jhaptaal page): one cell a matra; the notes in a cell share it.
function cnCell(cell) {
  if (!cell || cell === '_') return '_';
  const u = cnUnits(cell);
  return u.map(x => (x.rest ? '_' : x.hold ? '-' : cnTok(x))).join('') || '_';
}

// How hard a taan is: speed, turns, range, length. Used to grade a set.
function cnScore(units) {
  const ns = units.filter(x => x.l);
  if (!ns.length) return 0;
  const p = ns.map(x => x.o * 12 + OFF[x.l]);
  let turns = 0;
  for (let k = 2; k < p.length; k++) if ((p[k] - p[k - 1]) * (p[k - 1] - p[k - 2]) < 0) turns++;
  const beats = cnHalves(units) / 2;
  return ns.length / beats * 2 + turns / ns.length * 6 + (Math.max(...p) - Math.min(...p)) / 12 + beats / 10;
}

// A taan in its place: from `from` (the matra it starts on) to the next mukhda at `next`.
// Fits if it ends no more than a matra short of the mukhda (the last note is then held into it).
// If it doesn't, try his lines held out to 8 matras each (his "– 8 beats" marks).
function cnPlace(t, sec) {
  const M = sec.M, d0 = ((sec.next - sec.from) % M + M) % M || M;
  const lines = t.lines.map(l => cnUnits(l, { dashOne: t.dashOne }));
  const fit = halves => { let avail = d0 * 2; while (avail < halves) avail += M * 2; return { avail, slack: avail - halves }; };
  let units = lines.flat(), halves = cnHalves(units), f = fit(halves), how = 'as written';
  if (f.slack > 2 && lines.length > 1) {
    const padded = lines.map((u, k) => {
      if (k === lines.length - 1) return u;
      const h = cnHalves(u), want = Math.ceil(h / 16) * 16;
      return want > h ? [...u, { hold: true, d: want - h }] : u;
    });
    const h2 = cnHalves(padded.flat()), f2 = fit(h2);
    if (f2.slack <= 2) { units = padded.flat(); halves = h2; f = f2; how = 'lines held to 8 matras'; }
  }
  const perLine = lines.map(u => cnHalves(u) / 2);
  if (f.slack > 2) return { ok: false, beats: halves / 2, need: d0, perLine };
  if (f.slack) units = [...units, { hold: true, d: f.slack }];
  return { ok: true, units, how, slack: f.slack / 2, beats: halves / 2, perLine };
}

const CN_UNPLACED = {}; // raga -> [{ where, text, why }]

// ---------------------------------------------------------------- the class notes
// Each raga: what the notes say about it, his aalap steps, paltas, bandish taans, and what this
// app composed in the same method. `method` explains how his notes build the raga.
const CLASS_NOTES = {};

CLASS_NOTES['Yaman'] = {
  path: 'p-yaman', file: 'Raaga Yaman - Characteristics, and two pages of Yaman taans',
  facts: 'Kalyan thaat. Tivra Ma, every other note shuddha. Aaroh N̤ R G M D N Ṡ, avaroh Ṡ N D P M G R S. Vadi Ga, samvadi Ni. Phrases it never uses: S R G and M P D N.',
  chalan: { his: 'S, (N’)D’ N’ R G(nyasa), R S, G m D N(nyasa), S” N D N D P(nyasa), m (G)R G(nyasa), G m P->(mG)R(nyasa), G R S',
    notes: "S - _ (N.)D. N. R G - - - R S - _ G M D N - - - S' N D N D P - - - M (G)R G - - - G M P ~~R - - - G R S - - -" },
  pakads: [
    ['S, N’ D’ N’ R G R S', "S - N. D. N. R G R S - - -"],
    ['G m P->(mG)R, S', "G M P - ~~R - S - - -"],
    ['m D N D P', 'M D N D P - - -'],
    ['m D N R” D S”', "M D N R' D S' - - -"],
    ['S” N D N D P', "S' N D N D P - - -"],
    ['m D N R” N', "M D N R' N - - -"],
    ['P R (mG)', 'P ~~R (M)G - - -'],
    ['m G R N’ D’ S', 'M G R N. D. S - - -'],
  ],
  avoid: ['S R G (it starts from N̤ instead: N̤ R G)', 'M P D N (going up it skips Pa: M D N)'],
  aalap: [
    'S….', 'S…N’ …. D’….N’.....', 'D’N’…..N’……S', 'D’....D’......N’.....N’.....', 'D’.....N’......D’......S…',
    'S…..D’.....N’.....R….S…', 'D’.....N’.....N’.....D’....R…..N’…..', 'N’.....N’.....R…..S…..', 'N’.....R….G…..',
    'G…..G……R……G…..', 'G…..G…..R…..G…..R', 'R…..G……R…..S…..', 'N…..R……G….m…..R….G….', 'G…..R…..G…..m…..P……',
    'P….P…..R…..G…..', 'R…..m…….R…..G….', 'G…G….m…..P…R….S', 'N’.....R…..G……m….P', 'P…..P…..G…..m…..P',
    'P…..R…..G….m….D…..P', 'N’RGm…D….D…..N…P….', 'DN…..P….RG……', 'R…G….R…m…G', 'Gm….D….D…N….P',
    'P……G…m….DN….DN….', 'DN….DN…..m…DN…', 'mD……mD….NR”....D……S”.......', 'S”.....NDNR”.....S”',
    'DN…..N….D….NR”.....ND….S”...N', 'mD…..N…..R”.....R”....N….', 'D….N…..N…..G”...R”...S”....', 'S”....S”.....NDN….',
    'DN…..S”.....N…..', 'S”DN…..DN….D……P', 'S”....NDN….P', 'R”...N…DNS”....NDN….P', 'S”....DN….P….R….P….',
    'S”...N…DP….G….mD….P….', 'NDS”.....NDP….R…..GmD……P', 'S”...N….DP….RG……', 'mDNS”.......NDP..mR…G',
    'S”....S”NDPm…..R…G', 'GR…G..N…..DP……R…G', 'S”NDPm…..NDPmG….R…..G', 'mDNS”....NDP….R….G….',
    'G…..G….R..N’D’N’R…..', 'R…m….G…R…N’D’N’..G…R', 'G….R…N’D’m’D’N’...G..R', 'R…P…..R….G…..R…..',
    'R…..G….R…..N’...D’....N’....R….S',
  ],
  // his badhat, in the stretches it moves through
  aalapGroups: [
    { from: 1, to: 8, name: 'Sa, and down into the mandra', why: "His first eight steps never go above Re. Step 1 is Sa alone; 2 to 5 go down and stay there (S N̤ Ḍ N̤, Ḍ N̤ N̤ S), turning Ḍ and N̤ over until they are as sure as Sa. Step 7 stops on N̤, the note that wants Sa most, and step 8 answers it, N̤ N̤ R S: the first small tension and release." },
    { from: 9, to: 12, name: 'Re and Ga open: Ga as the first nyas', why: "Ga, the vadi, is reached from below (N̤ R G) and then held and re-struck, G G R G, until it is a place to rest. Step 12, R G R S, brings it back home." },
    { from: 13, to: 20, name: 'Tivra Ma and Pa', why: "Tivra Ma comes in only as a step to Pa (G R G M P), never as a resting note. Pa is approached, left and approached again, and 15 and 16 jump from Pa straight to Re (P R G): the pakad's shape, opened up slowly." },
    { from: 21, to: 26, name: 'Dha and Ni: the upper tetrachord', why: "From 21 the voice climbs N̤ R G M D, holding Dha, then Ni, and each step falls back to Pa or Ga. Every step goes a little further before it is allowed to come down." },
    { from: 27, to: 33, name: 'Taar Sa and above', why: "27 is the arrival: M D, M D, N Ṙ, D, then Ṡ held long. 28 to 33 circle the taar Sa (Ṡ N D N Ṙ Ṡ) and reach Ġ in 31, the highest note of the badhat." },
    { from: 34, to: 45, name: 'The long descents, through Pa to Ga', why: "Now each step starts high and comes down by a longer road: Ṡ D N, D N, D, P; then on to Ga. 38 to 45 each end on Ga, so the vadi closes every phrase on the way down." },
    { from: 46, to: 50, name: 'Back to the mandra and home', why: "The last five steps return to the mandra turns of the opening (N̤ Ḍ N̤ R), now joined to Ga and Re, and 50 is the whole raga in one breath, R G R N̤ Ḍ N̤ R S." },
  ],
  exercises: [
    ['1) N R G m D N S”- / S” N D P m G R S', 'thah'],
    ['2) NN RR GG mm DD NN S”-S”- / S”S” NN DD PP mm GG RR SS', 'doubled'],
    ['3) NNN RRR GGG mmm DDD NNN S”S”S” / S”S”S” NNN DDD PPP mmm GGG RRR SSS', 'tripled'],
    ['4) NNNN RRRR GGGG mmmm DDDD NNNN S”S”S”S” / S”S”S”S” NNNN DDDD PPPP mmmm GGGG RRRR SSSS', 'four of each'],
  ],
  // 5 to 25: each note starts a run that grows by one note at a time
  merukhand: [
    { n: 5, rows: 'N NR NRG NRGm NRGmP NRGmD NRGmDN NRGmDNS”' },
    { n: 6, rows: 'R RG RGm RGmP RGmD RGmDN RGmDNS” RGmDNR”G”' },
    { n: 7, rows: 'G Gm GmP GmD GmDN GmDNS” GmDNR”' },
    { n: 8, rows: 'm mP mD mDN mDNS” mDNR” mDNR”G”' },
    { n: 9, rows: 'D DN DNS” DNR” DNR”G”' },
    { n: 10, rows: 'N NS” NR” NR”G”' },
    { n: 11, rows: 'G” G”R” G”R”S” G”R”S”N G”R”S”ND G”R”S”NDP G”R”S”NDPm G”R”S”NDPmG' },
    { n: 12, rows: 'R” R”S” R”S”N R”S”ND R”S”NDP R”S”NDPm R”S”NDPmG R”S”NDPmGR R”S”NDPmGRS' },
    { n: 13, rows: 'S” S”N S”ND S”NDP S”NDPm S”NDPmG S”NDPmGR S”NDPmGRS' },
    { n: 14, rows: 'N ND NDP NDPm NDPmG NDPmGR NDPmGRS NDPmGRSN’' },
    { n: 15, rows: 'D DP DPm DPmG DPmGR DPmGRS DPmGRSN’ DPmGRSN’D’' },
    { n: 16, rows: 'P PmG PmGR PmGRS PmGRSN’ PmGRSN’D’' },
    { n: 17, rows: 'm mG mGR mGRS mGRSN’ mGRSN’D’' },
    { n: 18, rows: 'G GR GRS GRSN’ GRSN’D’' },
    { n: 19, rows: 'R RS RSN’ RSN’D’' },
    { n: 20, rows: 'S SN’ SN’D’ SN’D’P’' },
    { n: 21, rows: 'N’ N’D’ N’D’P’' },
    { n: 22, rows: 'D’ D’P’' },
    { n: 23, rows: 'P’ P’D’' },
    { n: 24, rows: 'D’ D’N’ D’N’S' },
    { n: 25, rows: 'N’ N’S' },
  ],
  // his Jhaptaal page: chandrama lalaaT par. One cell a matra, X to 10.
  jhaptaal: {
    mukhda: { words: 'chandrama', cells: ['N’', 'R', 'G', 'm'] },
    antaraMukhda: { words: 'trishoola', cells: ['_', '_', '_', '_'] },
    asthaayi: [
      ['N’ R G m P R G R N’ S'],
      ['G R G m G R S N’ S N’S'],
      ['· · · · N’ N’ G RG G RS'],
      ['· · · · R G R S N’ S'],
      ['· · · · N’R G GR G GR S'],
      ['· · · · N’R S N’R GR S N’R', 'Gm GR S N’R Gm Pm GR S N’R S'],
      ['· · · · SN’ SN’ GR S N’ S'],
      ['· · · · G R N’ S GR N’S'],
      ['· · · · N’ RS N’ GR S N’S'],
      ['· · · · N’ R G m GR GR'],
      ['· · · · PmRG RGRG GRGm RGRG SN’GR RGRG'],
      ['· · · · mGRS N’S PmGR SN’S NDPm mGRS'],
      ['· · · · N’GR RmG GPm mDP S”S”NN DDP'],
      ['· · · · N’R Gm RG mN’R GR N’S'],
      ['· · · · GRN’S N’RGm GRN’R PmGR GmDP mGRG'],
    ],
    antara: [
      ['· · · · S”N DP ND Pm mD NS”'],
      ['· · · · ND S”N G”R” S”N DP R”S”'],
      ['· · · · NS” DNS” mDnS” R”G”R”S” DNS” NS”NS”'],
      ['· · · · Pm DP ND Pm RGR GmP', 'P PmGR mPGm RN’S R”NS” G”R”S”N DPND S” S”NDP mDNS”'],
      ['· · · · DP mG S”N R”G” NR” DS”', 'NDNR” G”-G”R” G”-G”R” G”G”R”S” S”NDN R”-R”S” R”-R”S R”R”S”N mDND S”NR”S”',
        'S”NDP NDPm DPmG PmGR N’RGm RGmD GmDN mDNS” DNG”R” S”NDP', 'ND PmG m S”N DPm P mDN R”G” R”S”N S”'],
      ['· · · · NS”S”N R”G” G”R” G”G”R” R”D NS”', 'DPmP GmDP NDmD mDNS” G”G”R”S NDmD S” S”NDP mPRG DNDP',
        'GGRS RSN’D’ SN’RS GGRS PPmG DNDP S”NR”S” G”G”R”S NR”G”m” m”G”R”S”',
        'G”R”S”N DNR”S” R”S”ND S”NDP G”R”S”N S” GRSN’ S G”R”S”N S”',
        'NDNR” G”-G”R” S”NDS” N-ND NDmN S”-S”N S”NDS”S”S” S”ND”S”S” S”NDS”S”S”'],
    ],
    fix: { 'mDnS”': 'mDNS”' },
    unclear: [
      'Antara taan 3, matra 7: "mDnS”" has a komal n, which Yaman doesn’t use. Played as written; probably N.',
      'Antara taan 5, matra 7 of its second line: "R”-R”S" ends on madhya Sa, a jump of more than an octave. Played as written; probably S”.',
      'Antara taan 6: "G”G”R”S" (twice) ends on madhya Sa. Played as written; probably S”.',
      'Antara taan 6, last line: "S”ND”S”S”" has a taar Dha where the cells around it have "S”NDS”S”S”". Played as written; probably D.',
      'The antara’s mukhda (tri sho oo la) has no notes on the page, so those four matras are left for you to sing the words.',
    ],
  },
  // two more pages of Yaman taans: eight matras each, no taal or placement given
  eights: {
    lead: [['mOhe gagari na bharan', 'gagari na bharan'], ['baar baar', 'baar baar samjhaaoon na']],
    taans: [
      [0, 'D’ N’ R G, P m G R'], [0, 'N’ D’ S N’, R S [GRS]'], [0, 'N’ R G R, N’ G R G'], [0, 'D’ N’ D’ S, P m [GRS]'],
      [0, 'S D’ N’ R, G m P R'], [0, 'N’ R G, R G m, [GRGR]'], [0, '[D’N’S], [D’N’S], [GRS], [GRS]'], [0, 'm G m P, m G R G'],
      [0, 'P m D [Pm], G R P [mG]'], [0, 'G R N’ D’, S N’ R S'], [1, 'P m G m, D P m P'], [1, 'N’ R G m, G m D N'],
      [1, 'm G P m, D P N D'], [1, 'S” N D P, m D N S”'], [1, '[GGGG], [mmmm], [DDDD], [NNNN]'],
    ],
  },
};

CLASS_NOTES['Bhinna Shadja'] = {
  path: 'p-bhinna', file: 'Raaga Bhinna Shadja - Performance Format, and the Kaushidhwani pages',
  facts: 'Also called Kaushidhwani. Five notes, all shuddha: S G M D N, no Re and no Pa. Tanpura on Ma (or Dha). Aaroh S G M D N Ṡ, avaroh Ṡ N D M G S.',
  aalap: [
    'S-N’D’N’-D’, M’D’D’, D’N’N’, D’N’-D’ S', 'SGMD-GM, GMG-N’S, D’N’-D’S-N’, N’SG-N’-S', 'D’N’SGM-, M-MDG-M, GMD-M-, G-MG-S,',
    'N’SGMD-M, G-MD-DG-M, G-MD-MD-GGM', 'GMD-N-D-M, MD-MN-ND-D-M', 'MDNDN-D-M-G, SGMD-, D-DN-M-D-', 'SGMD-DN-N-D, SGMDN-DN-',
    'SGMD N-----S”-----', 'S”--- NS”-DN-MD---NS”, SGMDN--DN-DS”-----', 'DN-DS”-N, DN-S”G”-S”----', 'DNS”G”M”--- M”---- G”M”---G”-----',
    'M”G”D”-M”-G”--', 'M”--G”M” DN---D--- M”---G”----', 'M”---G”M”G”----S”G”S”----', 'S”---M”M” G”G” S”, NS”N DND S”---',
    'DS”NS” G”G”S”N DNDM---', 'M”-- S”G”M”--- G”S”--ND--M---', 'M”G”S”NDM---- [M”M”M” G”G”G” S”S”S” NNN DDD MMM]',
    'M”--G”S”---NDND-- MG', 'S”-ND N-DM D-MG MG-S',
  ],
  aalapGroups: [
    { from: 1, to: 4, name: 'Sa, the mandra, and Ga and Ma around Sa', why: "Step 1 never leaves Sa and the mandra (S N̤ Ḍ N̤ Ḍ, M̤ Ḍ Ḍ). Ga and Ma come in step 2, each time folded back to Sa (G M G N̤ S): the raga's lower half is settled before it climbs." },
    { from: 5, to: 8, name: 'Dha and Ni, up to taar Sa', why: "5 to 7 work Dha and Ni and keep returning to Ma (G M D N D M), so Ma becomes the centre. Step 8 is the first climax: S G M D, then Ni held five notes and Ṡ held five notes." },
    { from: 9, to: 14, name: 'The taar saptak', why: "From taar Sa the steps go up to Ġ and Ṁ and hold them (11: D N Ṡ Ġ Ṁ, held), circling Ṁ Ġ Ṡ the way the madhya steps circled M G S: the same shapes an octave up." },
    { from: 15, to: 20, name: 'Coming down', why: "Now the steps fall. 18 drops down the scale in threes (Ṁ Ṁ Ṁ, Ġ Ġ Ġ, Ṡ Ṡ Ṡ, N N N...) and 20 is the descent in falling three-note cells, Ṡ N D, N D M, D M G, M G S: the second line of the palta, sung slowly as an aalap." },
  ],
  // the performance format: aalap steps 16 to 28, in three parts; the middle one is Anish's
  format: [
    { part: 'Part 1', steps: [
      [16, 'S- - -N’S - - N’D’N’- - - , D’... D’M’D’- - , N’ …. N’D’N’---D’... S(D’S)---'],
      [17, 'D’D’N’---(DD’N’)---- SN’D’SG—-- , SN’... N’N’D’N’--D’... D’N’SG~~S..'],
      [18, 'S—N’SG—-- , D’N’---D’N’SG~~~SM~~G— , D’N’~~D’, D’N’SG~~S'],
      [19, 'S—- SM~~G— G–M—, M~~G–GM–G.. , SN’D’N’SGM~~, D~~M'],
      [20, 'M- - - GMD - —..,D~~~M , D~~GMD~~M, (GMGMG), (SGSGN’), (D’S’N’D’)'] ] },
    { part: 'Your part', mine: true, steps: [
      [21, 'D’N’SGM~~G, SGMD~~M, GMD~~(D~M)'],
      [22, 'M–GGSN’ SGMD~~ DDN~~D, DDN~~~D, (D~M D~D~M) (M~G M~M~G)'],
      [23, 'D’N’SGMD~~ DDN~~N… , DDN~~DN~~N , DN~~D.. (NN→S”)'] ] },
    { part: 'Part 3', steps: [
      [24, '(DNS”G”M”~G”S)”-- N-DN–, (ND~ND M~) , MM– DD– NN– S”... (NG”S”ND)..'],
      [25, '(NNDD.. NNDD~M), (MMD~~) , (NND) , (DDM), (MMG), (GGS), N’S–N’'],
      [26, '(D’N’SGMDNS”) (ND~~ND~M) , (MMD~~D~M) , (GGM~~M~G), G– M, N’GS~~N’D’'],
      [27, '(D’N’SG MG~~SN’) , (D’N’S~N’D) , (D’N’S GS) , (GS GS~N’), (SN’, SN’D’)'],
      [28, '(D’N’SGSN’D’) , (D’D’N’~~D’) (N’~D’~S~~)'] ] },
  ],
  palta: 'S SG SGM, G GM GMD, M MD MDN, D DN DNS” / S” S”N S”ND, N ND NDM, D DM DMG, M MG MGS',
  bandish: [
    { id: 'ayo', name: 'Ayo ree basant', taal: 'Teentaal', bpm: 140, taalNote: 'The notes say Addha Teentaal at 140; the app’s Teentaal theka stands in for it.',
      sections: [
        { id: 'ast', name: 'asthaayi', from: 5, next: 12, M: 16,
          mukhda: { at: 12, his: 'GM [DN]S” DN-D', notes: "G m DN S' - D N - D", words: 'aayo ree basant',
            note: 'Your notation puts sam on "basant"; I held taar Sa through matra 16 so "ba" falls on sam.' },
          taans: [
            ['p1-1', 'Part 1, taan 1', ['[D’N’SGM] [GMDN S”NDM]']],
            ['p1-2', 'Part 1, taan 2', ['[N’S GS N’S N’D’] [SGM DM]']],
            ['p1-3', 'Part 1, taan 3', ['[MGMG] [SN’SN’] [D’N’SGS]']],
            ['a-1', 'Your taan 1', ['[GM DM GS N’S] [GMD ND]']],
            ['a-1b', 'Your taan 1, second half', ['[SN’ D’N’S-] [GS GS] [MG MG]']],
            ['a-2', 'Your taan 2', ['[D’N’SG MDNS” NDMGM]']],
            ['p3-1', 'Part 3, taan 1', ['[GM DN DM] [SM GM] [DM DM]']],
            ['p3-2', 'Part 3, taan 2', ['[SN’ D’N’] [SG SG] [MG MG S]']],
            ['p3-3', 'Part 3, taan 3', ['[S”ND NDM DM] [GMD NS”]']],
            ['k-1', 'Kaushidhwani page, taan 1', ['SG [MDNS”] N-[DMGS]']],
            ['k-2', 'Kaushidhwani page, taan 2', ['[MG][SN’] [D’N’][SG] [MD][MG] S']],
            ['k-3', 'Kaushidhwani page, taan 3', ['GS- MG- DM- ND- [MG]']],
            ['k-4', 'Kaushidhwani page, taan 4', ['[SMGS] [N’D’N’] [SGMD] [NDN]']],
            ['k-5', 'Kaushidhwani page, taan 5', ['SM- GD- MN- D- [MG]']],
            ['k-6', 'Kaushidhwani page, taan 6', ['[SS][N’S] [D’D’][N’N’] [SS][GG] M']],
            ['k-7', 'Kaushidhwani page, taan 7', ['{MGS} {DMG} {NDM} {S”ND} {MD}']],
            ['k-8', 'Kaushidhwani page, taan 8', ['[SSS] S”-S”-S”- [G”G”S”NS”]']],
            ['k-9', 'Kaushidhwani page, taan 9', ['[DS”] [MN] [GD] [SM] [GS] [N’S]']],
            ['k-10', 'Kaushidhwani page, taan 10', ['[DDNN] [DDMM] [GGMM] G']],
          ] },
        { id: 'bridge', name: 'bridge to the antara', from: 5, next: 12, M: 16, bridge: true,
          mukhda: { at: 12, his: 'GM [DN]S” DN-D', notes: "G m DN S' - D N - D", words: 'aayo ree basant' },
          land: { at: 12, notes: "D G m D N S' - S' -", words: 'pavan madhu mand' },
          taans: [
            ['bridge', 'Bridge taan (performance format)', ['[M- M- MM] [ MM- M- MM] [DM DM GS GS] [D’N’ SGM-MM]', '[D-D- DD] [DD- D- DD] [ND ND MG MG] [N’S GM D-DD]',
              '[N-N- NN] [NN- N- NN] [S”N S”N DM DM] [SG MD N-NN]', '[DN S”N DN S”N] [MD ND MD ND] [GM DN S”- S”S”]', '[G- M- DNS”] [M- D- NS”] [DNS”- NS”]']],
            ['k-bridge', 'Bridge taan (Kaushidhwani page)', ['[SMGM] [GDMD] [MNDN] [DS”NS”]', '[S”NDN] [NDMD] [DMGM] [MGSG]', '[SGMD] [NS”ND] [GMDN] S”']],
          ] },
        { id: 'ant', name: 'antara', from: 5, next: 12, M: 16,
          mukhda: { at: 12, his: 'DGM DN S”-S”-', notes: "D G m D N S' - S' -", words: 'pavan madhu mand' },
          taans: [
            ['p1-1', 'Part 1, taan 1', ['[DN S”G” S”N S”-] [GM DN S”]']],
            ['p1-2', 'Part 1, taan 2', ['[S”G” M”G” S”N] [GM DN DMD]']],
            ['p1-3', 'Part 1, taan 3', ['[S”G”] [M”G”] [S”N] [DN] [S”N DNS”]']],
            ['a-1', 'Your taan 1', ['[S”DN] [MDG] [GD] [MN] [DNS”]']],
            ['a-2', 'Your taan 2', ['[DD] [NN] [S”G”S”] [DNS”G”S”]']],
            ['a-3', 'Your taan 3', ['[SM GS- N’D’N’] [DN’ SGS-]', '[GD MG- SN’S] [N’S GMG-]', '[MN DN - N-N] [NND NND ND]', '[GD MD – D-D] [DDM DDM DM]', '[NND - DDM] [NND DDM]'],
              { marks: [8, 8, 8, 8, 7] }],
            ['p3-1', 'Part 3, taan 1', ['[S”G”- G”- G”] [N- S”- S”] [DN ]']],
            ['p3-2', 'Part 3, taan 2', ['[S”- NS” ND] [GM DN S”-]', '[N- DN DM] [SG MD N-]', '[D-DD] [N-NN] [DNS” NS”]'], { marks: [8, 8, 7] }],
            ['p3-3', 'Part 3, taan 3', ['[GGG G”-G”-G”] [ G”M”G”S”N-]', '[SSS S”-S”-S”] [S”G”S”ND-]', '[N’N’N’ N-N-N] [NS”NDM-]', '[SMG- GDM- MND- DNS”] [DNS” NS”, DNS”N DNS”]']],
            ['k-1', 'Kaushidhwani page, taan 1', ['S”D NM DGM']],
            ['k-2', 'Kaushidhwani page, taan 2', ['S”-S”-S”-S” [NS”DNS”]']],
            ['k-3', 'Kaushidhwani page, taan 3', ['[N’SGM] [SGMD] [GMDNS”]']],
            ['k-4', 'Kaushidhwani page, taan 4', ['[DN] S”- [G”S”] [DNS”G”S”]']],
            ['k-5', 'Kaushidhwani page, taan 5', ['[S”N] [ND] [DS”] [G”S”] [NNS”]']],
            ['k-6', 'Kaushidhwani page, taan 6', ['[SG] [GM] [MD] [DN] [NS”] [G”S”] [NS”]']],
            ['k-7', 'Kaushidhwani page, taan 7', ['[S”N] [ND] [DM] [MG] [GS] [SN’] [N’S]']],
            ['k-8', 'Kaushidhwani page, taan 8', ['[SSSS] [GGGG] [MM] [DD] N']],
            ['k-9', 'Kaushidhwani page, taan 9', ['[S”S”S”S] [NNNN] [DD] [MM] N']],
            ['k-10', 'Kaushidhwani page, taan 10', ['[SSS] S”S”S”, [N’N’N’] NNN, [D’D’D’] DDD', '[MDNS”] - [GMDNS”] - [SGMDNS”]']],
          ] },
      ] },
    { id: 'ajahu', name: 'Ajahu na aaye', taal: 'Teentaal', bpm: 160,
      sections: [
        { id: 'ast', name: 'asthaayi', from: 5, next: 12, M: 16,
          mukhda: { at: 12, his: 'S”ND M GS', notes: "S' N D m G S - - -", words: 'ajahu na aaye',
            note: 'Your notation gives "ajahu na aaye" six notes from matra 12; I held the last Sa to matra 4, where the taans start.' },
          taans: [
            ['p1-1', 'Part 1, taan 1', ['[N’SG-][SGM-][GMDNS”]']],
            ['p1-2', 'Part 1, taan 2', ['[SGM-][GMD-][MDN-]S”']],
            ['p1-3', 'Part 1, taan 3', ['SGM-, MMM-', 'GMD- DDD-', 'MDN-, NNN-', 'DNS”-, S”S”S”-', '[DNS”G”S”NDM][GMDNS’]']],
            ['a-1', 'Your taan 1', ['[SMGSN’] - [GDMGS]']],
            ['a-2', 'Your taan 2', ['[D’N’S N’S-] [D’N’SN’] [D’M’D’N’S]', '[D’N’S GS-] [D’N’SG] [SN’D’N’S]', '[D’N’S GM-] [D’N’SG] [MDMGM]', '[DNS” DN-] [DNS”N] [DNS”G”S”]', '[S”-ND] [N-DM] [D-MG] [MG]']],
            ['a-3', 'Your taan 3', ['[N’N’] [S- S- S-] [GG SN’S-]', '[SN’D’M’] [D’N’SG] [SN’D’N’S-]', '[GG] [M- M- M-] [DD MGM-]', '[MDND] [MDMG] [MGSGM-]', '[DD] [N- N- N-] [S”N DNS”]']],
            ['p3-1', 'Part 3, taan 1', ['[DM GM ND MD] [S”N S”N DN S”S”]', '[S”N S”G” ND NS”] [MD MN DG” S”S”]', '[S”N DN S”-] [DN S”-] [NS” S”-]']],
            ['p3-2', 'Part 3, taan 2', ['[GM GM GS N’S] [D’N’SG MG SS]', '[MD MD MG SG] [N’SGM DM GG]', '[SG] M [GM] D MDNS”N']],
            ['p3-3', 'Part 3, taan 3', ['[SGMG SN’D’N’] [GMDM GSN’S] [MDND MGSG] [GMDN S”- ]', '[S”NDN S”G”M”G”] [NDMD NS”G”S”] [DMGM DNS”N] [SGMD N-]', '[S”N D-] [ND M-] [DM GM D-]']],
          ] },
        { id: 'bridge', name: 'bridge to the antara', from: 5, next: 10, M: 16, bridge: true,
          mukhda: { at: 12, his: 'S”ND M GS', notes: "S' N D m G S - - -", words: 'ajahu na aaye' },
          land: { at: 10, notes: "G m D N S' S' S'", words: 'aavan ke gayo' },
          taans: [
            ['bridge', 'Bridge taan', ['[SG M- GMDM] [GM D- MDND] [MD N- DNS”N] [DN S”- NS”NS”]', '[S”N” D- ND M-] [DM G- MG S-] [S”ND NDM DMG MGS GS N’S]', '[D’N’SG MDNS”]']],
          ] },
        { id: 'ant', name: 'antara', from: 1, next: 10, M: 16,
          mukhda: { at: 10, his: 'GMDN S” S”S”', notes: "G m D N S' S' S'", words: 'aavan ke gayo' },
          taans: [
            ['p1-1', 'Part 1, taan 1', ['[S”NDN][S”-S”S”][GMDNS”-S”S”]']],
            ['p1-2', 'Part 1, taan 2', ['[S”G”M”G”][S”NS”-][DNS”NS”--]']],
            ['p1-3', 'Part 1, taan 3', ['S”DN-, NMD-, DGM- MSG-', '[GMDNS”][GMDNS”][GMDNS”]']],
            ['a-1', 'Your taan 1', ['[S”G”S”NS”] - [S”NDMGMDNS”]']],
            ['a-2', 'Your taan 2', ['[S”- NDN] [N- DMD] [MGM]', '[D- MGM] [M- GSG] [SN’S]', '[SMGS-N’S-] [GDMG-SG-]', '[MNDM-GM-] [DS”ND-MD-]', '[NG”S”N-DN-] [S”M”G”S”-NS”-] -']],
            ['a-3', 'Your taan 3', ['[S”ND] N [N-N] [DDNN] [S”-S”S”]', '[NDM] D [D-D] [MMDD] [N-NN]', '[S”NS”G”] [S”NS”G”] [M”-G”S”] [S”NS”G”]', '[NDNS”] [NDNS”] [G”-SN] [NDNS”]', '[S”-S” N-N D-D M-M GMGS-] -']],
            ['a-4', 'Your bonus taan (from the first draft)', ['[D-D] [N-N-NN] [DNN DNN DM]', '[MDD MDD MG] [GMM GMM GS]', '[SN’SG M-MM] [G-GG] [SN’S-]', '[SN’SG D-DD] [M-MM] [D’N’S-]', '[SN’D’- N’D’M’-] [G’M’D’N’] [S-S-S]']],
            ['p3-1', 'Part 3, taan 1', ['[S”NS”S” NDNN] [DMDD MGMM]', '[NDNN DMDD] [MGMM GSGG]', '[GMD GMDN] [MDN MDNS”]']],
            ['p3-2', 'Part 3, taan 2', ['[G”S”NS” G”M”G”G”] [S”NDN DNS”S”]', '[DNS” DNS”S”] [MDN MDNN]', '[GMGS MDMG] [DNDM NG”S”S”]']],
            ['p3-3', 'Part 3, taan 3', ['[SS GG M SGM] [GG MM D GMD] [MM DD N MDN] [DD NN S” -]', '[S”S” NN D S”ND] [NN DD M NDM] [DD MM G DMG] [MM GG S -]', '[SG GM MD DN] [GM MD DN NS”]']],
          ] },
      ] },
  ],
  unclear: [
    'Aalap step 12: "M”G”D”" climbs to taar Dha, above everything else on the page. Played as written.',
    'Format step 20: "(D’S’N’D’)" has a mandra Sa between mandra Dha and Ni. Played as written; perhaps madhya S.',
    'Ajahu na aaye, part 1 taan 3: it ends "[GMDNS’]" with a mandra Sa after a climb to Ni. Played as written; probably S”.',
    'Ajahu na aaye bridge: "[S”N” D- ...]" has a taar Ni right after taar Sa. Played as written; probably N.',
    'Bold italics (sing softly) don’t survive the PDF text, so loudness isn’t marked in the app.',
  ],
};

CLASS_NOTES['Patdeep'] = {
  path: 'p-patdeep', file: 'Raaga Patdeep - Characteristics',
  facts: 'Kafi thaat. Komal Ga, shuddha Ni. Tanpura on Pa. Aaroh N̤ S g M P N Ṡ, avaroh Ṡ N D P M g R S. Rests on Pa; in Ṡ N D P the Dha is sustained, and from Ni the voice glides down to it.',
  chalan: { his: 'N\' S g M P (M) g, M g R S, g M P N S" D P, M P g, M g R S',
    notes: "N. S g m P - (m)g - m g R S - _ g m P N S' - D P - _ m P g - m g R S - -" },
  nuances: [
    ['P N R” N D M P', "P N R' N D - m P - - -"],
    ['S” N D P (Dha sustained)', "S' N ~D - - P - - -"],
  ],
  aalap: [
    'N’Sg-R-S [N’RS] N’-, N’SgRN’S', 'P’N’P’SN’, P’N’gRN’P’S', 'N’Sg-M, M--g--R--N’, N’--P’--S---', 'S--, N’--- P’S----N’S--g---g----M---',
    'M--- M----g---g---R----R---N’----S--', 'N’S--g--g--M---M----P----', 'P----M-P---g--M----S-g-M---SM----', 'S-gM---Pg--MgR----SRN’--S',
    'N’S----R---S---g-R--S----M--gR--S---', 'S---g----M----P----gMP---', 'S---P--M--M--M--MPg--M', 'SgP--M--MPg--g-M--g--R---S',
    'g--RN’S---P’N’SgR--N’S--', 'M’P’N’SgM--g--RN’-S', 'S--g-M-P---P--DM--P', 'P---MP--gMD---D-P--', 'gMPD---D--MP--SgMP--g-M-P',
    'P--gMP--gM-PN--ND--D--P', 'P---PN--D---D-MP--', 'P--gMP--SgMP--N’SgMP--P’N’SgMP--', 'SgMPN---N--DMPN---',
    'gMPN----N---DMP-[S”]N[S”NS”N]------', 'PgMPN--------P--S”------------N----S”----', 'PN----PS”----------S”R”N---PS”----',
    'PNS”g”---R”---------N-----Pg”------R”----', 'g”----R”N-----PNS”-g”R”S”-----', 'PNS”g”M”----M”---g”---g”--R”N---S”---',
    'Pg”---R”S”N----PR”---NS”', 'P----PS”---NDM---MN--DPg', 'S”N-D--MPN--D---S-gMP',
    'S”---[S”S”ND]---[NNDP]---[DDPM]---[SgM] [gMP] [MPN] [PNS”-] [NDP]', 'S”--ND--MP---NDM–', 'gM---DPM--SgMP--NS”ND-P',
    'D--D-MP---N-DP--gM--SgPM--g', 'g--M-P-M--g--RN’--S--P’N’SgMPMg--RN’S',
  ],
  aalapGroups: [
    { from: 1, to: 5, name: 'Around Sa: N̤ S g and the mandra Pa', why: "The first five steps live between mandra Pa and komal Ga. Step 1 is N̤ S g R S, the raga's opening turn; 2 adds mandra Pa (P̤ N̤ S); 3 to 5 stretch the notes out, g held, then M touched, and every step comes home to Sa." },
    { from: 6, to: 12, name: 'Ma, then Pa as the goal', why: "6 climbs N̤ S g M and lands on Pa, held: Pa is announced as the raga's resting note. 7 to 12 keep returning to Pa and Ma from Sa (S g M P), and step 11's repeated M M M before M P g pulls toward Pa without resting on Ma (resting on Ma would make it Bhimpalasi)." },
    { from: 13, to: 14, name: 'Back to the mandra before going up', why: "Before opening Dha the voice goes down again (g R N̤ S, P̤ N̤ S g R N̤ S): a release that resets the range before the next climb." },
    { from: 15, to: 20, name: 'Dha: sustained, always back to Pa', why: "Dha comes in as a held note between Pa and Ma (P D M P; D held, then P), exactly the nuance your notes give for Patdeep. 20 is a pattern: g M P, S g M P, N̤ S g M P, P̤ N̤ S g M P, each run starting lower and all ending on Pa." },
    { from: 21, to: 24, name: 'Ni and taar Sa', why: "21 and 22 climb S g M P N and hold Ni; 22 asks for an ee-kaar on the taar turn Ṡ N Ṡ N. 23 and 24 hold Ṡ long, approached from P N: Patdeep's ascent is P N Ṡ, not D N Ṡ." },
    { from: 25, to: 28, name: 'The taar saptak', why: "Ġ and Ṙ are held and turned (Ġ Ṙ N, P N Ṡ Ġ Ṙ Ṡ). 27 reaches taar Ma, the top of the badhat." },
    { from: 29, to: 35, name: 'Descents, and cells that lead to taans', why: "29 to 35 come down through Ṡ N D P M and Ma P g, each time back to Pa or g. 31 turns the descent into rhythm: Ṡ Ṡ N D, N N D P, D D P M, then the climbing cells S g M, g M P, M P N, P N Ṡ, ending N D P. That is a taan pattern sung slowly, the bridge from aalap to taan." },
  ],
  palta: [
    ['SgRS', 'N’RSN’', 'P’N’S'], ['gPMg', 'SgRS', 'N’SR'], ['MNDP', 'gPMg', 'SgM'], ['PS”ND', 'MNDP', 'gMP'],
    ['NR”S”N', 'PS”ND', 'MPN'], ['S”G”R”S”', 'NR”S”N', 'PNS”'], ['S”NS”G”', 'M”g”R”S”', 'R”S”N'],
  ],
  paltaEnd: ['NSgMPNS”', 'S”NDPMgRS'],
  unclear: [
    'Palta row 6 and the line under it write "G”" (shuddha taar Ga), which Patdeep doesn’t use. Played as komal g’.',
    'Aalap step 22: the taar turn "S”NS”N" is marked "in ee kaar" (sing it on ee).',
    'Your notes point to a film song and to Rajan Parrikar’s article on Bhimpalasi for the Patdeep, Bhimpalasi and Madhuvanti differences; the Madhuvanti line is still empty.',
  ],
};

CLASS_NOTES['Bageshree'] = {
  path: 'p-bageshree', file: 'Raaga Bageshri - Characteristics',
  facts: 'Kafi thaat. Komal Ga and Ni. Tanpura on Ma (or Dha). Aaroh n̤ S g M D n Ṡ, avaroh Ṡ n D M P D g M g R S. Vadi Ma, samvadi Sa.',
  aalap: [
    'S D’ n’ S,', 'S D’ n’ S R n’ D’', 'D’ n’ S R n’ D’ n’ S', 'D’ n’ S g M', 'M M gM SgM', 'M-g- MgR- n’-D’-S', 'D’- n’- Sg-M D-gM',
    'SgMD- MPD- gM-', 'SgMD- PD n-D-M', 'n-n- D-M, Dg- MD-', 'MD-D- n-n- D-, S”', 'S”- nS”- Dn- MD-, MDn-D S”', 'S”-n-, DnS”R”- n-D-S”',
    'S”-n-, g”-R”n-D M-D-S”', 'S” g”R”n D-M', 'MDS” g”R”nD R”nD MDg-M', 'M MPD gM gR', 'DD nD MPD MgR', 'Rn’ D’n’Sg M-R-n’',
    'D’n’D’ M’D’Rn’D’ n’-S',
  ],
  aalapGroups: [
    { from: 1, to: 3, name: 'Sa and the mandra', why: "S Ḍ n̤ S: the raga starts below Sa, in the mandra Dha and komal Ni, and Re is only touched (S R n̤ Ḍ)." },
    { from: 4, to: 7, name: 'Ga and Ma: Ma as the centre', why: "4 goes straight from Sa to Ma through komal Ga (Ḍ n̤ S g M), the jump Bageshri is known for. 5 repeats Ma (M M, g M, S g M) until it is the centre, and 6 and 7 come down from it and go back to it." },
    { from: 8, to: 11, name: 'Dha, a touch of Pa, and komal Ni', why: "Dha comes in above Ma (S g M D), Pa only as M P D or P D on the way down, never as a resting note, and Ni as n D M. 11 reaches up to taar Sa." },
    { from: 12, to: 16, name: 'Taar Sa and the turns above it', why: "Ṡ is approached from n and D (n Ṡ, D n, M D), and 13 to 16 go up to Ṙ and ġ before falling. 16 is a cascade, M D Ṡ ġ Ṙ n D, Ṙ n D, M D g M: each fall is shorter, and it lands on Ma, not Sa." },
    { from: 17, to: 20, name: 'Home through the mandra', why: "17 and 18 bring in the M P D and M g R turns, and 19 and 20 go down again to the mandra (Ḍ n̤ Ḍ, Ṃ Ḍ R n̤ Ḍ, n̤ S): the badhat ends where it began." },
  ],
  palta: ['DnS”R” nS”', 'MDnS” Dn', 'gMDn MD', 'SgMD gM'],
  unclear: [
    'Your notes link a video on practising long notes; it isn’t in the app.',
  ],
};

// ---------------------------------------------------------------- composed in the method of his notes
// These are not from his notes. Each one takes a pattern his notes use and applies it somewhere
// they don't; `why` says which pattern, with his example.
const CN_METHOD = {
  'Yaman': {
    method: [
      "Badhat: one new note at a time, and down before up. Step 1 is Sa alone, steps 2 to 8 go down into the mandra (Ḍ N̤) before anything goes above Re, and each new note (Ga at 9, tivra Ma at 13, Dha at 21, taar Sa at 27) is first a passing note, then a place to rest.",
      "Each step ends on a resting note, usually Ga, Pa, Ni or Sa. When a step stops somewhere unstable, the next step resolves it: step 7 ends on N̤ (D̤ N̤ N̤ Ḍ R N̤) and step 8 answers N̤ N̤ R S.",
      "Taans grow by density before range. On the Jhaptaal page, taans 1 and 2 are one note a matra, 3 to 10 bring in two-note matras a few at a time (N̤R, GR), 11 and 12 are four notes a matra (PMRG RGRG), and 13 and 14 are three (N̤GR RMG GPM): the layakari ladder inside the taan itself. The asthaayi taans stay between N̤ and Pa; the antara ones live from Pa to Ġ and last 2 to 5 cycles.",
      "Tension comes from climbing, from density and from repetition (the antara's last line: Ġ - Ġ Ṙ, Ṡ N D Ṡ Ṡ Ṡ). Release comes from the fall to a resting note and from the mukhda: 'chandrama' coming back on sam is the arrival every taan is aimed at.",
    ],
    aalap: { name: 'Steps that withhold Sa', why: "Your step 7 stops on N̤ and step 8 resolves it. These steps stretch that idea: each one circles Sa from both sides (N̤ R, Ḍ N̤, R G R) without landing, longer each time, and only the last lands on Sa.",
      steps: ["N. - R - N. - D. - - - N. - - -", "D. N. R G - - R N. - D. - - N. - - -", "N. R G M - G R - N. D. N. R - - - - G R N. - D. N. R - S - - -"] },
    taans: [
      { name: 'Jhaptaal: same launch, higher target', why: "Your Bhinna Shadja taans (the D̤ N̤ S line of 'ajahu na aaye') send the same opening cell to a higher note on each line. Here N̤ R G is the launch, aimed at Ga, then Pa, then Ni, then taar Sa, one cycle each, every one landing back on 'chandrama'.",
        taal: 'Jhaptaal', cells: [
          ['N.R', 'G-', 'N.R', 'GR', 'S-', 'N.R'],
          ['N.R', 'GM', 'P-', 'MG', 'RG', 'R-'],
          ['N.R', 'GM', 'DN', '-D', 'P-', 'MG'],
          ['N.R', 'GM', 'DN', "S'-", "ND", 'PM'],
        ] },
      { name: 'Jhaptaal: one note, then two, three and four a matra', why: "Your Jhaptaal page raises the density from taan to taan. This taan does it inside one line: thah for two matras, dugun for two, tigun, then chaugun, so the speed itself is the build and 'chandrama' is the release.",
        taal: 'Jhaptaal', cells: [['G', 'R', 'GM', 'DN', 'DPM', 'GRS']] },
      { name: 'Teentaal: runs that grow toward taar Sa', why: "Your exercises 5 to 25 grow a run from a fixed start (N, NR, NRG...). Your Bhinna Shadja antara taan 10 does the opposite, growing back from a fixed end (M D N Ṡ, G M D N Ṡ, S G M D N Ṡ). Here that is applied to Yaman, keeping its rule that Pa is passed over going up.",
        taal: 'Teentaal', lands: 'sam', notes: "DN S'- MD NS' -- GM DN S'- -- RG MD NS' -- N.R GM DN S'N DP MG RS" },
    ],
  },
  'Bhinna Shadja': {
    method: [
      "Badhat: Sa and the mandra first (steps 1 to 4 fold every phrase back to Sa), then Dha and Ni with Ma as the centre, the climax on taar Sa held long in step 8, the same shapes an octave higher in 9 to 14, and a descent in three-note cells in 15 to 20.",
      "The descent at step 20 (Ṡ N D, N D M, D M G, M G S) is the second line of the palta sung slowly. The palta is the raga's grammar in miniature, and the aalap uses it.",
      "Taans build tension by repetition and syncopation, then release it in a run. The bridge taan does it three times: M - M - M M, M M - M - M M, then a falling run to Sa; the same on Dha and on Ni; then everything converges on taar Sa.",
      "'Same launch, higher target': your 'ajahu na aaye' taan 2 starts every line with D̤ N̤ S and aims it higher each time (at N̤, at G, at M, at D N Ṡ, at Ġ), then releases in falling cells, Ṡ - N D, N - D M, D - M G, M G.",
      "Converging runs: the Kaushidhwani page's antara taan 10 sings M D N Ṡ, then G M D N Ṡ, then S G M D N Ṡ. Each run is longer and ends on the same note, so the arrival is expected and still lands.",
    ],
    aalap: { name: 'Meends between the five notes', why: "Your format steps join notes with ~ (M~~G, D~~M, N~~D). With no Re and no Pa every step is wide, so these steps practise each join on its own, slowly, landing on Ma as your steps do.",
      steps: ["S - ~~G - m - - - ~~G - - - S - - -", "G m D - ~~m - - - D N - ~~D - ~~m - -", "D N S' - - - ~~N - D - ~~m - G - ~~S -"] },
    taans: [
      { name: 'Ayo ree basant: same launch, higher target', why: "Your 'ajahu na aaye' taan 2 applied to the asthaayi of 'Ayo ree basant': S G M is the launch, aimed at Dha, Ni and taar Sa in turn, then a falling release to Sa, each line two matras longer than the last.", bandish: 'ayo', section: 'ast',
        lines: ['[SGM D- MGS-]', '[SGM DN- DMG-]', '[SGM DNS”- NDMGS-]'] },
      { name: 'Repeated notes, then the run (bridge taan pattern on Ga)', why: "Your bridge taan pressures one note by repeating it off the beat (M - M - M M), then lets go in a run. Here the same rhythm on Ga, the note your bridge skips, then the run down.", bandish: 'ayo', section: 'ast',
        lines: ['[G- G- GG] [GG- G- GG] [MG MG SN’ S-]'] },
      { name: 'Converging on Ma', why: "Your converging runs end on taar Sa. These converge downward on Ma, Bhinna Shadja's centre: D M, N D M, Ṡ N D M, Ġ Ṡ N D M, then G M D N Ṡ to the mukhda.", bandish: 'ayo', section: 'ant',
        lines: ['[DM-] [NDM-] [S”NDM-] [G”S”NDM-] [GMDNS”]'] },
    ],
  },
  'Patdeep': {
    method: [
      "Badhat: N̤ S g R S first, then Pa announced as the goal at step 6 and returned to again and again. Dha is held, between Pa and Ma (P D M P), as your nuance says: sustain Dha in S N D P, and glide to it from Ni.",
      "Tension in Patdeep is Ma not allowed to rest: step 11 repeats M M M and then moves on to P g M; resting on Ma would turn it into Bhimpalasi. The release is Pa.",
      "Step 20 is a 'longer run, same ending' pattern: g M P, S g M P, N̤ S g M P, P̤ N̤ S g M P, each run starting lower and all of them ending on Pa.",
      "Step 31 turns the descent into dugun cells (Ṡ Ṡ N D, N N D P, D D P M) and the climb into three-note cells (S g M, g M P, M P N, P N Ṡ): the aalap ends where taans begin. Your palta does the same with four-note turns that move up one place at a time.",
    ],
    aalap: { name: 'Patdeep, not Bhimpalasi: rest on Pa', why: "Your nuances: Patdeep rests on Pa and sustains Dha in Ṡ N D P; Bhimpalasi rests on Ma. Each step here goes through Ma without stopping and lands on Pa, with Dha held where your step 16 holds it.",
      steps: ["g m P - - - m g m P - - - - - - -", "m P N ~D - - P - m g m P - - - - -", "S' N ~D - - - P - m P g m - P - - -"] },
    taans: [
      { name: 'Longer run, same ending, on Pa', why: "Your step 20 grows a run backwards toward Pa (g M P, S g M P, N̤ S g M P, P̤ N̤ S g M P). Here it is as a taan in dugun, then a fall through Ṡ N D P to Sa on sam.", lands: 'sam',
        notes: "gm P- Sg mP N.S gm P- P.N. Sg mP S'N DP mg RS" },
      { name: 'Your palta as a taan', why: "Your palta's four-note turns (S g R S, g P M g, M N D P, P Ṡ N D...) climbing one place at a time, run straight through in chaugun to taar Sa and back, landing on sam.", lands: 'sam',
        notes: "SgRS gPmg mNDP PS'ND NR'S'N PNS'N DPmg RS--" },
      { name: 'The Ni to Dha glide inside a taan', why: "Your nuance (sustain Dha, glide from Ni) inside fast music: a run up to Ni, a slide down to a held Dha, then Pa; three times, from higher each time.", lands: 'sam',
        notes: "mP N~D - P gm PN ~D- P- PN S'N ~D- P- mg RS" },
    ],
  },
  'Bageshree': {
    method: [
      "Badhat: the mandra first (S Ḍ n̤ S), then the jump from Sa to Ma through komal Ga (step 4), then Ma repeated until it is the centre (5: M M, g M, S g M).",
      "Pa is only ever on the way down (M P D, P D) and never a resting note; Dha and Ni are opened above Ma.",
      "The release in Bageshri lands on Ma as often as on Sa: step 16 falls in shrinking cascades, M D Ṡ ġ Ṙ n D, Ṙ n D, M D g M, and stops on Ma.",
      "Your four-line pattern (D n Ṡ Ṙ n Ṡ, M D n Ṡ D n, g M D n M D, S g M D g M) is a sequence: a four-note climb and a two-note step back, each line starting one place lower. It is the raga's grammar made into an exercise.",
    ],
    aalap: { name: 'Landing on Ma, not Sa', why: "Your step 16 ends its cascade on Ma. These steps each fall and land on Ma from a different direction (from Dha, from Ga, from Ṡ through n D), so Ma becomes the place you rest.",
      steps: ["D - - - n - D - m - - - - - - -", "S g m - - - g R - S - g - m - - -", "S' - n D - - m P D - g - m - - -"] },
    taans: [
      { name: 'Your pattern continued down', why: "Your four-line pattern steps down one place a line (D n Ṡ Ṙ n Ṡ, M D n Ṡ D n, g M D n M D, S g M D g M). Here it continues the same way into the mandra (n̤ S g M S g, Ḍ n̤ S g n̤ S) and lands on Ma.", lands: 'sam',
        notes: "DnS'R' nS' mDnS' Dn gmDn mD SgmD gm n.Sgm Sg D.n.Sg n.S m-" },
      { name: 'Converging on Ma', why: "Like your converging runs (M D N Ṡ, G M D N Ṡ...), but aimed at Bageshri's centre: D M, n D M, Ṡ n D M, then g M D n Ṡ and down to Ma on sam.", lands: 'sam',
        notes: "Dm - nD m- S'n Dm -- gm Dn S'n Dm Pm g m" },
    ],
  },
};

// The other Library ragas: the same structure (numbered badhat steps, a build-up palta, taans
// to and from a mukhda), Bhimsen-inspired, composed for this app.
const CN_OTHERS = {
  'Puriya Dhanashree': {
    steps: ["S - - - N. - r - - - S - - -", "N. r G - - - r - S - - -", "N. r G M - G - r G - - -", "M P - - - M G M r G - - -", "G M d - - P - - - M G M r G -", "M d N - d P - - M G M r G - -", "P d N S' - - - - N d P - - -", "N r' - S' - N d P - M G M r G - r S"],
    palta: "N.rG rGM GMP MPd PdN dNS' S'Nd NdP dPM PMG MGr GrS", mukhda: { notes: "M G M r G - r S - _", words: 'a composed mukhda' },
    taans: ["N.rGM PdNS' r'S'Nd P-", "MPdN S'r'S'N dPMG MrG-", "PdNS' NdPM GMrG r-S-"] },
  'Todi (Miyan ki)': {
    steps: ["S - - - r - - - S - - -", "d. N. S r ^g - - - r - S - - -", "r g M ^d - - - M ^g - r - S - - -", "M ^d - - N - - - ^d - M - ^g - - -", "M d N S' - - - - N ^d - - - - - -", "r' g' r' S' - - N ^d - M ^g - r g r S -"],
    palta: "d.N.Sr N.Srg SrgM rgMd gMdN MdNS' S'NdM NdMg dMgr Mgr- S", mukhda: { notes: "r g r S - - - - - _", words: 'a composed mukhda' },
    taans: ["Srgr gMdM dNS'N dMg-", "N.Srg MdNS' r'S'Nd Mgr-", "gMdN S'r'g'r' S'NdM gr-S"] },
  'Malkauns': {
    steps: ["S - - - n. - ~~d. - - - S - - -", "n. S g - - - m - ~~g - S - - -", "g m d - - - ~~m - - - g m ~~g -", "m d n - - - ~~d - m - - - - - -", "d n S' - - - - - n ~~d - ~~m - - -", "S' g' m' - ~~g' - S' - n ~~d - m - g S -"],
    palta: "n.Sg Sgm gmd mdn dnS' nS'g' S'nd ndm dmg mgS gS-- S", mukhda: { notes: "m g m d - m g S - _", words: 'a composed mukhda' },
    taans: ["Sgmd nS'nd mgS-", "gmdn S'g'S'n dmgm g-S-", "dnS'g' m'g'S'n dmgS -"] },
  'Darbari Kanada': {
    steps: ["S - - - n. - - - S - - -", "S n. P. - - - m. P. ^d. - n. - S - - -", "S R ^g - - - m R - S - - -", "R ^g m P - - - - ^d n P - - -", "m P ^d n S' - - - ^d n P - m P ^g m R S"],
    palta: "n.SRg SRgm Rgm P gmPd mPdn Pdn S' S'dnP dnPm nPmg Pgm R gmRS", mukhda: { notes: "m P ^g m R - S - - _", words: 'a composed mukhda' },
    taans: ["n.SRg mRS- n.SRg mPgm R-S-", "RgmP dnS'n dnPm gmRS", "mPdn S'R'S'd nPmP gmR-"] },
  'Multani': {
    steps: ["S - - - N. - - - S - - -", "N. S (M)g - - - M g (S)r S - - -", "N. S g M P - - - M (M)g - - -", "M P N - - - S' - N d P - - -", "N S' g' - - - r' S' N d P - M (M)g - (S)r S"],
    palta: "N.Sg SgM gMP MPN PNS' NS'g' S'Nd NdP dPM PMg Mgr gr-S", mukhda: { notes: "M P (M)g - - (S)r S - _", words: 'a composed mukhda' },
    taans: ["N.SgM PNS'N dPMg rS--", "gMPN S'g'r'S' NdPM g-r-", "MPNS' NdPM gMgr S-"] },
};

// ---------------------------------------------------------------- building the lessons
const cnTag = { cn: 'notes' };
const CN_BUILT = [];

function cnPadTo(tokens, n) { const t = tokens.slice(); while (t.length % n) t.push('_'); return t; }
function cnEcho(tokens, n) {
  const call = cnPadTo(tokens, n);
  return [...call, ...cnPadTo(yourTurn(call.join(' ')).split(' '), n)];
}

// one aalap step group: each step played, then your turn
function cnAalapLesson(path, cn, g, opts = {}) {
  const steps = cn.aalap.slice(g.from - 1, g.to);
  const toks = steps.flatMap(s => cnEcho(cnNotes(s, { aalap: true }), 4));
  const n = g.to - g.from + 1;
  return {
    id: `${path.id}-cn-aalap-${g.from}`, stage: 'badhat', level: g.from > 1 ? 3 : 2, cn: 'notes',
    name: `Aalap steps ${g.from} to ${g.to}: ${g.name}`, minutes: Math.max(3, Math.round(n * 0.8)), taal: 'Ektaal',
    bpm: { start: 66, target: 50, step: -4 }, lays: [1],
    purpose: `Steps ${g.from} to ${g.to} of your ${path.name} aalap, in order. Each step is played, then left for you to sing back: the outlined notes are your turn.`,
    why: g.why,
    how: ['One note a matra, each dash or dot a matra held, a comma a breath. The rhythm is the app’s: your page gives the notes and their order, so stretch the held notes as the raga asks.', 'Sing it in sargam first, then in aakaar (your homework note asks for both).'],
    listen: `Each step’s last note settled and in tune before the next step starts. In ${path.name} the resting notes are ${path.nyas}.`,
    mistakes: `Rushing the held notes; adding a note the step doesn’t have yet. ${path.pitfalls ? 'In ' + path.name + ': ' + path.pitfalls + '.' : ''}`,
    harder: 'Guide off; then slower, so every held note is longer; then sing the steps without the gaps, as one aalap.',
    his: steps.map((s, k) => `${g.from + k}. ${s}`),
    notes: () => toks.join(' '),
  };
}

function cnMukhdaTokens(m) { return m.notes.split(/\s+/); }

// a set of bandish taans: mukhda, taan, mukhda, taan ... each taan placed so the mukhda comes back
// on its matra
function cnTaanLesson(path, b, sec, list, label, opts) {
  const toks = [], words = [];
  const M = sec.M, mk = cnMukhdaTokens(sec.mukhda);
  const addM = (m, w) => { words.push({ b: toks.length, t: w }); toks.push(...m); };
  for (const t of list) {
    addM(mk, sec.mukhda.words);
    // from the end of the mukhda to the taan's first matra (rests if there is a gap)
    const mEnd = (sec.mukhda.at - 1 + mk.length) % M; // 0-based matra after the mukhda
    let gap = ((sec.from - 1) - mEnd + M) % M;
    while (gap-- > 0) toks.push('_');
    toks.push(...cnMatras(cnSlots(t.place.units)));
  }
  if (sec.land) addM(cnMukhdaTokens(sec.land), sec.land.words);
  else addM(mk, sec.mukhda.words);
  const names = list.map(t => t.label).join('; ');
  return Object.assign({
    stage: 'taan', taal: b.taal, startAt: sec.mukhda.at, lays: [1], words, cn: 'notes',
    bpm: { start: Math.round(b.bpm * 0.6 / 4) * 4, target: b.bpm, step: 4 },
    how: [`Starts on matra ${sec.mukhda.at} with "${sec.mukhda.words}" (sung by you; the notes under it are your bandish’s), then the taan from matra ${sec.from}, then "${(sec.land || sec.mukhda).words}" again on matra ${(sec.land || sec.mukhda).at}.`,
      'Start slow, well under the bandish tempo, until every note of every bracket is there; then raise it 4 BPM a clean session.',
      'Sing in sargam first, then in aakaar.'],
    listen: 'The mukhda arriving on its matra after every taan, and the brackets at exactly double speed.',
    mistakes: `Rushing into the mukhda; uneven brackets. In ${path.name}: ${path.pitfalls}.`,
    harder: `Toward ${b.bpm} BPM, the bandish tempo; then the guide off; then the taans back to back without the mukhda in between.`,
    notes: () => toks.join(' '),
    taanNames: names,
  }, opts);
}

function cnBuild(raga, cn) {
  const path = PATHS.find(p => p.id === cn.path);
  if (!path) return;
  const out = [], add = o => out.push(Object.assign({ track: path.id, raga: path.raga, check: true, cnFile: cn.file }, o));
  const pit = path.pitfalls;
  CN_UNPLACED[raga] = CN_UNPLACED[raga] || [];

  // chalan and pakads
  if (cn.chalan) add({ id: `${path.id}-cn-chalan`, stage: 'chalan', level: 2, cn: 'notes', name: 'The chalan from your notes', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 48, step: -4 }, lays: [1],
    purpose: `Your notes’ chalan for ${path.name}, phrase by phrase, each nyas held a whole vibhag, then the same for you to sing.`,
    why: 'The chalan is the raga’s walk: every phrase in it ends on a note your notes mark as nyas. Holding those notes long is what teaches the ear where the raga rests.',
    how: ['Play it once, then sing it back in the outlined half.', 'Kans in brackets are a flick of the note, not a note of their own.'],
    listen: `The marked nyas notes held still: ${path.nyas}.`, mistakes: pit ? `In ${path.name}: ${pit}.` : 'Rushing the held notes.',
    harder: 'Guide off; then make one phrase of your own that ends on each nyas.',
    his: [cn.chalan.his], notes: () => cnEcho(cn.chalan.notes.split(/\s+/), 4).join(' ') });
  if (cn.pakads) add({ id: `${path.id}-cn-pakads`, stage: 'chalan', level: 2, cn: 'notes', name: `Your ${cn.pakads.length} pakads, call and answer`, minutes: 5, taal: 'Teentaal',
    bpm: { start: 64, target: 80, step: 4 }, lays: [1],
    purpose: `All ${cn.pakads.length} pakads from your ${path.name} notes, each played and then left for you.`,
    why: `A pakad is the shortest phrase that can only be ${path.name}. ${cn.avoid ? 'Your notes also name the phrases it never uses: ' + cn.avoid.join('; ') + '. Every pakad here gets round them.' : ''}`,
    how: ['Each pakad is played, then outlined for you. The meend marked -> in your notes is drawn as a slide.'],
    listen: 'The pakad as one gesture, not a row of notes.', mistakes: pit ? `In ${path.name}: ${pit}.` : '',
    harder: 'Guide off; then string two pakads together into one phrase.',
    his: cn.pakads.map((p, k) => `${k + 1}) ${p[0]}`),
    notes: () => cn.pakads.flatMap(p => cnEcho(p[1].split(/\s+/), 4)).join(' ') });
  if (cn.nuances) add({ id: `${path.id}-cn-nuance`, stage: 'orn', level: 3, cn: 'notes', name: 'Your nuances: P N Ṙ N D M P, and the held Dha', minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 44, step: -4 }, lays: [1],
    purpose: 'The two phrases your notes single out for Patdeep, each played and then yours.',
    why: 'Patdeep, Bhimpalasi and Madhuvanti share most of their notes. Your notes tell them apart by where they rest: Patdeep on Pa, with Dha sustained in Ṡ N D P and reached by a glide from Ni; Bhimpalasi on Ma.',
    how: ['Hold the Dha its full length before Pa.'], listen: 'Dha steady, then Pa as the place of rest.', mistakes: 'Resting on Ma, which turns it into Bhimpalasi.',
    harder: 'Guide off; then build a phrase of your own that ends P, with Dha held before it.',
    his: cn.nuances.map(n => n[0]), notes: () => cn.nuances.flatMap(n => cnEcho(n[1].split(/\s+/), 4)).join(' ') });

  // aalap steps
  (cn.aalapGroups || []).forEach(g => add(cnAalapLesson(path, cn, g)));
  // the performance format (Bhinna Shadja)
  (cn.format || []).forEach(part => {
    const toks = part.steps.flatMap(s => cnEcho(cnNotes(s[1], { aalap: true }), 4));
    add({ id: `${path.id}-cn-format-${part.steps[0][0]}`, stage: 'badhat', level: 4, cn: 'notes',
      name: `Performance format, steps ${part.steps[0][0]} to ${part.steps[part.steps.length - 1][0]}${part.mine ? ' (your part)' : ''}`, minutes: 4, taal: 'Ektaal',
      bpm: { start: 66, target: 54, step: -4 }, lays: [1],
      purpose: `${part.mine ? 'Your part' : part.part} of the final performance format’s aalap: each step played, then yours.`,
      why: "The format's aalap is shared out in order: part 1 stays in the mandra and around Sa, your part opens Dha and Ni over Ma and ends at the edge of taar Sa (N N → Ṡ), and part 3 starts in the taar saptak and brings it home. Each part ends where the next can begin.",
      how: ['Brackets () are sung fast as one string (double speed here); ~ is a meend into the next note.', 'Your notes mark some phrases to sing softly; that isn’t shown here.'],
      listen: 'Each meend landing exactly on its note; Ma steady as the centre.', mistakes: `In ${path.name}: ${pit}.`,
      harder: 'Guide off; then sing the steps one after another, as on stage.',
      his: part.steps.map(s => `${s[0]}. ${s[1]}`), notes: () => toks.join(' ') });
  });

  // exercises 1-4 (Yaman): the scale doubled, tripled, quadrupled
  if (cn.exercises) {
    const toks = cn.exercises.flatMap((e, k) => {
      const per = k + 1, line = e[0].replace(/^\d+\)\s*/, '');
      const u = cnUnits(line.replace(/\//, ' ')).filter(x => x.l);
      // thah: two matras per note (his "S”-"); doubled etc.: the notes fill the matra
      const grp = [];
      for (let i = 0; i < u.length; i += per) grp.push(u.slice(i, i + per).map(cnTok).join(''));
      return cnPadTo(grp, 4);
    });
    add({ id: `${path.id}-cn-ex1-4`, stage: 'laya', level: 2, cn: 'notes', name: 'Exercises 1 to 4: one, two, three and four of each note', minutes: 4, taal: 'Teentaal',
      bpm: { start: 60, target: 96, step: 4 }, lays: [1],
      purpose: 'Your exercises 1 to 4: the aaroh and avaroh with each note once, twice, three and four times, each version one matra a note-group, so the speed doubles, triples and quadruples.',
      why: 'The same scale four times over, only faster inside each matra: the layakari ladder done on a scale before it is done on a taan. Pa stays out going up (N R G M D N Ṡ) at every speed.',
      how: ['One matra a group: S, then SS, then SSS, then SSSS.', 'Keep the repeated notes separate, from the breath, not the throat.'],
      listen: 'Repeated notes equal in length and pitch; Pa left out going up even at four a matra.', mistakes: 'Rushing the four-note groups; sliding the repeated notes together.',
      harder: 'Faster, 4 BPM at a time; then the guide off.', his: cn.exercises.map(e => e[0]), notes: () => toks.join(' ') });
  }
  if (cn.merukhand) {
    const chunks = [[5, 12, 'Exercises 5 to 12: runs growing up from each note', 3], [13, 20, 'Exercises 13 to 20: runs growing down from each note', 3], [21, 25, 'Exercises 21 to 25: the mandra', 2]];
    for (const [a, z, name, lv] of chunks) {
      const rows = cn.merukhand.filter(r => r.n >= a && r.n <= z);
      const toks = rows.flatMap(r => r.rows.split(/\s+/).flatMap(run => {
        const u = cnUnits(run).filter(x => x.l);
        const sl = u.map(cnTok);
        if (sl.length % 2) sl.push('-');
        const ms = []; for (let i = 0; i < sl.length; i += 2) ms.push(sl[i] + (sl[i + 1] === '-' ? '' : sl[i + 1]));
        ms.push('-');
        return ms;
      }).concat(['_', '_'])).map(t => t);
      add({ id: `${path.id}-cn-meru-${a}`, stage: 'taan', level: lv, cn: 'notes', name, minutes: 4, taal: 'Teentaal',
        bpm: { start: 60, target: 92, step: 4 }, lays: [1],
        purpose: `Your Yaman exercises ${a} to ${z}: each starts from one note and grows by one note at a time, in dugun, the last note of each run held.`,
        why: "Each run starts from the same note and goes one note further: the ear always knows where it begins and has to find the new note at the end. They also teach the raga’s rules at speed, because the runs skip Pa going up (N R G M P, then N R G M D) and use it coming down.",
        how: ['Two notes a matra; the last note of each run is held a matra before the next starts.'],
        listen: 'The new note at the end of each run in tune, and Pa where it belongs.', mistakes: 'Adding Pa going up; losing the start note as the runs get longer.',
        harder: 'Chaugun (four a matra, at half the tempo); then the guide off.',
        his: rows.map(r => `${r.n}) ${r.rows}`), notes: () => toks.join(' ') });
    }
  }
  if (cn.palta) {
    let toks, his;
    if (typeof cn.palta === 'string') {
      // "S SG SGM, G GM GMD ..." : each group a matra (dugun inside), two lines
      his = [cn.palta];
      toks = cn.palta.split(/[,/]|\s+/).filter(Boolean).map(g => cnUnits(g).filter(x => x.l).map(cnTok).join(''));
    } else if (Array.isArray(cn.palta[0])) {
      // Patdeep: three columns of four-note cells, read down each column, then the closing aaroh/avaroh
      his = cn.palta.map(r => r.join('   ')).concat(cn.paltaEnd);
      const cols = [0, 1, 2].map(c => cn.palta.map(r => r[c]));
      toks = cols.flat().concat(cn.paltaEnd).map(g => cnUnits(g.replace(/G”/g, 'g”')).filter(x => x.l).map(cnTok).join(''));
    } else {
      his = cn.palta;
      toks = cn.palta.flatMap(l => l.split(/\s+/)).map(g => cnUnits(g).filter(x => x.l).map(cnTok).join(''));
    }
    add({ id: `${path.id}-cn-palta`, stage: 'taan', level: 3, cn: 'notes', name: 'Your palta', minutes: 4, taal: 'Teentaal',
      bpm: { start: 56, target: 96, step: 4 }, lays: [1],
      purpose: `The palta from your ${path.name} notes, one group a matra: a group of three notes is tigun, four is chaugun.`,
      why: raga === 'Bhinna Shadja' ? "S, S G, S G M: each group starts on the next note and grows by one, so the line climbs while the groups get longer. The second line mirrors it down, and your aalap step 20 is that second line sung slowly."
        : raga === 'Patdeep' ? "Each cell is a four-note turn (S g R S, g P M g...), and each column starts one place lower than the last: the turns climb the raga in steps, and the closing line is the plain aaroh and avaroh."
        : "A four-note climb and a two-note step back, each line starting one place lower: the raga's own movement, made into a sequence.",
      how: ['One group a matra; the groups get longer, so they get faster inside the matra.'], listen: 'Every group starting exactly on the matra.',
      mistakes: `Notes the raga doesn’t have creeping in at speed. In ${path.name}: ${pit}.`, harder: 'Faster; then the guide off; then start it from another note.',
      his, notes: () => cnPadTo(toks, 4).join(' ') });
  }

  // Yaman's Jhaptaal page
  if (cn.jhaptaal) {
    const J = cn.jhaptaal;
    const row = (lines, mk) => {
      const cells = lines.flatMap(l => l.split(/\s+/));
      return cells.map((c, k) => (c === '·' ? cnCell(mk.cells[k]) : cnCell((J.fix && J.fix[c]) || c)));
    };
    const build = (rows, mk, first) => {
      const toks = [], words = [];
      rows.forEach((r, k) => {
        if (r[0].startsWith('·')) words.push({ b: toks.length, t: mk.words });
        toks.push(...row(r, mk));
      });
      words.push({ b: toks.length, t: mk.words });
      toks.push(...mk.cells.map(cnCell));
      return { toks, words };
    };
    const groups = [
      [J.asthaayi.slice(0, 5), 1, 'Jhaptaal asthaayi taans 1 to 5: one and two notes a matra', 2, J.mukhda],
      [J.asthaayi.slice(5, 10), 6, 'Jhaptaal asthaayi taans 6 to 10: dugun comes in', 3, J.mukhda],
      [J.asthaayi.slice(10, 15), 11, 'Jhaptaal asthaayi taans 11 to 15: tigun and chaugun', 4, J.mukhda],
      [J.antara.slice(0, 3), 1, 'Jhaptaal antara taans 1 to 3: one cycle each', 3, J.antaraMukhda],
      [J.antara.slice(3, 6), 4, 'Jhaptaal antara taans 4 to 6: two to five cycles', 4, J.antaraMukhda],
    ];
    const whys = [
      "Taan 1 is the bandish line itself (N̤ R G M, P R G R N̤ S) and taan 2 its variant, both one note a matra. From 3 the mukhda 'chandrama' is sung and the taan fills matras 5 to 10, with two-note matras appearing one or two at a time (N̤ N̤ G RG G RS).",
      "Two notes a matra become the rule (N̤R, GR, SN̤), and taan 6 runs two whole cycles before 'chandrama' returns: the first taan that makes you wait for the release.",
      "Now three and four notes a matra: PMRG RGRG in 11, N̤GR RMG GPM MDP in 13. Same range as before (mostly N̤ to Pa), much denser: the tension is all in the speed.",
      "The antara taans start in the upper half (Ṡ N D P, N D Ṡ N Ġ Ṙ) and come down to the madhya, each one cycle, landing on 'trishoola'.",
      "Long taans of two to five cycles, mixing two, three and four notes a matra, with repeated-note cells near the end (Ġ - Ġ Ṙ, Ṡ N D Ṡ Ṡ Ṡ) that hold back the arrival of 'trishoola'.",
    ];
    groups.forEach(([rows, n0, name, lv, mk], gi) => {
      const { toks, words } = build(rows, mk);
      add({ id: `${path.id}-cn-jhap-${gi < 3 ? 'ast' : 'ant'}-${n0}`, stage: 'taan', level: lv, cn: 'notes', name, minutes: 5, taal: 'Jhaptaal',
        bpm: { start: 60, target: 100, step: 4 }, lays: [1], words,
        purpose: `Your Jhaptaal taans for "chandrama lalaaT par", one cell a matra as on your page, each followed by the mukhda on sam.`,
        why: whys[gi],
        how: ['Each cell of your page is one matra; the notes in a cell share it equally.', gi < 3 ? '"chandrama" on matras 1 to 4 is N̤ R G M, as in your taan 1.' : 'The antara’s mukhda, "trishoola" on 1 to 4, has no notes on your page: those matras are left for you to sing the words.', 'Your homework: sargam first, then aakaar.'],
        listen: 'Every cell exactly one matra, however many notes it has, and the mukhda on sam.', mistakes: `Rushing the four-note cells; in Yaman: ${pit}.`,
        harder: 'Toward 100 BPM; then the guide off.',
        his: rows.map((r, k) => `${n0 + k}) ${r.join(' / ')}`), flags: gi >= 3 ? J.unclear : null,
        notes: () => toks.join(' ') });
    });
  }
  // Yaman: eight-matra taans with lead-ins (no taal on the page)
  if (cn.eights) {
    const E = cn.eights;
    const toks = [], words = [], his = [];
    E.taans.forEach(([li, line], k) => {
      const u = cnUnits(line); const h = cnHalves(u);
      if (h !== 16) CN_UNPLACED[raga].push({ where: `Yaman taans page, taan ${k + 1}`, text: line, why: `comes to ${h / 2} matras where the others are 8`, kept: true });
      const pad = h < 16 ? [...u, { hold: true, d: 16 - h }] : u;
      words.push({ b: toks.length, t: E.lead[li][0] });
      const call = cnMatras(cnSlots(pad));
      toks.push(...call, ...yourTurn(call.join(' ')).split(' '));
      his.push(`${k + 1}) ${E.lead[li][0]} … ${line} … ${E.lead[li][1]}`);
    });
    add({ id: `${path.id}-cn-eights`, stage: 'taan', level: 3, cn: 'notes', name: 'Eight-matra taans: "mohe gagari" and "baar baar"', minutes: 5, taal: 'Teentaal',
      bpm: { start: 60, target: 96, step: 4 }, lays: [1], words,
      purpose: 'Your 15 short Yaman taans, eight matras each, each played and then yours to sing back. The words show which line each one sits in.',
      why: "Two four-note halves that answer each other (N̤ R G R, N̤ G R G; m G m P, m G R G): a question that climbs and an answer that turns back. 11 to 15 move up the raga (P m G m, then N̤ R G M G M D N, then Ṡ N D P M D N Ṡ) and 15 is the same note four times on G, M, D, N: tension by repetition.",
      how: ['One note a matra, brackets at double speed.', 'Your page gives no taal or placement, so each taan starts on sam here and the next eight matras are yours.'],
      listen: 'The two halves equal; the bracketed notes exactly twice as fast.', mistakes: `In Yaman: ${pit}.`,
      harder: 'Dugun (half the tempo, two notes a matra in your head); then the guide off.', his,
      flags: ['Your page gives no taal and its right edge is cut off, so the line after each taan is incomplete. Taan 7 ([D̤N̤S], [D̤N̤S], [GRS], [GRS]) comes to 6 matras by the bracket rule; the last 2 are held.'],
      notes: () => toks.join(' ') });
  }

  // bandish taans, placed in the taal
  for (const b of cn.bandish || []) {
    for (const sec of b.sections) {
      const placed = [], skipped = [];
      for (const [tid, label, lines, extra] of sec.taans) {
        const t = { tid, label, lines, dashOne: extra && extra.dashOne };
        t.place = cnPlace(t, sec);
        t.units = lines.map(l => cnUnits(l));
        t.score = cnScore(t.units.flat());
        const marks = extra && extra.marks;
        if (marks) {
          const off = t.place.perLine.map((v, k) => (Math.abs(v - marks[k]) > 0.01 ? `line ${k + 1} is ${v} by the rules, marked ${marks[k]}` : null)).filter(Boolean);
          if (off.length) t.markNote = off.join('; ');
        }
        if (t.place.ok) placed.push(t);
        else { skipped.push(t); CN_UNPLACED[raga].push({ where: `${b.name}, ${sec.name}, ${label}`, text: lines.join(' / '), why: `comes to ${t.place.beats} matras; from matra ${sec.from} to the mukhda on ${sec.next} needs ${t.place.need}${sec.M ? ' (or that plus whole cycles of ' + sec.M + ')' : ''}${t.markNote ? '; ' + t.markNote : ''}` }); }
      }
      if (!placed.length) continue;
      // grade: easiest first, at most five a lesson
      if (!sec.bridge) placed.sort((a, b) => a.score - b.score);
      const n = sec.bridge ? 1 : Math.ceil(placed.length / 5);
      const per = Math.ceil(placed.length / n);
      for (let gi = 0; gi < n; gi++) {
        const list = placed.slice(gi * per, (gi + 1) * per);
        const grade = n > 1 ? ` (grade ${gi + 1} of ${n})` : '';
        const notes = [];
        list.forEach(t => {
          if (t.place.how !== 'as written') notes.push(`${t.label}: fits only with each line held out to 8 matras, as your "8 beats" marks suggest.`);
          if (t.markNote) notes.push(`${t.label}: ${t.markNote}.`);
          if (t.place.slack >= 1) notes.push(`${t.label}: a matra short of the mukhda, so its last note is held a matra.`);
        });
        if (sec.mukhda.note && gi === 0) notes.unshift(sec.mukhda.note);
        if (b.taalNote && gi === 0) notes.unshift(b.taalNote);
        add(cnTaanLesson(path, b, sec, list.map(t => ({ label: t.label, place: t.place })), '', {
          id: `${path.id}-cn-${b.id}-${sec.id}-${gi + 1}`, level: sec.bridge ? 4 : [2, 3, 4][Math.min(2, gi + (n < 3 ? 1 : 0))] || 3,
          name: `${b.name}: ${sec.name} taans${grade}`.replace(': bridge to the antara taans', ': the bridge taan'), minutes: Math.max(4, list.length * 2),
          purpose: `${sec.bridge ? 'The bridge taan' : 'Taans'} from your notes for the ${sec.name} of "${b.name}" (${b.taal}${b.bpm ? ', ' + b.bpm + ' BPM' : ''}), each between the mukhda and its return: ${list.map(t => t.label).join('; ')}.`,
          why: sec.bridge
            ? "The bridge leaves the asthaayi and lands on the antara's first words. It works by pressure: the same note repeated off the beat (M - M - M M), on Ma, then Dha, then Ni, each followed by a release down the scale, and finally a climb that converges on taar Sa, so the antara arrives as a release."
            : gi === 0 ? 'The shortest and steadiest of the set: one or two brackets, few changes of direction, mostly within an octave. They teach the placement: from the matra after the mukhda to the mukhda’s return.'
            : 'Denser, with more turns and wider range, and some running over more than one cycle, so the mukhda is held back longer and lands harder.',
          his: list.map(t => `${t.label}: ${t.lines.join(' / ')}`), flags: notes.length ? notes : null,
        }));
      }
    }
  }
  return out;
}

// composed in his method, for the four ragas with class notes
function cnMethodLessons(raga, m) {
  const cn = CLASS_NOTES[raga], path = PATHS.find(p => p.id === cn.path);
  const out = [], add = o => out.push(Object.assign({ track: path.id, raga: path.raga, check: true, cn: 'method', composed: true }, o));
  if (m.aalap) add({ id: `${path.id}-cm-aalap`, stage: 'badhat', level: 3, name: `In your method: ${m.aalap.name}`, minutes: 4, taal: 'Ektaal',
    bpm: { start: 60, target: 48, step: -4 }, lays: [1],
    purpose: 'Three aalap steps composed for this app in the way your notes build the badhat, each played and then yours.',
    why: m.aalap.why, how: ['One note a matra, held notes held; then the same steps outlined for you.'],
    listen: `Where each step lands: ${path.nyas}.`, mistakes: `In ${path.name}: ${path.pitfalls}.`, harder: 'Guide off; then add a fourth step of your own in the same pattern.',
    notes: () => m.aalap.steps.flatMap(s => cnEcho(s.split(/\s+/), 4)).join(' ') });
  m.taans.forEach((t, k) => {
    const base = { id: `${path.id}-cm-taan-${k + 1}`, stage: 'taan', level: 4, name: `In your method: ${t.name}`, minutes: 4,
      why: t.why, listen: 'The landing: mukhda or sam, exactly on the matra.', mistakes: `In ${path.name}: ${path.pitfalls}.`,
      harder: 'Faster, 4 BPM at a time; then the guide off; then make the next line of the pattern yourself.' };
    if (t.cells) {
      const mk = cn.jhaptaal.mukhda, toks = [], words = [];
      t.cells.forEach(r => { words.push({ b: toks.length, t: mk.words }); toks.push(...mk.cells.map(cnCell), ...r); });
      words.push({ b: toks.length, t: mk.words }); toks.push(...mk.cells.map(cnCell));
      add(Object.assign(base, { taal: 'Jhaptaal', bpm: { start: 60, target: 96, step: 4 }, lays: [1], words,
        purpose: 'Composed for this app on your Jhaptaal page’s frame: "chandrama" on 1 to 4, the taan on 5 to 10, "chandrama" again.',
        how: ['One cell a matra, as on your page.'], notes: () => toks.join(' ') }));
    } else if (t.lines) {
      const b = cn.bandish.find(x => x.id === t.bandish), sec = b.sections.find(s => s.id === t.section);
      const tt = { lines: t.lines }; tt.place = cnPlace(tt, sec);
      if (!tt.place.ok) { console.warn('composed taan does not fit', raga, t.name, tt.place); return; }
      add(cnTaanLesson(path, b, sec, [{ label: t.name, place: tt.place }], '', Object.assign(base, { composed: true, cn: 'method',
        purpose: `Composed for this app, placed in "${b.name}" like your own taans: mukhda, taan from matra ${sec.from}, mukhda.`,
        his: null })));
    } else {
      add(Object.assign(base, { taal: 'Teentaal', bpm: { start: 64, target: 100, step: 4 }, lays: [1], lands: 'sam',
        purpose: 'Composed for this app in your notes’ method; placed so the last note falls on sam.',
        how: ['Start where the graph shows so the last note lands on sam.'], notes: () => t.notes }));
    }
  });
  return out;
}

// the other ragas: numbered badhat steps, a build-up palta, and taans to a mukhda (composed)
function cnOtherLessons(raga, o) {
  const path = PATHS.find(p => p.raga === raga);
  if (!path) return [];
  const out = [], add = x => out.push(Object.assign({ track: path.id, raga, check: true, composed: true, bhimsen: true, cn: 'others' }, x));
  add({ id: `${path.id}-cm-steps`, stage: 'badhat', level: 3, name: `Badhat in ${o.steps.length} numbered steps`, minutes: 6, taal: 'Ektaal',
    bpm: { start: 60, target: 48, step: -4 }, lays: [1],
    purpose: `A ${path.name} aalap in ${o.steps.length} short numbered steps, built the way your Yaman and Bhinna Shadja notes build theirs, each played and then yours.`,
    why: `As in your notes: Sa and the note below it first, then one new note a step, each step ending on a resting note (${path.nyas}), the taar saptak only near the end, and the last step the whole raga in one breath. Bhimsen-inspired in its long held nyas.`,
    how: ['Each step is played, then outlined for you.', 'One note a matra; dashes are held matras.'],
    listen: 'Each step adding exactly one thing to the one before.', mistakes: `In ${path.name}: ${path.pitfalls}.`,
    harder: 'Guide off; then write the next step yourself.',
    notes: () => o.steps.flatMap(s => cnEcho(s.split(/\s+/), 4)).join(' ') });
  add({ id: `${path.id}-cm-palta`, stage: 'taan', level: 3, name: 'Build-up palta in the raga', minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 100, step: 4 }, lays: [1],
    purpose: `A palta of overlapping three-note cells up ${path.name} and down again, one cell a matra (tigun).`,
    why: "Your Bhinna Shadja palta (S S G S G M, G G M G M D...) climbs in cells that overlap. This one does the same in this raga, keeping its skipped notes and its own way down.",
    how: ['Three notes a matra; the cells overlap, so each starts on the second note of the last.'], listen: 'The raga’s own turns still audible at speed.',
    mistakes: `In ${path.name}: ${path.pitfalls}.`, harder: 'Faster; then the guide off.',
    notes: () => cnPadTo(o.palta.split(/\s+/), 4).join(' ') });
  // taans from the mukhda: mukhda on 13 to sam, taan from 2 (or 5), back to the mukhda on 13
  const mk = o.mukhda.notes.split(/\s+/);
  const toks = [], words = [];
  o.taans.forEach(t => {
    words.push({ b: toks.length, t: 'mukhda' });
    toks.push(...mk);
    const cells = t.split(/\s+/);
    toks.push(...cells);
    while ((toks.length) % 16) toks.push('-');
  });
  words.push({ b: toks.length, t: 'mukhda' }); toks.push(...mk);
  add({ id: `${path.id}-cm-mukhda`, stage: 'taan', level: 4, name: 'Taans between a mukhda', minutes: 5, taal: 'Teentaal',
    bpm: { start: 64, target: 100, step: 4 }, lays: [1], startAt: 13, words,
    purpose: `Three ${path.name} taans, each between a short composed mukhda that starts on matra 13 and lands on sam, the way your bandish taans sit between "aayo ree basant".`,
    why: "As in your bandish pages: the taan leaves after the mukhda lands, climbs (tension), and comes down to the mukhda's start; the mukhda's arrival on sam is the release. The three taans grow from one octave to a turn at the top.",
    how: ['The mukhda is composed for this app (there is no bandish for this raga in your notes): sing it in sargam or aakaar.', 'Taans are four notes a matra.'],
    listen: 'The mukhda landing on sam after every taan.', mistakes: `In ${path.name}: ${path.pitfalls}.`,
    harder: 'Faster; then the guide off; then put the taans into a bandish you know.',
    notes: () => toks.join(' ') });
  return out;
}

// new paths for the ragas his notes add
const CN_PATHS = [
  { id: 'p-bhinna', raga: 'Bhinna Shadja', name: 'Bhinna Shadja',
    character: "Also called Kaushidhwani. Five notes, S G M D N, all shuddha: no Re and no Pa. Ma is the centre; phrases are joined by meends and fold back to Ma or Sa.",
    nyas: 'Ma, Sa and taar Sa', pitfalls: "a Pa or Re slipping into the wide steps; Dha or Ni flat; resting on Ga instead of moving through it to Ma or Sa",
    neighbours: "Malkauns has the same shape with komal Ga, Dha and Ni; Bhinna Shadja is its all-shuddha cousin.", fromNotes: true,
    swar: "S - - - - - - - G - - - - - - - m - - - - - - - D - - - - - - - N - - - - - - - S' - - - - - - - N - - - D - - - m - - - - - - - G - - - S - - - - - - -" },
  { id: 'p-patdeep', raga: 'Patdeep', name: 'Patdeep',
    character: "Kafi thaat with shuddha Ni, afternoon: komal Ga, shuddha Ni. Up N̤ S g M P N Ṡ, with Re and Dha left out; down with them. Pa is the resting note.",
    nyas: 'Pa, Sa and komal Ga', pitfalls: "resting on Ma (that is Bhimpalasi); using Re or Dha going up; Dha passed quickly in Ṡ N D P instead of sustained",
    neighbours: "Bhimpalasi has komal Ni and rests on Ma; Madhuvanti has tivra Ma.", fromNotes: true,
    swar: "N. - - - S - - - g - - - m - - - P - - - - - - - N - - - S' - - - - - - - N - - - ~D - - - - - - - P - - - m - - - g - - - R - - - S - - - - - - -" },
  { id: 'p-bageshree', raga: 'Bageshree', name: 'Bageshri',
    character: "Kafi thaat, night: komal Ga and Ni. Ma is the centre; the voice jumps from Sa to Ma through komal Ga, and Pa is only touched on the way down.",
    nyas: 'Ma, Sa and Dha', pitfalls: "resting on Pa; climbing through Re and Pa as in Kafi; letting Ma go weak",
    neighbours: "Rageshree has shuddha Ga; Bhimpalasi uses Pa freely and rests on Ma and Pa.", fromNotes: true,
    swar: "D. - - - n. - - - S - - - g - - - m - - - - - - - D - - - n - - - S' - - - - - - - n - - - D - - - m - - - - - - - g - - - R - - - S - - - - - - -" },
];

(function () {
  if (typeof PATHS === 'undefined') return;
  for (const p of CN_PATHS) if (!PATHS.some(x => x.id === p.id) && (typeof ALL_RAGAS === 'undefined' || ALL_RAGAS.get(p.raga))) {
    PATHS.push(p);
    EXERCISES.push(...pathLessons(p));
    EXERCISES.push({ id: `${p.id}-swar`, track: p.id, raga: p.raga, check: true, composed: true, cn: 'others', stage: 'swar', level: 2,
      name: `${p.name}'s notes against the drone`, minutes: 4, taal: 'Teentaal', bpm: { start: 60, target: 40, step: -4 }, lays: [1],
      purpose: `Every note of ${p.name}, held long against the tanpura, up and down, with its resting notes (${p.nyas}) held longest.`,
      why: 'Before any phrase, each note has to sit still against the drone. Your notes start every badhat this way: Sa alone, then one note at a time.',
      how: ['Tanpura on. Akaar; arrive, settle, then hold at one volume.', 'Then the guide off.'],
      listen: 'Each note still, with no wobble, and the gap between the wide steps exact.', mistakes: `In ${p.name}: ${p.pitfalls}.`,
      harder: 'Slower, so each note is longer; then with the guide off.', notes: () => p.swar });
  }
  for (const [raga, cn] of Object.entries(CLASS_NOTES)) {
    const path = PATHS.find(p => p.id === cn.path);
    if (!path) continue;
    path.method = (CN_METHOD[raga] || {}).method || null;
    path.notesFile = cn.file;
    path.facts = cn.facts;
    path.unclear = [...(cn.unclear || []), ...((cn.jhaptaal && cn.jhaptaal.unclear) || [])];
    const built = cnBuild(raga, cn);
    if (CN_METHOD[raga]) built.push(...cnMethodLessons(raga, CN_METHOD[raga]));
    EXERCISES.push(...built);
    CN_BUILT.push(...built);
    path.unplaced = CN_UNPLACED[raga];
  }
  for (const [raga, o] of Object.entries(CN_OTHERS)) {
    const built = cnOtherLessons(raga, o);
    EXERCISES.push(...built);
    CN_BUILT.push(...built);
  }
})();

if (typeof module !== 'undefined') module.exports = { cnUnits, cnNotes, cnPlace, CLASS_NOTES, CN_UNPLACED, CN_BUILT };
