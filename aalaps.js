'use strict';
/* global CLASS_NOTES, cnNotes, PATHS, ALL_RAGAS */
// Full aalaps, as scores: every step of a raga's badhat in order, grouped in the stages it moves
// through, to play straight through or to take apart (one step, one stage, any stretch, looped).
//
// The four ragas of the class notes use the notes' own aalap steps, in their order, with the
// stages the path lessons already name. The other five are composed for this app: a complete
// badhat each, Bhimsen-inspired in the Kirana manner (one new note at a time, each held as a nyas
// before the voice is allowed further, taar Sa withheld until late, then a slow way home).
//
// Notation as in phrases.js: one token a matra; "-" holds; "_" is a breath; ~~X a slow meend into
// X; ^X an andolan; (X)Y touches X before Y. A breath is added between steps when they are joined.

const COMPOSED_AALAPS = {
  'Puriya Dhanashree': {
    stages: [
      { name: 'Sa and the mandra', why: 'Sa first, then the mandra Ni, Dha and Pa below it: the range the raga will come home to.',
        steps: ['S - - - - - N. - - - S - - - - -', 'N. ~d. - - - P. - - - M. d. N. - - - S - - - - -'] },
      { name: 'Komal Re, dwelt on', why: 'Re is the note this raga lingers on that most ragas pass through. It is held before Ga is allowed in, and Ga is reached from it, N̤ r G.',
        steps: ['N. ~r - - - - - S - - - N. r - - - - - S - - - - -', 'N. r G - - - - - r - - - S - - - - -', 'N. r G - - - r G r - - - - - S - - - N. r S - - - - -'] },
      { name: 'Tivra Ma: the turn M G M r G', why: 'Ma comes in only to turn back: M G M r G, the signature, ends on a held Ga. Step 7 is the first time the turn is sung whole.',
        steps: ['N. r G M - - - - - G - - - r G - - - - -', 'G M - - - - - M G M r G - - - - - - - r S - - - - -'] },
      { name: 'Pa, the strongest note', why: 'Pa is held longer than anything so far: it is the raga\'s centre of gravity. Every step still comes back through the turn to Ga.',
        steps: ['N. r G M P - - - - - - - - - M G M r G - - - - -', 'G M P - - - M P - - - - - - - M G M r G - r S - - - - -'] },
      { name: 'Komal Dha, leaning back to Pa', why: 'Dha is approached from Ma and leans back onto Pa (M d P), never left hanging.',
        steps: ['M ~d - - - P - - - - - - - M G M r G - - - - -', 'G M d - - - M d P - - - - - - - M d - - - ~P - - - - -'] },
      { name: 'Ni, and up to taar Sa', why: 'Ni climbs from Dha (M d N) and falls back to Pa. Taar Sa is held back until step 14, so the climb is felt.',
        steps: ['M d N - - - - - d P - - - - - M G M r G - - - - -', 'P d N - - - d N - - - - - r\' N d P - - - - -', 'M d N S\' - - - - - - - - - N d P - - - - -'] },
      { name: 'The taar saptak', why: 'The lower phrases an octave up: taar Re dwelt on, taar Ga reached from it, the turn on Ga in the upper octave, then the first long fall to Ga.',
        steps: ['N r\' - - - - - S\' - - - N r\' G\' - - - r\' - - S\' - - - - -', 'N r\' G\' M\' G\' - - - - - r\' G\' - - - r\' S\' - - - - -', 'S\' r\' N d P - - - - - M d P - - - M G M r G - - - - -'] },
      { name: 'Home', why: 'Down through the turn to Sa, a last visit to the mandra, and the whole raga in one breath.',
        steps: ['P M G M r G - - - r - - S - - - N. r S - - - - -', 'N. d. P. - - - M. d. N. r - - G - - - r S - - - - -', 'N. r G M P d P M G M r G r S - - - - - - -'] },
    ],
  },
  'Todi (Miyan ki)': {
    stages: [
      { name: 'Sa and the mandra', why: 'Sa, then the mandra komal Dha in its slow swing and Ni just below Sa. Todi opens downward.',
        steps: ['S - - - - - ^d. - - - N. - - S - - - - -', 'd. N. S - - - - - N. ^d. - - - - - N. S - - - - -'] },
      { name: 'Komal Re: the sigh r S', why: 'Re is sung low and close to Sa and falls back to it: the sigh the whole raga keeps returning to.',
        steps: ['S r - - - - - S - - - N. S r - - - S - - - - -'] },
      { name: 'Komal Ga, in andolan', why: 'Ga is held in a slow andolan, never at the harmonium\'s pitch, and released through Re: r g r S.',
        steps: ['S r ^g - - - - - - - r - - - S - - - - -', 'N. S r ^g - - - r ^g r - - - S - - - - -', 'r ^g - - - - - - - r ^g r S - - - ^d. N. S - - - - -'] },
      { name: 'Tivra Ma', why: 'Ma is a step up from Ga and a reason to come back to it (g M g). It is not a resting note.',
        steps: ['r ^g M - - - - - ^g - - - r ^g r S - - - - -', '^g M ^g - - - - - M - - - ^g - r - S - - - - -'] },
      { name: 'Komal Dha, in andolan', why: 'Dha takes the same slow swing as Ga. Pa is only touched, once, from Dha (M d P): it stays weak.',
        steps: ['M ^d - - - - - - - M ^g - - - r ^g r S - - - - -', '^g M ^d - - - M ^d - - - - - M ^g - - - - -', 'M ^d P - - - - - M ^d M ^g - - - r ^g r S - - - - -'] },
      { name: 'Shuddha Ni, up to taar Sa', why: 'Ni is the only bright note. It leans on Dha below it, and the climb M d N Ṡ arrives at taar Sa only in step 14.',
        steps: ['M ^d N - - - - - ^d - - - M ^g - - - - -', '^g M ^d N - - - ^d N ^d - - - M ^g - - - r S - - - - -', 'M ^d N S\' - - - - - - - N ^d - - - - - M ^g - - - - -'] },
      { name: 'The taar saptak', why: 'Taar Re and the swinging taar Ga, then the turn round taar Ga with Ma, and down through Ni and Dha.',
        steps: ['^d N S\' r\' - - - - - S\' - - - N ^d - - - - -', 'N S\' r\' ^g\' - - - - - - - r\' ^g\' r\' S\' - - - - -', 'S\' r\' ^g\' M\' ^g\' - - - r\' - S\' - - N ^d - - - - -'] },
      { name: 'Home: d M g r g r S', why: 'Down past Pa without resting on it, then d M g and the sigh r g r S, and the whole raga in one breath.',
        steps: ['S\' N ^d P - - - M ^d M ^g - - - - -', '^d M ^g - - - r ^g r - - S - - - - -', '^d. N. S r ^g M ^d N S\' - - - N ^d P M ^g r S - - - - - - -'] },
    ],
  },
  'Malkauns': {
    stages: [
      { name: 'Sa and the mandra', why: 'Sa, then down to komal Ni and Dha by meend and back. Malkauns joins its notes by slides from the very first step.',
        steps: ['S - - - - - n. - - - ~~S - - - - -', 'n. ~~d. - - - - - m. d. n. - - - ~~S - - - - -', 'd. n. S - - - n. ~~d. - - - ~~m. - - - d. n. S - - - - -'] },
      { name: 'Komal Ga', why: 'Ga is reached from n̤ S and slides back to Sa: the first step above Sa, with no Re to lean on.',
        steps: ['n. S g - - - - - ~~S - - - - -', 'S g - - - S n. S g - - - - - ~~n. S - - - - -'] },
      { name: 'Ma, the centre', why: 'Ma is held long and the voice keeps returning to it (g m g ~m). From here on, phrases fold back to Ma as often as to Sa.',
        steps: ['n. S g m - - - - - - - ~~g - - - S - - - - -', 'g m - - - g ~~m - - - - - g S - - - n. S g ~~m - - - - -', 'S g m g ~~m - - - - - m g ~~S - - - - -'] },
      { name: 'Komal Dha', why: 'Dha is approached from Ma and slides back to it. Keep it low: a sharp Dha is the commonest fault.',
        steps: ['g m d - - - - - ~~m - - - g ~~m - - - - -', 'm d - - - m ~~d - - - - - ~~m - g m ~~g - S - - - - -'] },
      { name: 'Komal Ni', why: 'Ni opens the upper tetrachord and falls by meend through Dha to Ma.',
        steps: ['m d n - - - - - ~~d - - - ~~m - - - - -', 'g m d n - - - d n ~~d - - - m d ~~m - - - g ~~S - - - - -'] },
      { name: 'Taar Sa', why: 'The arrival, m d n Ṡ, held long, then n d m: the same fall that closes the madhya phrases.',
        steps: ['m d n S\' - - - - - - - n ~~d - - - ~~m - - - - -', 'd n S\' - - - n S\' g\' - - - ~~S\' - - - n ~~d - - - - -'] },
      { name: 'The taar saptak', why: 'Taar Ga and Ma, the madhya shapes an octave up, with taar Dha as the peak; then the long fall back to Ma.',
        steps: ['n S\' g\' m\' - - - - - ~~g\' - - - ~~S\' - - - - -', 'g\' m\' - - - g\' m\' d\' - - - ~~m\' - - - ~~g\' - S\' - - - - -', 'S\' n d m - - - - - g m d ~~m - - - - -'] },
      { name: 'Home', why: 'Ma to Sa, a last look into the mandra, and the whole raga in one breath.',
        steps: ['m d n d ~~m - - - g ~~m g S - - - - -', 'n. S g m - - - g ~~S - - - n. ~~d. - - - n. S - - - - -', 'd. n. S g m d n S\' - - - n d m g S - - - - - - -'] },
    ],
  },
  'Darbari Kanada': {
    stages: [
      { name: 'Sa and the mandra', why: 'Darbari lives low. Before anything above Sa, the voice settles in the mandra: n̤ P̤, m̤ P̤ ḍ n̤ P̤, the vakra turn it keeps for the whole aalap.',
        steps: ['S - - - - - n. - - - S - - - - -', 'S n. - - - P. - - - - - m. P. ^d. - - - - - n. P. - - - - -', '^d. - - - n. S - - - R - - n. S - - - - -'] },
      { name: 'Re', why: 'Re is a resting note here: held, and answered by n̤ S.',
        steps: ['n. S R - - - - - S - - - n. S - - - - -', '^d. n. S R - - - - - S R n. S - - - - -'] },
      { name: 'Komal Ga, in slow andolan', why: 'Ga swings slowly and widely, about once a second, and never falls straight to Re: it goes through Ma, g m R S.',
        steps: ['S R ^g - - - - - - - m R S - - - - -', 'n. S R ^g - - - - - m R - - - ^g - - - - - m R S - - - - -'] },
      { name: 'Ma and Pa', why: 'Pa is the second resting note. Coming down, Pa goes to Ga, and Ga back through Ma to Re: m P g m R S.',
        steps: ['R ^g m P - - - - - - - ^g - m R S - - - - -', 'm P - - - ^g - - - m P - - - - - ^g m R S - - - - -'] },
      { name: 'Komal Dha, in andolan', why: 'Dha swings like Ga and turns back through Ni to Pa (d n P), the vakra shape of the mandra now in the madhya.',
        steps: ['m P ^d - - - - - - - n P - - - - -', 'P ^d n P - - - m P ^g - - - m R S - - - - -'] },
      { name: 'Komal Ni, up to taar Sa', why: 'Ni is reached from Pa and leans on Dha. Taar Sa is reached once, from m P d n, and left at once.',
        steps: ['m P n - - - - - ^d - - - n P - - - - -', 'm P ^d n S\' - - - - - - - ^d n P - - - - -'] },
      { name: 'Briefly in the taar saptak', why: 'Two steps only. Darbari doesn\'t stay up here: taar Re and Ga are touched, and the voice comes down.',
        steps: ['n S\' R\' - - - - - S\' - - - ^d n P - - - - -', 'n S\' R\' ^g\' - - - - - m\' R\' S\' - - - ^d n P - - - - -'] },
      { name: 'Down by turns', why: 'Ṡ d n P, m P g m R S: the descent by turns, then back to the mandra where it began, and the whole raga in one breath.',
        steps: ['S\' ^d n P - - - - - m P ^g - - - m R S - - - - -', '^g m R S - - - n. S R - - - n. S - - - - -', 'S n. P. - - - m. P. ^d. - - - n. P. - - - - -', '^d. n. S R ^g - - - m R S - - - - -', 'n. S R ^g m P ^d n S\' - - - ^d n P m P ^g - m R S - - - - - - -'] },
    ],
  },
  'Multani': {
    stages: [
      { name: 'Sa and the mandra', why: 'Sa, the mandra Ni, and mandra Pa. Dha appears only coming down (N̤ ḍ P̤).',
        steps: ['S - - - - - N. - - - S - - - - -', 'N. S - - - P. - - - - - N. - - - S - - - - -', 'P. N. S - - - N. ~d. - - P. - - - N. S - - - - -'] },
      { name: 'Komal Ga, pulled up from Ma', why: 'Ga is touched from Ma above it, (M)g, and Re is only grazed on the way to Sa, (S)r S. Never rest on Re.',
        steps: ['N. S (M)g - - - - - - - (S)r S - - - - -', 'N. S (M)g - - - S N. S (M)g - - - - - (S)r S - - - - -'] },
      { name: 'Tivra Ma', why: 'Ma comes in going up (S g M) and its pull on Ga gets stronger.',
        steps: ['S g M - - - - - (M)g - - - (S)r S - - - - -', 'N. S g M - - - g M (M)g - - - - - (S)r S - - - - -'] },
      { name: 'Pa', why: 'Pa is the main resting note. N̤ S g M P is the ascent, with no Re or Dha going up.',
        steps: ['N. S g M P - - - - - - - M (M)g - - - - -', 'g M P - - - M P - - - - - M (M)g - (S)r S - - - - -'] },
      { name: 'Ni, and Dha coming down', why: 'Ni goes up from Pa; Dha only on the way down, N d P.',
        steps: ['M P N - - - - - d P - - - - -', 'g M P N - - - P N - - - d P - - - M (M)g - - - - -'] },
      { name: 'Taar Sa', why: 'Taar Sa arrives from M P N, held, and falls through Dha to Pa.',
        steps: ['M P N S\' - - - - - - - N d P - - - - -', 'P N S\' - - - N S\' - - - - - N d P - M (M)g - - - - -'] },
      { name: 'The taar saptak', why: 'The madhya phrases an octave up, with taar Pa the peak; Re still only grazed.',
        steps: ['N S\' g\' - - - - - (S\')r\' S\' - - - - -', 'N S\' g\' M\' - - - - - (M\')g\' - - - (S\')r\' S\' - - - - -', 'g\' M\' P\' - - - M\' (M\')g\' - (S\')r\' S\' - - - N d P - - - - -'] },
      { name: 'Home', why: 'Down to Pa, then Ga, then Sa, and the whole raga in one breath.',
        steps: ['S\' N d P - - - - - M (M)g - - - - -', 'P M (M)g - - - - - (S)r S - - - N. S - - - - -', 'N. S g M P - - - M (M)g - (S)r S - - - - -', 'N. S g M P N S\' - - - N d P M (M)g - (S)r S - - - - - - -'] },
    ],
  },
};

// The aalaps, in the order of the raga paths.
// { id, raga, name, src: 'notes'|'composed', file, stages: [{ name, why, steps: [{ n, notes, orig }] }] }
const AALAPS = [];

(function () {
  const pathOf = raga => (typeof PATHS !== 'undefined' ? PATHS.find(p => p.raga === raga) : null);
  const hasRaga = raga => typeof ALL_RAGAS === 'undefined' || ALL_RAGAS.get(raga);
  const fromNotes = [];
  const slug = r => r.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '');
  if (typeof CLASS_NOTES !== 'undefined') {
    for (const [raga, cn] of Object.entries(CLASS_NOTES)) {
      if (!cn.aalap || !cn.aalapGroups || !hasRaga(raga)) continue;
      const path = pathOf(raga);
      fromNotes.push({
        id: `${slug(raga)}-notes`, raga, name: path ? path.name : raga, src: 'notes', file: cn.file,
        stages: cn.aalapGroups.map(g => ({ name: g.name, why: g.why,
          steps: cn.aalap.slice(g.from - 1, g.to).map((s, k) => ({ n: g.from + k, orig: s, notes: cnNotes(s, { aalap: true }).join(' ') })) })),
      });
      if (cn.format) fromNotes.push({
        id: `${slug(raga)}-format`, raga, name: `${path ? path.name : raga}: performance format`, src: 'notes', file: cn.file,
        stages: cn.format.map(part => ({ name: part.mine ? 'Your part' : part.part,
          why: part.mine ? 'Your part of the format: Dha and Ni opened over Ma, ending at the edge of taar Sa (N N → Ṡ).' : part.part === 'Part 1' ? 'The mandra and around Sa, with meends between Ga, Ma and Sa.' : 'From the taar saptak home, in fast strings that lead toward taans.',
          steps: part.steps.map(s => ({ n: s[0], orig: s[1], notes: cnNotes(s[1], { aalap: true }).join(' ') })) })),
      });
    }
  }
  const composed = [];
  for (const [raga, a] of Object.entries(COMPOSED_AALAPS)) {
    if (!hasRaga(raga)) continue;
    const path = pathOf(raga);
    let n = 0;
    composed.push({
      id: `${slug(raga)}-composed`, raga, name: path ? path.name : raga, src: 'composed',
      stages: a.stages.map(st => ({ name: st.name, why: st.why, steps: st.steps.map(s => ({ n: ++n, notes: s })) })),
    });
  }
  // in the order the raga paths are listed
  const order = typeof PATHS !== 'undefined' ? PATHS.map(p => p.raga) : [];
  const rank = a => { const i = order.indexOf(a.raga); return i < 0 ? 99 : i; };
  AALAPS.push(...[...fromNotes, ...composed].map((a, i) => [a, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(x => x[0]));
})();

// every step of an aalap, flat, with its stage
function aalapSteps(a) {
  const out = [];
  a.stages.forEach((st, si) => st.steps.forEach(s => out.push(Object.assign({ stage: si }, s))));
  return out;
}

// steps from..to (indices into aalapSteps), joined with a breath between them, and where each starts
function aalapScore(a, from, to) {
  const steps = aalapSteps(a).slice(from, to + 1);
  const toks = [], marks = [];
  steps.forEach((s, k) => {
    marks.push({ b: toks.length, n: s.n, i: from + k });
    toks.push(...s.notes.trim().split(/\s+/));
    if (k < steps.length - 1 && toks[toks.length - 1] !== '_') toks.push('_');
  });
  return { notes: toks.join(' '), marks };
}

if (typeof module !== 'undefined') module.exports = { COMPOSED_AALAPS, AALAPS, aalapSteps, aalapScore };
