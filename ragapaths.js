'use strict';
// Raga paths: a lesson path for each raga in the Library, built from that raga's own chalan.
// Edit freely; the Practice view builds itself from this file.
//
// Each path goes in the order a raga is usually learnt:
//   its notes      the raga's swaras as it sings them, held against the drone
//   chalan, nyas   its phrases and the notes it rests on; its phrases sung back
//   badhat         the Library's aalaps for this raga, one at a time, slow, then all of them
//                  as call and answer
//   ornaments      the movements that belong to this raga (its meends, kans, andolan)
//   layakari       its pakad through thah, dugun, tigun and chaugun
//   taans          a palta that keeps the raga's rules, then the Library's taans for it
//
// What is sourced and what isn't:
//   lessons made from Library phrases keep the Library's own source: src 'notation' phrases
//   follow a published notation (from/url), the rhythm set for this app; everything else is
//   composed for this app, Bhimsen-inspired in the Kirana style (composed: true), and marked to
//   check with a teacher. Only one phrase is Bhimsen Joshi's own (Puriya Dhanashree, notated by Ragajunglism
//   from a 1972 recording); the "ulti cells" taans follow Chetan Karnani's description of how he
//   built taans, not his notes.

const PATH_STAGES = [
  { id: 'swar', name: 'Its notes' },
  { id: 'chalan', name: 'Chalan and nyas' },
  { id: 'badhat', name: 'Badhat: aalap' },
  { id: 'orn', name: 'Its ornaments' },
  { id: 'laya', name: 'Layakari' },
  { id: 'taan', name: 'Taans' },
];

// What each raga is, in the few lines a lesson needs. nyas: the notes it rests on.
// pitfalls: what most often makes it sound like something else.
const PATHS = [
  { id: 'p-yaman', raga: 'Yaman', name: 'Yaman',
    character: "Kalyan thaat, evening. Every note shuddha except tivra Ma. It usually begins from below, N̤ R G, and in the ascent Pa is mostly passed over (M D N Ṡ), while the descent uses it.",
    nyas: 'Ga, Ni, Pa (coming down) and Sa',
    pitfalls: "starting S R G instead of N̤ R G; climbing through Pa as in Bilawal; resting on tivra Ma, which is a passing note; tivra Ma sagging toward shuddha Ma",
    neighbours: "Any shuddha Ma turns it toward Yaman Kalyan, which uses one only in G m G R S." },
  { id: 'p-pd', raga: 'Puriya Dhanashree', name: 'Puriya Dhanashree',
    character: "Poorvi thaat, sunset: komal Re and Dha, tivra Ma. Pa is the strongest note and komal Re is prominent; the turn M G M r G is its signature.",
    nyas: 'Pa, Ga and Sa, with komal Re dwelt on',
    pitfalls: "leaving Pa weak (it should be the strongest note); singing the descent straight, P M G r S, instead of M G M r G r S; komal Dha that doesn't lean back to Pa",
    neighbours: "Puriya leaves Pa out and Shree leaps r P; here Pa is central and the ascent goes through Ga." },
  { id: 'p-todi', raga: 'Todi (Miyan ki)', name: 'Todi',
    character: "Todi thaat, morning: komal Re, Ga and Dha, tivra Ma. Ga and Dha are sung with a slow, gentle andolan, Pa is weak, and r g r S is the sigh it keeps coming back to.",
    nyas: 'komal Ga, komal Dha and Sa',
    pitfalls: "resting on Pa; singing g and d straight, at the harmonium's pitch, with no swing; rushing r g r S",
    neighbours: "Gurjari Todi leaves Pa out altogether; Multani has the same notes but leaves r and d out going up." },
  { id: 'p-malkauns', raga: 'Malkauns', name: 'Malkauns',
    character: "Five notes, S g m d n, no Re and no Pa; late night. Ma is the centre: phrases circle back to it, and the notes are joined by heavy meends.",
    nyas: 'Ma, Sa and komal Dha',
    pitfalls: "komal Dha creeping sharp; jumping between notes that should be joined by a slide; drifting toward a Re or Pa in the joins",
    neighbours: "Chandrakauns is the same with shuddha Ni." },
  { id: 'p-darbari', raga: 'Darbari Kanada', name: 'Darbari Kanada',
    character: "Asavari thaat, late night. It lives in the mandra and lower madhya saptak; komal Ga and Dha take a slow, wide andolan, and it comes down by turns: Ṡ d n P, m P g m R S.",
    nyas: 'Re, Pa and Sa, with komal Ga dwelt on in andolan',
    pitfalls: "andolan sung fast, like vibrato; coming down straight, g R S, instead of g m R S; spending the time in the taar saptak",
    neighbours: "Adana has the same notes but lives in the upper half, moves fast and has no andolan." },
  { id: 'p-multani', raga: 'Multani', name: 'Multani',
    character: "Todi thaat, afternoon. It goes up N̤ S g M P N Ṡ, with Re and Dha left out, and comes down with them; Ga is tugged up from Ma, and Re is only grazed on the way to Sa.",
    nyas: 'Pa, Sa and komal Ga',
    pitfalls: "resting on komal Re (it kills the raga); using Re or Dha going up, which makes it Todi; a bare Ga with no pull from Ma",
    neighbours: "Todi has the same notes but uses Re and Dha going up and swings its Ga and Dha." },
];

// Per raga: the composed lessons. Notation as in phrases.js.
const PATH_LESSONS = {
  'Yaman': {
    swar: { name: "Yaman's notes against the drone",
      notes: "S - N. - | S - R - | G - - - | - - - - | M - G - | P - - - | D - N - | - - - - | S' - - - | N - D - | ~P - - - | M ~G - - | R - S - | - - - -",
      purpose: "Each of Yaman's notes held long enough to tune it: Ga and Ni locked to the drone, tivra Ma placed high, just below Pa, and Pa used on the way down.",
      listen: "Ga and Ni locking into the tanpura with no beating; tivra Ma bright and high, never drifting toward shuddha Ma.",
      harder: "Slower; then hold Ga and Ni for a whole vibhag each with the guide off." },
    nyas: { name: 'Where Yaman rests',
      notes: "N. R G - | - - - - | G M D N | - - - - | D N S' - | - - - - | N D P - | - - - - | M G R G | - - - - | ~R - S - | - - - -",
      purpose: "Short phrases that each end on one of Yaman's resting notes, held for a full vibhag: Ga, Ni, taar Sa, Pa on the way down, Ga again, and Sa.",
      listen: "The held note steady for the whole vibhag, and the phrase before it leading into it rather than stopping on it." },
    orn: { name: 'The P to R meend of the pakad',
      notes: "N. R G R | P - - ~~R | - - S - | N. R G - | M D ~P - | - - ~~R - | N. R S - | - - - -",
      purpose: "In Yaman's pakad (N̤ R G R, P R, N̤ R S) the voice slides from Pa down to Re through Ma and Ga without stopping on them. This lesson isolates that slide.",
      listen: "One unbroken slide that lands on Re exactly, with Ma and Ga heard only in passing.",
      mistakes: "Stepping down P M G R as separate notes; overshooting Re and correcting." },
    alankar: { name: 'Yaman palta: N R G cells',
      tokens: "N. R G R  R G M G  G M D M  M D N D  D N S' N  N R' S' -  S' N D P  N D P M  D P M G  P M G R  M G R S",
      purpose: "A four-note palta that keeps Yaman's rules: up from N̤ R G with Pa left out (M D N), down through Pa, ending M G R S." },
  },
  'Puriya Dhanashree': {
    swar: { name: "Puriya Dhanashree's notes against the drone",
      notes: "S - N. - | r - - - | ~S - - - | G - - - | M - G - | P - - - | - - - - | d - - - | ~P - - - | N - - - | S' - - - | r' - ~S' - | N d ~P - | M G M r | G - r - | S - - -",
      purpose: "Komal Re held until it sits low and sure, Ga clean and shuddha, Pa held as the raga's strongest note, and komal Dha leaning back down to Pa.",
      listen: "Pa as solid as Sa; komal Re low enough to sound sad, not just a slightly flat Re.",
      harder: "Slower; then hold Pa and komal Re for a vibhag each with the guide off." },
    nyas: { name: 'Where Puriya Dhanashree rests',
      notes: "N. r G - | - - - - | M P - - | - - - - | M d P - | - - - - | d N S' - | - - - - | r' N d P | - - - - | M G M r | G - - - | r - S - | - - - -",
      purpose: "Phrases ending on Ga, on Pa (twice, from below and from Dha), taar Sa, Pa again from taar Re, and the signature M G M r G before r S.",
      listen: "Pa coming back again and again as the place of rest; the final r S unhurried." },
    orn: { name: 'The P M P murki and M G M r G',
      notes: "P - PMP - | M G M r | G - - - | M d ~P - | PMP M G - | M r G - | r - S - | - - - -",
      purpose: "The quick P M P turn on Pa (it opens Bhimsen Joshi's phrase in the Library) and the M G M r G turn that tells this raga from Shree and Puriya, practised on their own.",
      listen: "The murki light and quick, three notes in one beat, with Pa clearly the note it decorates.",
      mistakes: "A murki so heavy it becomes three separate notes; M G M r G flattened into M G r." },
    alankar: { name: 'Puriya Dhanashree palta',
      tokens: "N. r G r  r G M G  G M P M  M P d P  P d N d  d N S' N  S' N d P  N d P M  d P M G  P M G M  G M r G  r - S -",
      purpose: "A four-note palta through the raga's notes that ends with its own descent, M G M r G r S." },
  },
  'Todi (Miyan ki)': {
    swar: { name: "Todi's notes against the drone",
      notes: "S - - - | r - - - | - - S - | ^g - - - | - - - - | r - S - | M - - - | ^d - - - | - - - - | N - S' - | N - ^d - | M - ^g - | r - S - | - - - -",
      purpose: "Komal Re held low; komal Ga and Dha held long with a slow andolan, the swing that makes Todi; tivra Ma placed high between them.",
      listen: "The andolan slow, about one swing a second, dipping below the note and returning to it; Re low and still.",
      harder: "Slower; then the same with the guide off, keeping the swing even." },
    nyas: { name: 'Where Todi rests',
      notes: "S r ^g - | - - - - | r g M ^d | - - - - | M d N S' | - - - - | N d M ^g | - - - - | r g r S | - - - -",
      purpose: "Todi rests on komal Ga and komal Dha (its samvadi and vadi), each held with andolan, and on Sa after the r g r S sigh. Pa is never a place to stop.",
      listen: "Each nyas note swung slowly for its whole length, and r g r S unhurried." },
    orn: { name: 'Slow andolan on g and d',
      notes: "r - ^g - | - - - - | - - r - | S - - - | M - ^d - | - - - - | - - M - | ^g - r - | S - - - | - - - -",
      purpose: "The same andolan as in the notes lesson, now longer and approached from the notes around it: r to g, M to d, and back.",
      listen: "The swing beginning only once you have arrived on the note, never before.",
      mistakes: "A fast, regular wobble (that is vibrato, not andolan); swinging upward past the note instead of below it." },
    alankar: { name: 'Todi palta, no Pa',
      tokens: "d. N. S r  S r g r  r g M g  g M d M  M d N d  d N S' N  S' N d M  N d M g  d M g r  M g r -  S - - -",
      purpose: "A four-note palta through Todi's notes with Pa left out, as the Library's Todi taans do, ending M g r S." },
  },
  'Malkauns': {
    swar: { name: "Malkauns's notes against the drone",
      notes: "S - - - | n. - ~S - | g - - - | m - - - | - - - - | ~g - S - | d. - n. - | S - - - | m - - - | d - - - | ~m - - - | n - - - | ~d - - - | S' - - - | ~n - d - | ~m - - - | g m ~g - | S - - -",
      purpose: "Five notes, each held: komal Ga and Ma, komal Dha and Ni, with Ma held longest as the centre. Each note falls to the one below by a slide.",
      listen: "Komal Dha low and dark; every slide landing exactly on its note; Ma steady enough to build on.",
      harder: "Slower; then the guide off. With the tanpura on Ma (the app does this for Malkauns), Ma should lock as firmly as Sa." },
    nyas: { name: 'Where Malkauns rests',
      notes: "n. S g m | - - - - | g m d - | - - - - | d n S' - | - - - - | n d m - | - - - - | g m ~g - | S - - - | - - - -",
      purpose: "Ma, komal Dha, taar Sa, Ma again from above, and Sa after the g m g turn. Ma is the note every phrase returns to.",
      listen: "Ma as the centre: everything else feels like it leaves Ma and comes back." },
    orn: { name: 'Malkauns meends: m to g, n to d, d to m',
      notes: "m - - ~~g | - - S - | n - - ~~d | - - m - | d - - ~~m | - - g - | m - ~~g - | ~~S - - - | - - - -",
      purpose: "The slow slides that join Malkauns's notes, each a whole note long: Ma down to Ga, Ni down to Dha, Dha down to Ma, and Ga down to Sa.",
      listen: "The slide itself in tune all the way, arriving on the lower note without a bump.",
      mistakes: "Sliding late, so the note is held and then dropped; overshooting the lower note." },
    alankar: { name: 'Malkauns palta',
      tokens: "n. S g S  S g m g  g m d m  m d n d  d n S' n  S' n d m  n d m g  d m g S  g m g -  S - - -",
      purpose: "A four-note palta through Malkauns's five notes, which with no Re or Pa climbs in wide steps, ending g m g S." },
  },
  'Darbari Kanada': {
    swar: { name: "Darbari's notes against the drone",
      notes: "S - - - | n. - - - | S - R - | ^g - - - | - - - - | m - R - | S - - - | P. - - - | ^d. - - - | - - n. - | S - - - | - - - -",
      purpose: "Re, Pa and Sa held still; komal Ga, and komal Dha in the mandra, held long with Darbari's slow, wide andolan.",
      listen: "The andolan heavy and slow, dipping well below the note; Re and Sa calm and still around it.",
      harder: "Slower; then the guide off. Sing it quietly, low in the voice." },
    nyas: { name: 'Where Darbari rests',
      notes: "S R ^g - | - - m R | - - - - | m P - - | - - - - | ^d - n P | - - - - | m P ^g - | m R - - | S - - - | - - - -",
      purpose: "Re after g m R, Pa from below and again after d n P, and Sa after the full m P g m R S. Ga is dwelt on in andolan but always resolves through Ma to Re.",
      listen: "g m R S, never g R S; and the andolit Ga held long before it moves." },
    orn: { name: 'The Kanada turns: d n P and g m R',
      notes: "m P ^d n | ~P - - - | m P ^g m | R - S - | n. S R ^g | - m R S | - - - -",
      purpose: "The two turns that make Kanada: Dha in andolan turning through Ni to slide down to Pa, and Ga in andolan going up to Ma before it falls to Re.",
      listen: "The slide from Ni to Pa unhurried; Ma touched lightly before Re.",
      mistakes: "Going straight from Dha to Pa, or from Ga to Re: the turn is the raga." },
    alankar: { name: 'Darbari taan cells',
      tokens: "n. S R g  m R S -  R g m P  g m R S  m P d n  S' d n P  m P g m  R - S -",
      purpose: "Four-note cells that each come down the Darbari way (g m R S, Ṡ d n P, m P g m) rather than straight.", },
  },
  'Multani': {
    swar: { name: "Multani's notes against the drone",
      notes: "S - - - | N. - S - | g - - - | - - - - | M - - - | P - - - | - - - - | N - - - | S' - - - | N - d - | P - - - | M - g - | (S)r S - - | - - - -",
      purpose: "Komal Ga, tivra Ma, Pa and Ni held to tune them; komal Dha and Re only met on the way down, Re just grazed before Sa.",
      listen: "Pa as solid as Sa; komal Ga low and clear; Re so brief you hardly hear it.",
      harder: "Slower; then the guide off." },
    nyas: { name: 'Where Multani rests',
      notes: "N. S g - | - - - - | M P - - | - - - - | M P N S' | - - - - | N d P - | - - - - | M g - - | (S)r S - - | - - - -",
      purpose: "Ga reached from mandra Ni, Pa (the vadi) twice, taar Sa, and Sa itself, with Re only touched on the way.",
      listen: "Pa coming back as the place of rest; Re never held." },
    orn: { name: 'Ga pulled from Ma, Re only grazed',
      notes: "N. S (M)g - | - - - - | M P (M)g - | - - - - | M g (S)r S | - - - - | N. S (M)g M | P - - - | M P (M)g - | (S)r(N.)S - - | - - - -",
      purpose: "Multani's Ga is tugged up from Ma (a kan of Ma before it), and Re is passed through with a touch of Sa on the way down, as in Parrikar's notation in the Library.",
      listen: "The kan quick, a flick of Ma at the start of Ga, not a separate note.",
      mistakes: "Turning the kan into M g as two notes; letting Re sit for even a moment." },
    alankar: { name: 'Multani palta',
      tokens: "N. S g S  S g M g  g M P M  M P N P  P N S' N  S' N d P  N d P M  d P M g  P M g r  M g r -  S - - -",
      purpose: "A four-note palta that leaves Re and Dha out going up and uses them coming down, ending M g r S with Re only passed through." },
  },
};

// Bhimsen-inspired (Kirana style): one long aalap with sweeping meends and held nyas, and one fast
// sapaat that turns once before landing on sam. Composed for this app, not transcribed.
const PATH_BJ = {
  'Yaman': { aalapName: 'A sweep down from taar Re',
    aalap: "N. R G - | - - - - | M D N - | S' - - - | - - - - | R' - ~~S' - | N - D - | ~~P - - - | M - ~~G - | - - - - | R - ~~S - | - - - -",
    taan: "N.RGM DNS'R' G'R'S'N DPMG RGMD NS'ND PMGR S" },
  'Puriya Dhanashree': { aalapName: 'Taar Re falling to Pa',
    aalap: "N. r G - | M P - - | - - - - | d N S' - | r' - ~~N - | d - ~~P - | - - - - | M G M ~~r | G - - - | r - S - | - - - -",
    taan: "N.rGM PdNS' r'G'r'S' NdPM GMrG MPdN S'NdP MGMr G-r- S" },
  'Todi (Miyan ki)': { aalapName: 'Komal Dha to taar Re and home',
    aalap: "d. N. S r | ^g - - - | - - - - | r g M ^d | - - - - | N S' - - | r' - ~~S' - | N - ^d - | M - ~~g - | r g r S | - - - -",
    taan: "N.Srg MdNS' r'g'r'S' NdMg rgMd NS'Nd Mgr- S" },
  'Malkauns': { aalapName: 'Meend by meend from taar Ga',
    aalap: "n. S g m | - - - - | d - ~~m - | n - ~~d - | S' - - - | g' - ~~S' - | n - ~~d - | m - ~~g - | ~~S - - - | - - - -",
    taan: "n.Sgm dnS'g' m'g'S'n dmgm gmdn S'ndm gmg- S" },
  'Darbari Kanada': { aalapName: 'Deep in the mandra',
    aalap: 'S - n. - | P. - ^d. - | - n. ~~P. - | m. P. ^d. n. | S - - - | R ^g - - | - - m R | S - - - | - - - -',
    taan: "n.SRg mRSn. SRgm PgmR mPdn S'dnP mPgm R S" },
  'Multani': { aalapName: 'Pa to taar Sa and the long way down',
    aalap: "N. S (M)g - | - - - - | M P - - | N S' - - | - - - - | N d ~~P - | M - (M)g - | - - - - | (S)r S - - | - - - -",
    taan: "N.SgM PNS'g' r'S'Nd PMgM gMPN S'NdP Mgr- S" },
};

// your turn: the same notation with every note outlined (shown and timed, not played)
function yourTurn(notes) {
  return notes.split(/\s+/).map(t => t === '|' ? t : t.replace(/(\([^)]*\))|([SrRgGmMPdDnN])/g, (m, kan, n) => kan || '?' + n)).join(' ');
}

const PATH_KIND = {
  aalap: { stage: 'badhat', taal: 'Ektaal', minutes: 4 },
  sapaat: { stage: 'taan', taal: 'Teentaal', minutes: 3 },
  vakra: { stage: 'taan', taal: 'Teentaal', minutes: 4 },
  gamak: { stage: 'taan', taal: 'Teentaal', minutes: 3 },
  chhut: { stage: 'taan', taal: 'Teentaal', minutes: 3 },
  tihai: { stage: 'taan', taal: 'Teentaal', minutes: 3 },
};
// the Library's levels 1-3 sit at Building to Advanced here
const libLevel = p => Math.min(4, (p.level || 1) + 1);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function pathLessons(path) {
  const r = path.raga, L = PATH_LESSONS[r] || {}, out = [];
  const base = { track: path.id, raga: r, check: true };
  const pit = `Usual ways it goes wrong in ${path.name}: ${path.pitfalls}.`;
  const add = o => out.push(Object.assign({}, base, o));

  if (L.swar) add({ id: `${path.id}-swar`, stage: 'swar', level: 2, name: L.swar.name, minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 40, step: -4 }, lays: [1], composed: true,
    purpose: L.swar.purpose,
    how: ['Tanpura on. Akaar, mouth open; one breath for each held note if you can.', 'Arrive on each note, settle, then hold it at one volume. Listen once with the guide, then sing with it.', 'Then guide off: the notes are outlined and timed, you sing them alone.'],
    listen: L.swar.listen, mistakes: pit, harder: L.swar.harder,
    notes: () => L.swar.notes });

  if (L.nyas) add({ id: `${path.id}-nyas`, stage: 'chalan', level: 2, name: L.nyas.name, minutes: 4, taal: 'Teentaal',
    bpm: { start: 56, target: 40, step: -4 }, lays: [1], composed: true,
    purpose: `${L.nyas.purpose} In ${path.name} the resting notes are ${path.nyas}.`,
    how: ['Sing each phrase and hold its last note for the whole vibhag.', 'Breathe in the held note’s last matra, not before it.'],
    listen: L.nyas.listen, mistakes: pit,
    harder: 'Slower, so each rest is longer; then make a phrase of your own that ends on the same note.',
    notes: () => L.nyas.notes });

  // its own pakad and phrases (ragas.js), as call and answer
  add({ id: `${path.id}-echo`, stage: 'chalan', level: 3, name: 'Its phrases: listen, then answer', minutes: 5, taal: 'Teentaal',
    bpm: { start: 60, target: 76, step: 4 }, lays: [1],
    purpose: `The pakad and characteristic phrases of ${path.name}, each played once and then left for you to sing back in the same time.`,
    how: ['Listen to the phrase; in the gap after it, sing it back. Your turn is drawn outlined.'],
    listen: 'Your answer starting on the same matra, one cycle later, with the held notes held.',
    mistakes: pit, harder: 'Sing scoring on, aiming for 80% in tune; then the guide off.',
    seq: c => [c.raga.pakad, ...(c.raga.phrases || [])].filter(Boolean).flatMap(p => {
      const call = ragaSlots(p, c.raga, 1, false);
      while (call.length % 8) call.push('_');
      return X.echo(call);
    }) });

  // the Library's aalaps, one by one, in badhat order
  const lib = typeof PHRASES !== 'undefined' ? PHRASES.filter(p => p.raga === r) : [];
  const aalaps = lib.filter(p => p.kind === 'aalap').sort((a, b) => (a.level || 1) - (b.level || 1));
  aalaps.forEach(p => add(fromPhrase(path, p, pit)));
  const bj = PATH_BJ[r];
  if (bj) add({ id: `${path.id}-bj-aalap`, stage: 'badhat', level: 4, name: `Bhimsen-inspired: ${bj.aalapName}`, minutes: 5, taal: 'Ektaal',
    bpm: { start: 44, target: 30, step: -3 }, lays: [1], composed: true, bhimsen: true,
    purpose: `A long ${path.name} aalap in the manner of Bhimsen Joshi's vilambit: note by note, long held nyas, and slow meends that are most of the note. Resting notes: ${path.nyas}.`,
    how: ['Akaar, full voice but unforced. Each ⌒ is a slow slide: leave the note late and take the whole length to arrive.', 'Breathe only in the held notes’ last matra.', 'Then the guide off, and stretch the held notes longer than written if your breath allows.'],
    listen: 'The slides even and in tune all the way down; the held notes still, with no wobble.',
    mistakes: pit, harder: 'Slower, down to 30 BPM; then sing it a step higher in the saptak, or extend it with a phrase of your own.',
    notes: () => bj.aalap });
  if (aalaps.length > 1) {
    const all = aalaps.map(p => `${p.notes} | _ | ${yourTurn(p.notes)} | _ _`).join(' | ');
    add({ id: `${path.id}-badhat-echo`, stage: 'badhat', level: 4, name: 'The whole badhat, call and answer', minutes: 8, taal: 'Ektaal',
      bpm: { start: 48, target: 36, step: -3 }, lays: [1],
      purpose: `All ${aalaps.length} of the Library's ${path.name} aalaps in order, from the lowest to the taar saptak, each played and then left for you to sing back: the raga unfolded the way a vilambit aalap unfolds it.`,
      how: ['Each aalap is played, then its notes come round again outlined: that is your turn.', 'Keep the akaar open and the held notes full length; the gaps are for breath.'],
      listen: `Each nyas (${path.nyas}) as steady in your answer as in the call.`,
      mistakes: pit, harder: 'Guide off for the whole badhat; then slower.',
      sourced: aalaps.filter(p => p.src === 'notation').length, total: aalaps.length,
      notes: () => all });
  }

  if (L.orn) add({ id: `${path.id}-orn`, stage: 'orn', level: 3, name: L.orn.name, minutes: 4, taal: 'Teentaal',
    bpm: { start: 52, target: 40, step: -4 }, lays: [1], composed: true,
    purpose: L.orn.purpose,
    how: ['Listen with the guide, then sing with it, then alone.', 'Slow first: the ornament is part of the note, so it needs the note’s full length.'],
    listen: L.orn.listen, mistakes: L.orn.mistakes || pit,
    harder: 'Slower, then the guide off; then use the ornament in an aalap of your own.',
    notes: () => L.orn.notes });

  add({ id: `${path.id}-pakad-lay`, stage: 'laya', level: 4, name: 'Its pakad through the layakari', minutes: 5, taal: 'Teentaal',
    bpm: { start: 56, target: 80, step: 4 }, lays: [1, 2, 3, 4], ladder: true, src: ['laya'],
    purpose: `${path.name}'s pakad with its resting notes, in thah, dugun, tigun and chaugun one after another. At speed it must still be ${path.name}, not a scale run.`,
    how: ['Ladder: each speed fills the same time, so the pakad comes once in thah, twice in dugun, three times in tigun and four in chaugun.'],
    listen: 'The held notes still there, shorter, at chaugun.',
    mistakes: pit, harder: 'Guide off; then the same with one of its other phrases.',
    seq: c => ragaSlots(c.raga.pakad || c.raga.aaroh, c.raga, 1) });

  if (L.alankar) add({ id: `${path.id}-palta`, stage: 'taan', level: 3, name: L.alankar.name, minutes: 4, taal: 'Teentaal',
    bpm: { start: 60, target: 100, step: 4 }, lays: [2, 4], ladder: true, composed: true,
    purpose: L.alankar.purpose,
    how: ['Dugun first, then chaugun (or the ladder). Each cell of four is one matra in chaugun.'],
    listen: 'The notes it leaves out still left out at speed; the ending phrase as clear as in a slow aalap.',
    mistakes: pit, harder: 'Faster; guide off; then make up the next cell yourself.',
    seq: () => L.alankar.tokens.split(/\s+/).filter(Boolean) });

  if (bj) add({ id: `${path.id}-bj-taan`, stage: 'taan', level: 4, name: 'Bhimsen-inspired: a fast sapaat that turns', minutes: 4, taal: 'Teentaal',
    bpm: { start: 72, target: 108, step: 4 }, lays: [1], lands: 'sam', composed: true, bhimsen: true,
    purpose: `A fast ${path.name} taan in the manner of Bhimsen Joshi's drut taans: straight up to the taar saptak, a turn, a second climb, and down to Sa on sam, keeping the raga's skipped notes and its closing phrase.`,
    how: ['Four notes a matra; start where the graph shows so the last Sa falls on sam.', 'Take a full breath before it: it is one line.'],
    listen: 'All four notes of every matra there at speed, and the closing phrase as clear as in the aalap.',
    mistakes: pit, harder: 'Faster, 4 BPM at a time toward 108; then the guide off.',
    notes: () => bj.taan });
  const order = ['sapaat', 'vakra', 'gamak', 'chhut', 'tihai'];
  lib.filter(p => p.kind !== 'aalap').sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.level || 1) - (b.level || 1))
    .forEach(p => add(fromPhrase(path, p, pit)));
  return out;
}

// A Library phrase as a lesson: its own notes, with a tempo plan and what to listen for.
function fromPhrase(path, p, pit) {
  const k = PATH_KIND[p.kind] || PATH_KIND.vakra, aalap = p.kind === 'aalap';
  const kindName = (typeof KINDS !== 'undefined' && (KINDS.find(x => x.id === p.kind) || {}).name) || p.kind;
  const bpm = aalap ? { start: p.bpm || 50, target: Math.max(30, (p.bpm || 50) - 15), step: -3 }
    : { start: p.bpm || 70, target: (p.bpm || 70) + (p.gamak ? 24 : 36), step: 4 };
  const how = aalap
    ? ['Akaar, mouth open. Listen once with the guide, then sing with it.', 'Hold every long note its full length: the held notes are where the raga rests. Meends start late and arrive exactly.', 'Then the guide off: the notes are outlined, you sing them alone over tanpura and tabla.']
    : [`${kindName}: sing it at the start tempo until every note is there, then raise it.`, p.lands === 'sam' ? 'It is placed so the last note falls on sam: start where the graph shows and land with the tabla.' : 'It starts on sam.', p.gamak ? 'Every note is shaken from the note above: from the chest, not the throat.' : 'Keep the vowel open and the notes even.'];
  return {
    id: `${path.id}-lib-${slug(p.kind)}-${slug(p.name)}`, track: path.id, raga: path.raga, stage: k.stage,
    level: libLevel(p), name: p.name, minutes: k.minutes, taal: k.taal, bpm, lays: [1],
    lands: p.lands, gamak: !!p.gamak, kind: p.kind, fromLib: true,
    purpose: p.why,
    how,
    listen: aalap ? `The held notes locked to the drone; in ${path.name} they are ${path.nyas}.` : 'Every note distinct at speed, and the raga still recognisable in the turns.',
    mistakes: pit,
    harder: aalap ? `Slower (down to ${bpm.target} BPM), then the guide off; then sing a phrase of your own that ends on the same note.` : `Faster, ${bpm.step} BPM at a time toward ${bpm.target}; then the guide off.`,
    from: p.src === 'notation' ? p.from : null, url: p.src === 'notation' ? p.url : null, srcNote: p.srcNote || null,
    ref: p.ref || null, composed: p.src !== 'notation', check: !!p.check,
    notes: () => p.notes,
  };
}

for (const path of PATHS) {
  if (typeof ALL_RAGAS !== 'undefined' && !ALL_RAGAS.get(path.raga)) continue;
  EXERCISES.push(...pathLessons(path));
}

if (typeof module !== 'undefined') module.exports = { PATHS, PATH_STAGES, PATH_LESSONS, yourTurn };
