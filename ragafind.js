'use strict';
/* global $, S, esc, clamp, OFF, LETTERS, SWARA_NAME, KIND, NOTE_NAMES, ALL_RAGAS, ragaInfo, tokens, thaatLabel,
          saMidi, mtof, Sing, noteOf, saFromCents, setSa, showRagaInBrowser */

// =====================================================================
// Which raga? Sing freely (in Sing), then this names the swaras you held and shortlists the
// ragas that fit them. With "Guess Sa" it also works out Sa itself, for a song you know
// without knowing which note is Sa.
//
// How it reads your singing:
//  - your overall tuning offset (you may sit 20¢ sharp of the app's Sa: notes are read from
//    where you actually sing, not from the grid);
//  - held notes (on one note for 0.12 s or more), grouped into phrases at pauses;
//  - a 12-swara histogram of how long you held each;
//  - which swaras you passed through going up and going down (aaroh/avaroh), and short
//    three-note turns, compared with each raga's aaroh, avaroh, pakad and phrases.
// Several ragas share the same notes and differ only in how they move, so this is a shortlist.
// =====================================================================

const RF = (() => {
  const HOLD_IN = 40, HOLD_OUT = 55, HOLD_MIN = 0.12, GAP = 0.09, PHRASE_GAP = 0.6, LONG = 0.6;
  const mod12 = n => ((n % 12) + 12) % 12;

  // pts: [{ t, a }] in time order, a = cents above A4. ref = the reference Sa, in the same units.
  function analyse(pts, ref) {
    // 1. Tuning offset: the circular mean of where steady points sit between semitones.
    let sx = 0, sy = 0;
    for (let i = 2; i < pts.length - 2; i++) {
      const p = pts[i];
      if (pts[i + 2].t - pts[i - 2].t > 0.12) continue;
      if (Math.abs(pts[i + 2].a - pts[i - 2].a) > 20) continue; // moving
      const ang = 2 * Math.PI * (p.a - ref) / 100;
      sx += Math.cos(ang); sy += Math.sin(ang);
    }
    const strength = Math.hypot(sx, sy);
    const offset = strength > 0 ? Math.atan2(sy, sx) / (2 * Math.PI) * 100 : 0;

    // 2. Held notes.
    const notes = [];
    let h = null;
    const end = () => { if (h && h.end - h.start >= HOLD_MIN) notes.push({ n: h.n, start: h.start, end: h.end, dur: h.end - h.start }); h = null; };
    let lastT = -1;
    for (const p of pts) {
      const x = p.a - ref - offset;
      if (h && (p.t - lastT > GAP || Math.abs(x - h.n * 100) > HOLD_OUT)) end();
      lastT = p.t;
      const n = Math.round(x / 100);
      if (!h && Math.abs(x - n * 100) <= HOLD_IN) h = { n, start: p.t, end: p.t };
      if (h) h.end = p.t;
    }
    end();

    // 3. Phrases (split at pauses), each as its notes with repeats merged.
    const phrases = [];
    for (const nt of notes) {
      const cur = phrases[phrases.length - 1];
      if (cur && nt.start - cur.end <= PHRASE_GAP) {
        const last = cur.notes[cur.notes.length - 1];
        if (last.n === nt.n) { last.dur += nt.dur; last.end = nt.end; } else cur.notes.push({ ...nt });
        cur.end = nt.end;
      } else phrases.push({ start: nt.start, end: nt.end, notes: [{ ...nt }] });
    }

    // 4. Weights per pitch class (relative to ref): time held, held long, where phrases end.
    const dur = new Array(12).fill(0), long = new Array(12).fill(0), ends = new Array(12).fill(0);
    for (const nt of notes) {
      dur[mod12(nt.n)] += nt.dur;
      if (nt.dur >= LONG) long[mod12(nt.n)] += nt.dur;
    }
    phrases.forEach((ph, i) => {
      const last = ph.notes[ph.notes.length - 1];
      // a song usually comes home to Sa at the very end: the last phrase counts three times
      const w = i === phrases.length - 1 && phrases.length >= 3 ? 3 : 1;
      if (ph.notes.length >= 2 || last.dur >= LONG) ends[mod12(last.n)] += w * (0.3 + Math.min(last.dur, 3));
    });
    const total = dur.reduce((s, x) => s + x, 0);
    return { ref, offset, strength, notes, phrases, dur, long, ends, total };
  }

  // Each raga's notes, aaroh/avaroh sets and three-note turns, as pitch classes.
  function prep(r) {
    const inf = ragaInfo(r);
    const tri = new Set();
    const lines = [r.aaroh, r.avaroh, r.pakad, ...(r.phrases || [])].filter(Boolean);
    for (const line of lines) for (const seg of line.split(',')) {
      const seq = [];
      for (const t of tokens(seg)) { const pc = OFF[t.l]; if (seq[seq.length - 1] !== pc) seq.push(pc); }
      for (let i = 0; i + 2 < seq.length; i++) tri.add(seq[i] + ',' + seq[i + 1] + ',' + seq[i + 2]);
    }
    let mask = 0; for (const o of inf.all) mask |= 1 << o;
    return {
      r, name: r.name, all: new Set(inf.all), mask, size: inf.all.length, up: inf.upSet, dn: inf.dnSet,
      vadi: r.vadi != null && OFF[r.vadi] != null ? OFF[r.vadi] : -1,
      samvadi: r.samvadi != null && OFF[r.samvadi] != null ? OFF[r.samvadi] : -1,
      tri,
    };
  }

  // What you sang, seen with Sa at `rot` semitones above the reference.
  function view(an, rot) {
    const p = new Array(12).fill(0);
    const T = an.total || 1;
    for (let i = 0; i < 12; i++) p[i] = an.dur[mod12(i + rot)] / T;
    const used = new Set();
    for (let i = 0; i < 12; i++) if (an.dur[mod12(i + rot)] >= Math.max(0.25, 0.03 * an.total)) used.add(i);
    // passing notes up / down, and three-note turns
    const asc = new Array(12).fill(0), desc = new Array(12).fill(0), tri = [];
    for (const ph of an.phrases) {
      const s = ph.notes.map(x => x.n - rot);
      for (let i = 1; i + 1 < s.length; i++) {
        if (s[i - 1] < s[i] && s[i] < s[i + 1]) asc[mod12(s[i])]++;
        else if (s[i - 1] > s[i] && s[i] > s[i + 1]) desc[mod12(s[i])]++;
      }
      for (let i = 0; i + 2 < s.length; i++) tri.push(mod12(s[i]) + ',' + mod12(s[i + 1]) + ',' + mod12(s[i + 2]));
    }
    let mask = 0; for (const i of used) mask |= 1 << i;
    return { rot, p, used, mask, asc, desc, tri };
  }

  function score(v, R) {
    let out = 0, outCount = 0, inUsed = 0;
    for (let i = 0; i < 12; i++) if (!R.all.has(i)) out += v.p[i];
    for (const i of v.used) R.all.has(i) ? inUsed++ : outCount++;
    const cov = inUsed / R.size;
    let s = cov - 3 * out - 0.1 * outCount;
    if (v.mask === R.mask) s += 0.1;
    // vadi / samvadi: emphasised compared with an even share of the raga's notes you sang
    const e = x => x < 0 ? 0 : clamp(v.p[x] * Math.max(1, inUsed), 0, 2) / 2;
    s += 0.12 * e(R.vadi) + 0.06 * e(R.samvadi);
    // aaroh / avaroh: a note taken going up that the raga only uses coming down (or the reverse)
    let passes = 0, viol = 0;
    const wrongUp = [], wrongDn = [];
    for (let i = 0; i < 12; i++) {
      passes += v.asc[i] + v.desc[i];
      if (!R.all.has(i)) continue;
      if (v.asc[i] && !R.up.has(i)) { viol += v.asc[i]; wrongUp.push(i); }
      if (v.desc[i] && !R.dn.has(i)) { viol += v.desc[i]; wrongDn.push(i); }
    }
    s -= 0.5 * viol / Math.max(3, passes);
    // three-note turns that appear in the raga's aaroh, avaroh, pakad or phrases
    let hit = 0;
    for (const t of v.tri) if (R.tri.has(t)) hit++;
    const turns = v.tri.length >= 3 ? hit / v.tri.length : 0;
    s += 0.3 * turns;
    return { s, out, outCount, inUsed, cov, turns, wrongUp, wrongDn };
  }

  // Evidence that `rot` is Sa: phrases ending there, long holds there, and singing it at all.
  function saEvidence(an, rot) {
    const sum = xs => xs.reduce((a, b) => a + b, 0);
    const E = sum(an.ends), L = sum(an.long), T = an.total || 1;
    const endShare = E ? an.ends[rot] / E : 0;
    const longShare = L ? an.long[rot] / L : 0;
    const share = an.dur[rot] / T;
    let ev = 0.55 * endShare + 0.25 * longShare + 0.2 * Math.min(1, share * 6);
    if (an.dur[rot] < Math.max(0.25, 0.03 * T)) ev -= 0.5; // a song nearly always touches Sa
    return { ev, endShare, longShare, share };
  }

  // Ragas ranked for Sa at `rot`. Returns [{ R, sc }] best first.
  function rank(an, rot, list) {
    const v = view(an, rot);
    return { v, ranked: list.map(R => ({ R, sc: score(v, R) })).sort((a, b) => b.sc.s - a.sc.s) };
  }

  // Sa unknown: try all 12, score each by its best raga plus the evidence for that Sa.
  function guessSa(an, list) {
    const out = [];
    for (let rot = 0; rot < 12; rot++) {
      const { v, ranked } = rank(an, rot, list);
      const se = saEvidence(an, rot);
      out.push({ rot, v, ranked, se, s: ranked[0].sc.s + 0.9 * se.ev });
    }
    return out.sort((a, b) => b.s - a.s);
  }

  // Which octave of that Sa: the one that puts most of what you sang in mandra Pa … taar Sa.
  function saOctave(an, rot) {
    let best = null;
    const ns = an.notes;
    if (!ns.length) return rot;
    const lo = Math.min(...ns.map(x => x.n)), hi = Math.max(...ns.map(x => x.n));
    const med = ns.map(x => x.n).sort((a, b) => a - b)[ns.length >> 1];
    for (let k = rot + 12 * Math.floor((lo - 12 - rot) / 12); k <= hi + 12; k += 12) {
      let w = 0;
      for (const x of ns) if (x.n >= k - 5 && x.n <= k + 12) w += x.dur;
      const tie = -Math.abs(med - (k + 5));
      if (!best || w > best.w + 1e-9 || (Math.abs(w - best.w) <= 1e-9 && tie > best.tie)) best = { k, w, tie };
    }
    return best.k;
  }

  return { analyse, prep, view, score, rank, guessSa, saEvidence, saOctave, mod12 };
})();

// =====================================================================
// The panel (in Sing)
// =====================================================================
const Finder = {
  open: false, list: null, timer: 0, shownKey: '', pick: 0, last: null,

  ragas() {
    if (!this.list) this.list = [...ALL_RAGAS.values()].filter(r => !r.isThaat && !r.isFree).map(RF.prep);
    return this.list;
  },

  saRef() { return 1200 * Math.log2(mtof(saMidi()) / 440); },

  toggle() { this.open ? this.close() : this.show(); },
  show() {
    this.open = true;
    this.pick = 0;
    $('findPanel').hidden = false;
    $('singFind').classList.add('on');
    this.shownKey = '';
    this.update();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.update(), 700);
  },
  close() {
    this.open = false;
    clearInterval(this.timer);
    $('findPanel').hidden = true;
    $('singFind').classList.remove('on');
  },

  mode() { return S.findMode === 'guess' ? 'guess' : 'mine'; },
  setMode(m) { S.findMode = m; try { localStorage.setItem('riyaz', JSON.stringify(S)); } catch {} this.pick = 0; this.shownKey = ''; this.update(); },

  update() {
    if (!this.open) return;
    const pts = Sing.pts;
    const key = [pts.length, pts.length ? pts[pts.length - 1].t : 0, this.mode(), this.pick, S.saPc, S.saOct, S.cents].join('|');
    if (key === this.shownKey) return;
    this.shownKey = key;
    const ref = this.saRef();
    const an = RF.analyse(pts.filter(p => p.a != null), ref);
    this.last = an;
    this.render(an);
  },

  // ---------- drawing ----------
  render(an) {
    const mine = this.mode() === 'mine';
    $('findMine').classList.toggle('sel', mine);
    $('findGuess').classList.toggle('sel', !mine);
    $('findMine').innerHTML = `Your Sa <span class="muted">${esc(NOTE_NAMES[S.saPc] + S.saOct)}</span>`;
    const distinct = new Set(an.notes.map(x => RF.mod12(x.n))).size;
    const enough = an.total >= 2 && distinct >= 3 && an.notes.length >= 4;
    let rot = 0, body = '', foot = '';

    if (!enough) {
      body = `<div class="fp-empty">${an.notes.length ? 'Keep singing: I need a few more held notes (three different swaras at least).' : (Sing.listening ? 'Sing a phrase, a song or an aalap. Hold the notes a little so I can catch them.' : 'Turn on the microphone (Sing) and sing a phrase or a song.')}</div>`;
    } else if (mine) {
      const { ranked } = RF.rank(an, 0, this.ragas());
      body = ranked.slice(0, 5).map(x => this.row(x)).join('');
      if (an.dur[0] < Math.max(0.25, 0.03 * an.total)) foot += `<div class="fp-warn">You hardly touched Sa, so you may be singing in another key. Try Guess Sa.</div>`;
      const off = Math.round(an.offset);
      if (Math.abs(off) >= 25) foot += `<div class="fp-warn">You're singing about ${Math.abs(off)}¢ ${off > 0 ? 'sharp' : 'flat'} of your Sa, so some notes may sit between swaras. Try Guess Sa, or set Sa by humming in Settings.</div>`;
      foot += `<div class="fp-note">A shortlist, not a verdict. Several ragas share the same notes and differ in how the notes move, so check the top few by ear. Clear starts a fresh take.</div>`;
    } else {
      const guesses = RF.guessSa(an, this.ragas());
      // one entry per Sa, best first; keep the top three that have a raga that fits
      const top = guesses.slice(0, 3);
      this.pick = clamp(this.pick, 0, top.length - 1);
      rot = top[this.pick].rot;
      body = top.map((g, i) => {
        const k = RF.saOctave(an, g.rot);
        const sa = saFromCents(an.ref + k * 100 + an.offset);
        const why = [];
        if (g.se.endShare >= 0.25) why.push(`${Math.round(g.se.endShare * 100)}% of your phrases end on it`);
        else if (g.se.longShare >= 0.2) why.push('you hold it long');
        const ragas = g.ranked.slice(0, i === this.pick ? 3 : 2);
        return `<div class="fp-sa${i === this.pick ? ' sel' : ''}" data-pick="${i}">
          <div class="fp-sa-head">
            <span class="fp-sa-name">Sa ${esc(sa.name)}<span class="muted small"> ${sa.dev > 0 ? '+' : sa.dev < 0 ? '−' : '±'}${Math.abs(sa.dev)}¢</span></span>
            <span class="muted small grow">${esc(why.join(', '))}</span>
            <button class="btn small fp-set" data-set="${i}" data-pc="${sa.pc}" data-oct="${sa.oct}" data-dev="${sa.dev}">Set as Sa</button>
          </div>
          ${ragas.map(x => this.row(x, true)).join('')}
        </div>`;
      }).join('');
      foot = `<div class="fp-note">Sa is a guess from where your phrases come to rest and end. Ma or Pa can look like Sa, so try each guess against the tanpura. Then pick the raga by ear: several share the same notes.</div>`;
    }

    $('findHist').innerHTML = this.hist(an, rot, !mine);
    $('findUsed').textContent = enough ? this.usedText(an, rot) : '';
    $('findList').innerHTML = body + foot;
    $('findList').querySelectorAll('[data-raga]').forEach(b => { b.onclick = e => { e.stopPropagation(); showRagaInBrowser(b.dataset.raga); }; });
    $('findList').querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => { this.pick = Number(b.dataset.pick); this.shownKey = ''; this.update(); }; });
    $('findList').querySelectorAll('[data-set]').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        setSa(Number(b.dataset.pc), Number(b.dataset.oct), Number(b.dataset.dev));
        this.setMode('mine');
      };
    });
  },

  row(x, compact) {
    const { R, sc } = x, r = R.r;
    const reasons = [];
    if (sc.out < 0.005) reasons.push(sc.inUsed === R.size ? `all ${R.size} of its notes, nothing outside` : `everything you held is in it (${sc.inUsed} of its ${R.size} notes)`);
    else reasons.push(`${Math.round(sc.out * 100)}% of your time on notes outside it`);
    if (sc.wrongUp.length) reasons.push(`but you took ${sc.wrongUp.map(i => LETTERS[i]).join(' ')} going up, which it keeps for coming down`);
    else if (sc.wrongDn.length) reasons.push(`but you took ${sc.wrongDn.map(i => LETTERS[i]).join(' ')} coming down, which it uses going up`);
    if (sc.turns >= 0.3) reasons.push('your turns match its phrases');
    const twins = this.ragas().filter(o => o !== R && o.mask === R.mask).map(o => o.name);
    const twin = twins.length ? `<span class="fp-twins">same notes as ${esc(twins.slice(0, 3).join(', '))}${twins.length > 3 ? '…' : ''}</span>` : '';
    return `<button class="fp-raga${compact ? ' compact' : ''}" data-raga="${esc(r.name)}">
      <span class="fp-raga-top"><b>${esc(r.name)}</b><span class="muted small">${esc(thaatLabel(r))}</span>${twin}</span>
      <span class="fp-why">${esc(reasons.join('; '))}</span>
      <span class="fp-go" aria-hidden="true">›</span>
    </button>`;
  },

  hist(an, rot, absolute) {
    const T = an.total || 1;
    const vals = [], max = Math.max(1e-9, ...an.dur.map(d => d / T));
    for (let i = 0; i < 12; i++) vals.push(an.dur[RF.mod12(i + rot)] / T);
    const saCents = an.ref + rot * 100 + an.offset;
    return vals.map((p, i) => {
      const h = Math.round(p / max * 100);
      const used = an.dur[RF.mod12(i + rot)] >= Math.max(0.25, 0.03 * an.total);
      const kind = KIND[i] === 'komal' ? 'komal' : KIND[i] === 'tivra' ? 'tivra' : '';
      const west = absolute ? `<span class="fh-west">${NOTE_NAMES[noteOf(saCents + i * 100).pc]}</span>` : '';
      return `<div class="fh-col${used ? ' used' : ''}${i === 0 ? ' sa' : ''}${kind ? ' ' + kind : ''}" title="${SWARA_NAME[i]} ${KIND[i]}">
        <span class="fh-bar"><span style="height:${h}%"></span></span>
        <span class="fh-sw">${LETTERS[i]}</span>${west}
      </div>`;
    }).join('');
  },

  usedText(an, rot) {
    const T = an.total;
    const names = [];
    for (let i = 0; i < 12; i++) {
      if (an.dur[RF.mod12(i + rot)] < Math.max(0.25, 0.03 * T)) continue;
      names.push((KIND[i] === 'komal' || KIND[i] === 'tivra' ? KIND[i] + ' ' : '') + SWARA_NAME[i]);
    }
    return `You held ${names.join(', ')} · ${Math.round(T)} s of held notes`;
  },
};

if (typeof document !== 'undefined' && document.getElementById('singFind')) {
  $('singFind').onclick = () => Finder.toggle();
  $('findClose').onclick = () => Finder.close();
  $('findMine').onclick = () => Finder.setMode('mine');
  $('findGuess').onclick = () => Finder.setMode('guess');
  // keep taps on the panel from dragging the trace underneath
  $('findPanel').addEventListener('pointerdown', e => e.stopPropagation());
}

if (typeof module !== 'undefined') module.exports = { RF };
