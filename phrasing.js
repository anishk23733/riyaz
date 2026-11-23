'use strict';
// Phrasing: held notes, fast notes and silence inside one phrase.
//
// Written by hand for each raga, phrase by phrase, so that no two phrases put the hold, the burst
// and the break in the same place. Each phrase fills its taal exactly (a cycle, or two in Rupak)
// and is played once, then comes round again outlined for you to sing.
//
// Notation as in phrases.js: one token is one matra; the notes in a token share it, so "S'N" is
// dugun, "MDN" tigun, "GMDN" chaugun, "mGmDNS'" six to a matra. "-" holds the note before it,
// "_" is silence (a whole matra, or part of one: "R_" is Re for half a matra and then nothing,
// "_M" is silence and then Ma half a matra late). ~X slides into X; (X)Y touches X before Y.
//
// Composed for this app in the method of the class notes; not from the notes themselves.

const PHRASING = {
  'Yaman': [
    { name: 'Held, broken, held: Ga and Ni', level: 3, taal: 'Teentaal', bpm: { start: 56, target: 80, step: 4 },
      why: "Your aalap steps hold Ga and Ni as places to rest, and your taans release in runs. Here both happen inside one phrase, and a silence does the work that the next step does in your notes: it leaves a note unresolved for a moment. Every phrase puts its burst and its silence somewhere else, so you can't sing them on autopilot.",
      phrases: [
        { notes: "N. R G - - - - - GMDN DPMG R _ G - - -",
          how: "Ga for six matras; one chaugun burst up to Ni and back; Re; a whole matra of silence; Ga again. The silence is the tension, Ga's return the release." },
        { notes: "_M D N - - - S'N DP MG ~R - - S_ N.R S -",
          how: "Ma comes half a matra late; Ni held as the peak; dugun pairs down to a long Re; Sa cut short, a quick N̤ R, and Sa again. The second Sa is the landing." },
        { notes: "N.RGM DNS'N S' - - - - - NR'S'N DPMG R - _ N.R S -",
          how: "Fast first: two matras of chaugun up to taar Sa, then taar Sa held for six. The same speed brings it down to Re, held; a breath; and N̤ R into Sa." },
        { notes: "G - MDN S'_ R'_ S' N D ~P - MGR G - _ R S",
          how: "A tigun lift into two clipped notes, taar Sa and taar Re, each half a matra with air after it; plain notes down; Pa reached by a slide and held; a tigun turn to Ga, held; silence; R S." },
      ] },
    { name: 'On the Jhaptaal frame: uneven on purpose', level: 4, taal: 'Jhaptaal', bpm: { start: 60, target: 88, step: 4 },
      why: "Your Jhaptaal page raises the density from taan to taan. These phrases change it from matra to matra instead, inside Jhaptaal's 2+3+2+3, and use silence to move the accent: a note struck after a rest sounds stronger than one on the beat. One phrase starts two matras after sam, which is the hardest thing here to count.",
      phrases: [
        { notes: "N.R G - _G MDNS' N - DPMG R S",
          how: "Ga held, then struck again after half a matra of silence (the gap is the accent); a chaugun burst that lands on Ni at khali; one more burst down, and R S." },
        { notes: "S' - - _ N R' S'_ ND ~P -",
          how: "Taar Sa held three matras; a silent matra at the end of the first vibhag; N Ṙ; a clipped Ṡ; a dugun step down and a slide to a long Pa. Starting high and dropping in steps is the release." },
        { notes: "_ _ N.RGM G - - MGRG R_ S -",
          how: "Two silent matras from sam: the phrase starts on matra 3 with a chaugun run into Ga. Ga held across khali, a turn round it, a clipped Re, and Sa held." },
        { notes: "GMDN S'R'G'R' S' - _ NDPM G - (G)R S",
          how: "Two matras of chaugun to taar Ga and back to taar Sa, held; a matra of silence; one burst down to Ga, held; Re touched from Ga, and Sa on the last matra." },
      ] },
  ],

  'Bhinna Shadja': [
    { name: 'Wide steps held, then pressed', level: 3, taal: 'Teentaal', bpm: { start: 56, target: 80, step: 4 },
      why: "With no Re and no Pa every step is wide, so held notes and meends carry the raga, and Ma is its centre. Your bridge taan presses on one note by repeating it off the beat before a run lets go; phrase 3 does that on Dha. Your falling cells (Ṡ - N D, N - D M) step back as they come down; phrase 2 does it in dugun. Silence goes before the note that resolves.",
      phrases: [
        { notes: "S - - G m - - - mGmD m - _ G ~S - -",
          how: "Sa, then Ma through Ga, held four matras; a chaugun turn round Ma (m G m D) back to Ma; a silent matra; Ga sliding down to Sa." },
        { notes: "G m D N S' - - - _ S'N DN Dm G m - -",
          how: "One note a matra up to taar Sa, held; a silent matra on khali; dugun pairs that each step back (Ṡ N, D N, D m), as your falling cells do; G and Ma held." },
        { notes: "D - D _D D - _D DD DNS'N DmGm m - - _ G S",
          how: "Dha pressed: held, struck again, struck off the beat, held, off the beat, twice fast. Then two matras of chaugun let go down to Ma, held; a breath; G S." },
        { notes: "_ SGm DNS' N - - D_ m_ G_ S - - GmDN S' - -",
          how: "One matra late, two tigun runs up to Ni, held; three clipped notes coming down (D, m, G, each half a matra with air after it); Sa held; one chaugun run back up to taar Sa." },
      ] },
    { name: 'Vilambit with sudden runs', level: 4, taal: 'Ektaal', bpm: { start: 44, target: 62, step: 3 },
      why: "Your performance format is slow and held, with meends between the five notes. These phrases keep that, then break it with one fast figure each: six notes to a matra, a fall in chaugun, a shake stepped down a note a matra. In slow Ektaal a matra of silence is long, so it has to be held in the count, not just waited out.",
      phrases: [
        { notes: "S - - G ~m - - - mGmDNS' _ G ~S",
          how: "Sa, Ga and a slide up to Ma, held four matras; a six-note flick from Ma to taar Sa; silence; Ga sliding home to Sa. The flick is a sudden brightness and the silence lets it hang." },
        { notes: "m - D - N - - - S'NDm GmGS _ D.N.S",
          how: "Ma to Ni in held steps, Ni held three matras; two matras of chaugun pour down to Sa; a silent matra; a tigun pickup from the mandra into Sa." },
        { notes: "S' - - - - - _ S' NS'NS' DNDN mDmD GmS-",
          how: "Taar Sa held six matras; a matra of silence; Ṡ struck again; then the same shake (Ṡ N Ṡ N, D N D N, m D m D) moved down a note each matra, and G m S home. The long hold builds weight; the stepped shake spends it." },
        { notes: "G m G - _ GmDN S' - - S'NDm GmG- S",
          how: "Ga, Ma, Ga held; a silent matra; a chaugun run lands on taar Sa, held three matras; the mirror run brings it down; G m G and Sa on the last matra." },
      ] },
  ],

  'Patdeep': [
    { name: 'Rest on Pa, glide to Dha', level: 3, taal: 'Teentaal', bpm: { start: 56, target: 80, step: 4 },
      why: "Your nuances say Patdeep rests on Pa and holds Dha, reached by a glide from Ni. Each phrase gets there differently: after a long hold, after a burst round taar Sa, after a climb sung entirely off the beat, after zigzag pairs. Going up it leaves Re and Dha out; only the way down uses them.",
      phrases: [
        { notes: "N. S g - m P - - - - _ PN S'N ~D - P",
          how: "Up to Pa and held five matras; a silent matra; a dugun lift to taar Sa and back to Ni; the glide down to Dha, held; Pa on the last matra: your nuance in small." },
        { notes: "m P N S' - - S'R'S'N ~D - P PmgR S - - _ N.S",
          how: "Taar Sa held three matras; a chaugun turn round it ending on Ni; Ni gliding to a held Dha and on to Pa; one more chaugun matra down to Sa, held; a breath; a quick N̤ S." },
        { notes: "_g m_ _P N_ _S' - - - - N ~D - - P mg RS",
          how: "The climb is all off the beat: Ga late, Ma clipped, Pa late, Ni clipped, taar Sa late and then held. The way down is on the beat and slow: N, a long Dha, Pa, and dugun to Sa. Displaced going up, steady coming down." },
        { notes: "S'N DP mP gm PN S'R' S' - - _ S'R'S'N ~D - - P -",
          how: "Zigzag pairs from taar Sa down to Ga and back up to taar Re, all dugun; taar Sa held; a silent matra; a chaugun turn and the glide to Dha, held three matras; Pa held." },
      ] },
    { name: 'Slow Ektaal, Pa as home', level: 4, taal: 'Ektaal', bpm: { start: 44, target: 62, step: 3 },
      why: "Your step 20 grows a run backwards toward Pa, and your aalap holds Pa as the goal. In slow Ektaal these phrases set a held Pa or taar Sa against short runs at different speeds, with silence cut into the middle of a matra (R, a third of a matra of nothing, S) as well as between matras.",
      phrases: [
        { notes: "N. S g - _ m P - - PNS'N DPmg R_S",
          how: "Komal Ga held and cut off; Ma and Pa held; a chaugun matra to taar Sa and back; another down to Ga; then Re, a third of a matra of silence, and Sa." },
        { notes: "P - - - - - _ PNS'R' S'_ N_ ~D P",
          how: "Pa held six matras, which in Patdeep is home; a silent matra; a burst to taar Re; taar Sa and Ni each clipped; the glide to Dha, and Pa." },
        { notes: "S'NDP mgRS N.S gm P - - _ gmPN S' S'N ~D-P-",
          how: "Fast first: two chaugun matras from taar Sa down to Sa, then dugun back up to Pa, held; silence; a chaugun run to taar Sa; Ṡ N, and the glide to Dha falling to Pa in the last matra." },
        { notes: "g - - _ mPN S' - _S' N ~D - P",
          how: "Komal Ga held; a matra of silence; a tigun lift to taar Sa, held; Ṡ struck again half a matra late; Ni; Dha held; Pa." },
      ] },
  ],

  'Bageshree': [
    { name: 'Ma as the centre, in Rupak', level: 3, taal: 'Rupak', bpm: { start: 60, target: 88, step: 4 },
      why: "Your Bageshri steps make Ma the place to rest and land on it from every side. These phrases do that in Rupak, whose cycle starts on khali, so there is no heavy downbeat to lean on: the weight has to come from where you hold and where you stop. Pa is only flicked on the way down, as in your step 8 to 11. Each phrase is two cycles, 14 matras.",
      phrases: [
        { notes: "n. S g m - - - mDnD m - _ gm R S",
          how: "Sa to Ma through komal Ga, Ma held four matras; a chaugun turn up to komal Ni and back; Ma again; a silent matra; then g m R S." },
        { notes: "D n S' - - _ S'n D_ m_ D - m - -",
          how: "Dha, komal Ni, taar Sa held; silence; a dugun fall and two clipped notes, Dha and Ma; then Dha held and Ma held to the end: the phrase rests on Ma, not Sa." },
        { notes: "_ Sg mD nS' - - nDm g_ m - - _ D.n.S -",
          how: "A matra late; dugun up to taar Sa, held; a tigun fall to Ma; a clipped Ga; Ma held; silence; a tigun pickup from mandra Dha to Sa." },
        { notes: "S' - - nD (D)P_ m - - _ gmDn S' nDmg m -",
          how: "Taar Sa held; Ni and Dha in dugun; Pa only flicked (half a matra, touched from Dha) and gone; Ma held; silence; a chaugun run to taar Sa and a chaugun fall back to Ma." },
      ] },
    { name: 'Pressure on Ma, released upward', level: 4, taal: 'Teentaal', bpm: { start: 56, target: 84, step: 4 },
      why: "Your bridge taan in Bhinna Shadja presses on one note before it lets go. In Bageshri the note to press is Ma, and the release can go up as well as down. The speeds change every matra or two, and each phrase puts its silence in a different place: after the pressure, after a long taar Sa, in the middle, and at the very start.",
      phrases: [
        { notes: "m _m m _m mm _ mDnS' D - m - - gm R S -",
          how: "Ma struck five times, on and off the beat, then a silent matra: pressure on the centre. The release goes up: a chaugun run to taar Sa, Dha held, Ma held, and g m R S." },
        { notes: "S' - - - - _ S'nS'D nDnm DmDg m - - - _ gR S",
          how: "Taar Sa held five matras; a breath; a rolling chaugun descent (Ṡ n Ṡ D, n D n m, D m D g) that lands on Ma for four matras; a breath; g R and Sa." },
        { notes: "D.n.S gmD - nS' nS'D m - - _ SgmD nDm g_ m - gR S",
          how: "The speed changes every matra or two: tigun from the mandra, Dha held, dugun and tigun to Ma, held; a breath; chaugun, tigun, a clipped Ga, Ma held, and down." },
        { notes: "_ _ _ m D n S' - _n S'R'S'n D - (D)P_ m - -",
          how: "Three silent matras, then a plain one-note-a-matra climb to taar Sa, held; Ni half a matra late; a chaugun turn round taar Sa; Dha held; Pa flicked; Ma to the end." },
      ] },
  ],
};

function phrasingLessons(path, list) {
  return list.map((l, k) => {
    const toks = l.phrases.flatMap(p => {
      const call = p.notes.split(/\s+/);
      return [...call, ...yourTurn(call.join(' ')).split(' ')];
    });
    return {
      id: `${path.id}-ph-${k + 1}`, track: path.id, raga: path.raga, stage: 'phrase', level: l.level,
      cn: 'method', composed: true, check: true,
      name: l.name, minutes: 5, taal: l.taal, bpm: l.bpm, lays: [1],
      purpose: `${l.phrases.length} ${path.name} phrases, each mixing held notes, fast notes and silence in its own way. Each is played, then comes round again outlined: that turn is yours.`,
      why: l.why,
      how: ['A dash holds the note; silence is a gap in the line on the graph. Stop the sound exactly, keep the count going, and come in exactly.',
        ...l.phrases.map((p, i) => `${i + 1}. ${p.how}`)],
      listen: 'The held notes still and full length; every note of the fast matras there; the silences clean, with the next note exactly on its place.',
      mistakes: `Cutting a held note short to get ready for the run; filling a silence with breath noise or a slide; coming in early after a rest. In ${path.name}: ${path.pitfalls}.`,
      harder: 'Faster, 4 BPM at a time (the runs get harder, the holds no easier); then the guide off; then sing each phrase twice, changing where the silence falls the second time.',
      phraseCount: l.phrases.length,
      notes: () => toks.join(' '),
    };
  });
}

(function () {
  if (typeof PATHS === 'undefined') return;
  if (typeof PATH_STAGES !== 'undefined' && !PATH_STAGES.some(s => s.id === 'phrase')) {
    const at = PATH_STAGES.findIndex(s => s.id === 'laya');
    PATH_STAGES.splice(at < 0 ? PATH_STAGES.length : at, 0, { id: 'phrase', name: 'Phrasing: held, fast, silent' });
  }
  for (const [raga, list] of Object.entries(PHRASING)) {
    const path = PATHS.find(p => p.raga === raga);
    if (path) EXERCISES.push(...phrasingLessons(path, list));
  }
})();

if (typeof module !== 'undefined') module.exports = { PHRASING };
