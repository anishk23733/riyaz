'use strict';
/* global $, S, esc, clamp, save, audio, unlock, ctx, saMidi, OFF, swaraText, ALL_RAGAS, ragaInfo,
   harmoniumVoice, Tabla, Tanpura, TAALS, vibhagOf, buildPads, renderSettings, keepInStep, updateTablaUI,
   openSheet, stopPhrase, PHRASES, KINDS */

// =====================================================================
// Library: aalap phrases and taans from phrases.js, played on the harmonium in time with the
// tabla. Phrases are scheduled ahead on the audio clock (not with timers), so a fast taan stays
// exactly on the matras and a "lands on sam" taan really lands on sam.
// =====================================================================

// ---------- notation ----------
// "N.RGM DNS'- | ~R - S" -> beats of slots; events = the notes with their beat position and length.
// Before a note: (x) kan, ~ quick meend into it, ~~ slow meend (most of the note is the slide),
// ^ andolan (a slow swing on the note), ? your turn (drawn and timed, but not played).
const SLOT_RE = /\(([SrRgGmMPdDnN])([.']?)\)|(~)|(\^)|(\?)|([SrRgGmMPdDnN])([.']?)|(-)|(_)/g;
const octOf = o => o === '.' ? -1 : o === "'" ? 1 : 0;

function parseNotes(str) {
  const beats = [], events = [];
  let bar = false, last = null, ti = 0;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') { bar = true; continue; }
    const slots = [];
    let kan = null, glide = 0, andolan = false, silent = false;
    for (const m of tok.matchAll(SLOT_RE)) {
      if (m[1]) kan = { off: OFF[m[1]], oct: octOf(m[2]) };
      else if (m[3]) glide++;
      else if (m[4]) andolan = true;
      else if (m[5]) silent = true;
      else if (m[6]) {
        slots.push({ n: { off: OFF[m[6]], oct: octOf(m[7]), kan, glide, andolan, silent } });
        kan = null; glide = 0; andolan = false; silent = false;
      }
      else if (m[8]) slots.push({ hold: true });
      else if (m[9]) slots.push({ rest: true });
    }
    if (!slots.length) continue;
    const b = beats.length, len = 1 / slots.length;
    slots.forEach((s, k) => {
      if (s.n) { s.ti = ti; last = Object.assign({ b: b + k * len, len, ti: ti++ }, s.n); events.push(last); }
      else if (s.hold && last) last.len += len;
      else if (s.rest) last = null;
    });
    beats.push({ slots, bar });
    bar = false;
  }
  return { beats, events };
}

// ---------- player ----------
const LAYS = [0.5, 1, 2];
const Lib = {
  entry: null, parsed: null, playing: false, timer: null, raf: 0,
  pass: null, voice: null, voices: [], ui: [], startedTabla: false, onToken: null,
  // opts (from Practice): { lay: notes per matra, tabla, loop, onToken(ti), onChange() }.
  // Without opts the Library's own settings apply.
  opts: null,

  midiOf(e) { return saMidi() + e.oct * 12 + e.off; },

  // The raga note just above a note: where a gamak shakes down from.
  above(midi, r) {
    const all = ragaInfo(r).all;
    for (let k = 1; k <= 12; k++) if (all.includes(((midi + k - saMidi()) % 12 + 12) % 12)) return midi + k;
    return midi + 1;
  },

  beatSec() { return 60 / S.bpm; },
  lay() { return this.opts ? this.opts.lay || 1 : LAYS.includes(S.libLay) ? S.libLay : 1; },
  useTabla() { return this.opts ? !!this.opts.tabla : S.libTabla !== false; },
  looping() { return this.opts ? !!this.opts.loop : !!S.libLoop; },
  // Where the phrase starts, in matras relative to a sam (negative = before it).
  offsetM() {
    const n = this.parsed.beats.length;
    return this.entry.lands === 'sam' ? -(n - 1) / this.lay() : 0;
  },

  // The first start time at or after `t` that keeps the phrase in its place in the taal.
  nextStart(t) {
    const beat = this.beatSec();
    if (!Tabla.playing) return t;
    const M = Tabla.taal().matras;
    const firstSam = Tabla.nextTime + ((M - Tabla.matra) % M) * beat - 2 * M * beat;
    const off = this.offsetM() * beat;
    const k = Math.max(0, Math.ceil((t - off - firstSam) / (M * beat) - 1e-6));
    return firstSam + k * M * beat + off;
  },

  play(entry, opts) {
    this.stop();
    stopPhrase();
    unlock();
    const c = audio();
    this.opts = opts || null;
    this.entry = entry;
    this.parsed = entry.parsed || parseNotes(entry.notes);
    this.pass = null;
    this.playing = true;
    const now = c.currentTime, beat = this.beatSec();
    let t0;
    if (this.useTabla() && !Tabla.playing) {
      // Start the tabla a vibhag ahead of the phrase, so you hear where you are in the taal.
      const tl = Tabla.taal(), M = tl.matras;
      const lead = tl.vibhags[0] || 4, s = this.offsetM();
      const from = Math.floor(s - lead);
      const at = now + 0.15;
      Tabla.start(((from % M) + M) % M, at);
      this.startedTabla = true;
      t0 = at + (s - from) * beat;
    } else if (this.useTabla()) {
      t0 = this.nextStart(now + 0.2);
    } else t0 = now + 0.15;
    this.newPass(t0);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    cancelAnimationFrame(this.raf);
    const frame = () => { this.showToken(); if (this.playing) this.raf = requestAnimationFrame(frame); };
    this.raf = requestAnimationFrame(frame);
    this.changed();
  },

  newPass(t0) {
    const spb = this.beatSec() / this.lay();
    this.pass = { t0, spb, i: 0, end: t0 + this.parsed.beats.length * spb, n: this.pass && this.playing ? this.pass.n + 1 : 0 };
    if (this.opts && this.opts.onPass) this.opts.onPass(this.pass);
  },

  tick() {
    if (!this.playing || !ctx) return;
    const ahead = ctx.currentTime + 0.3;
    for (;;) {
      const p = this.pass, ev = this.parsed.events;
      if (p.i >= ev.length) {
        if (p.end > ahead) return;
        if (!this.looping()) { if (ctx.currentTime > p.end + 0.4) this.stop(); return; }
        const beat = this.beatSec();
        this.newPass(Tabla.playing && this.useTabla() ? this.nextStart(p.end + beat * 0.99) : p.end + 2 * beat);
        continue;
      }
      const e = ev[p.i];
      const t = p.t0 + e.b * p.spb;
      if (t > ahead) return;
      this.schedule(e, t, e.len * p.spb, ev[p.i + 1]);
      p.i++;
    }
  },

  schedule(e, t, dur, next) {
    if (e.silent) {
      // your turn: the key is lifted and nothing plays, but the note is still shown
      if (this.voice) { this.voice.stop(false, t - 0.01); this.voice = null; this.lastMidi = null; }
      this.ui.push({ t, ti: e.ti });
      return;
    }
    const r = ALL_RAGAS.get(this.entry.raga);
    const midi = this.midiOf(e);
    const kanLen = e.kan ? Math.min(0.07, dur * 0.3) : 0;
    const startMidi = e.kan ? this.midiOf(e.kan) : this.entry.gamak ? this.above(midi, r) : midi;
    let v = this.voice;
    if (!v) {
      v = this.voice = harmoniumVoice(startMidi, t);
      this.voices.push(v);
      if (this.voices.length > 8) this.voices.shift();
    } else if (e.glide && !e.kan) {
      // ~ a quick slide into the note; ~~ a slow meend that takes about two thirds of it
      v.setPitch(midi, e.glide > 1 ? Math.max(0.05, dur * 0.2) : Math.min(0.09, dur * 0.25), t);
    } else if (startMidi === this.lastMidi) {
      v.articulate(t);
    } else {
      v.jumpTo(startMidi, t);
    }
    if (e.kan) v.jumpTo(midi, t + kanLen);
    else if (this.entry.gamak) {
      // gamak: struck from the note above and shaken down onto the note
      if (startMidi === this.lastMidi) v.articulate(t);
      v.setPitch(midi, Math.min(0.025, dur * 0.12), t + dur * 0.3);
    }
    if (e.andolan) {
      // andolan: a slow, wide swing that dips below the note and comes back, about once a second
      const per = 0.9;
      let k = 0;
      for (let x = t + 0.3; x < t + dur - per * 0.4; x += per / 2) v.setPitch(midi + (k++ % 2 ? 0.05 : -0.38), per * 0.16, x);
      v.setPitch(midi, 0.04, Math.max(t + 0.3, t + dur - per * 0.3));
    }
    this.lastMidi = midi;
    // a gap after this note (a rest, or the end of the phrase): lift the key
    const end = t + dur;
    const gap = !next || next.silent || next.b * this.pass.spb + this.pass.t0 > end + 1e-4;
    if (gap) {
      v.stop(false, end - 0.01);
      this.voice = null;
      this.lastMidi = null;
    }
    this.ui.push({ t, ti: e.ti });
  },

  showToken() {
    if (!ctx) return;
    const now = ctx.currentTime - (ctx.outputLatency || 0);
    let cur = null;
    while (this.ui.length && this.ui[0].t <= now) cur = this.ui.shift();
    const on = this.opts ? this.opts.onToken : this.onToken;
    if (cur && on) on(cur.ti);
    // after the last note: clear the highlight
    if (!cur && this.pass && this.pass.i >= this.parsed.events.length && now > this.pass.end && on) on(-1);
  },

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    for (const v of this.voices) v.stop(true);
    this.voices = [];
    this.voice = null;
    this.lastMidi = null;
    this.ui = [];
    if (this.startedTabla && Tabla.playing) Tabla.stop();
    this.startedTabla = false;
    const on = this.opts ? this.opts.onToken : this.onToken;
    if (on) on(-1);
    this.changed();
  },

  restart() { if (this.playing && this.entry) this.play(this.entry, this.opts); },
  changed() {
    if (typeof libChanged === 'function') libChanged();
    if (this.opts && this.opts.onChange) this.opts.onChange();
  },
};

// ---------- the Library sheet ----------
const libRagas = () => [...new Set(PHRASES.map(p => p.raga))].filter(n => ALL_RAGAS.has(n));
let libSel = null;            // the selected phrase
const libOpen = new Set();    // expanded ragas in the list
const KIND_NAME = Object.fromEntries(KINDS.map(k => [k.id, k.name]));
const LEVEL = ['', 'Start here', 'Next step', 'Advanced'];

function openLibrary() {
  const ragas = libRagas();
  if (!libSel || !PHRASES.includes(libSel)) {
    const raga = ragas.includes(S.raga) ? S.raga : ragas[0];
    libSel = PHRASES.find(p => p.raga === raga && (!S.libKind || p.kind === S.libKind)) || PHRASES.find(p => p.raga === raga);
  }
  libOpen.add(libSel.raga);
  renderLibKinds();
  renderLibTree();
  renderLibDetail();
  renderLibHead();
  openSheet('library');
  const sel = $('libTree').querySelector('.sel');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'center' });
}

function renderLibKinds() {
  const kinds = [{ id: '', name: 'All' }, { id: 'notation', name: 'From notation' }, ...KINDS];
  $('libKinds').innerHTML = kinds.map(k =>
    `<button data-kind="${k.id}" class="${(S.libKind || '') === k.id ? 'sel' : ''}">${esc(k.name.replace(' taan', ''))}</button>`).join('');
  $('libKinds').querySelectorAll('button').forEach(b => {
    b.onclick = () => { S.libKind = b.dataset.kind || null; save(); renderLibKinds(); renderLibTree(); };
  });
}

// the kind filter; 'From notation' picks phrases taken from a written source
function libKindMatch(p) {
  return !S.libKind || (S.libKind === 'notation' ? p.src === 'notation' : p.kind === S.libKind);
}

function renderLibTree() {
  const tree = $('libTree');
  tree.innerHTML = '';
  for (const name of libRagas()) {
    const items = PHRASES.filter(p => p.raga === name && libKindMatch(p));
    if (!items.length) continue;
    const open = libOpen.has(name);
    const head = document.createElement('button');
    head.className = 'tree-thaat' + (open ? ' open' : '');
    head.innerHTML = `<span class="caret">${open ? '▾' : '▸'}</span><span>${esc(name)}</span><span class="right">${items.length}</span>`;
    head.onclick = () => { open ? libOpen.delete(name) : libOpen.add(name); renderLibTree(); };
    tree.appendChild(head);
    if (!open) continue;
    for (const p of items) {
      const b = document.createElement('button');
      b.className = 'tree-raga lib-item' + (p === libSel ? ' sel' : '') + (p === Lib.entry && Lib.playing ? ' playing' : '');
      b.innerHTML = `<span class="lv lv${p.level || 1}" aria-label="${esc(LEVEL[p.level || 1])}"></span><span class="nm">${esc(p.name)}</span><span class="right">${esc(KIND_NAME[p.kind] || p.kind)}${p.src === 'notation' ? ' · notated' : ''}</span>`;
      b.onclick = () => selectPhrase(p);
      tree.appendChild(b);
    }
  }
  if (!tree.children.length) tree.innerHTML = '<div class="tree-empty">Nothing of this kind yet.</div>';
}

function selectPhrase(p) {
  const playingThis = Lib.playing && Lib.entry === p;
  if (!playingThis) Lib.stop();
  libSel = p;
  if (p.bpm && !playingThis) setLibTempo(p.bpm, false);
  renderLibTree();
  renderLibDetail();
}

// Switch the whole app to the phrase's raga, so the tanpura and pads match what's playing.
function useRaga(name) {
  if (S.raga === name) return;
  S.raga = name;
  S.first = null; S.extra = null;
  save();
  buildPads();
  Tanpura.retune();
}

// Which matra of the taal each written beat falls on (for the little numbers over the beats).
function matraLabels(parsed, entry) {
  const tl = Tabla.taal(), M = tl.matras, lay = LAYS.includes(S.libLay) ? S.libLay : 1;
  const n = parsed.beats.length;
  const off = entry.lands === 'sam' ? -(n - 1) / lay : 0;
  return parsed.beats.map((_, i) => {
    const p = off + i / lay;
    if (Math.abs(p - Math.round(p)) > 1e-6) return null;
    const m = ((Math.round(p) % M) + M) % M;
    const vb = vibhagOf(tl, m);
    return { n: m + 1, sam: m === 0 && !tl.samIsKhali, khali: vb.first && String(vb.mark) === '0', first: vb.first };
  });
}

function notationHTML(parsed, entry) {
  const labels = matraLabels(parsed, entry);
  return parsed.beats.map((b, i) => {
    const L = labels[i];
    const mark = !L ? '' : L.sam ? '<span class="mt sam">X</span>' : L.khali ? `<span class="mt khali">${L.n}</span>` : `<span class="mt${L.first ? ' first' : ''}">${L.n}</span>`;
    const slots = b.slots.map(s => {
      if (s.hold) return '<span class="hd">–</span>';
      if (s.rest) return '<span class="rs">·</span>';
      const n = s.n;
      const kan = n.kan ? `<sup class="kan">${swaraText(Object.keys(OFF).find(k => OFF[k] === n.kan.off), n.kan.oct)}</sup>` : '';
      const gl = n.glide ? '<span class="gl" aria-label="meend">⌒</span>' : '';
      return `${gl}${kan}<span class="tok" data-i="${s.ti}">${swaraText(Object.keys(OFF).find(k => OFF[k] === n.off), n.oct)}</span>`;
    }).join('');
    // a line before each vibhag of the selected taal
    return `${L && L.first && i ? '<span class="vb"></span>' : ''}<span class="bt${b.slots.length > 1 ? ' many' : ''}">${mark || '<span class="mt"></span>'}<span class="sl">${slots}</span></span>`;
  }).join('');
}

function renderLibDetail() {
  const p = libSel;
  if (!p) return;
  const parsed = parseNotes(p.notes);
  const notes = parsed.events.length, beats = parsed.beats.length;
  const where = p.lands === 'sam' ? 'lands on sam' : 'starts on sam';
  const meta = [p.raga, KIND_NAME[p.kind] || p.kind, LEVEL[p.level || 1]].join(' · ');
  const perBeat = Math.max(...parsed.beats.map(b => b.slots.length));
  const nps = perBeat * Lib.lay() * S.bpm / 60;
  const cite = (from, url) => url && /^https:\/\//.test(url)
    ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(from)}</a>` : esc(from);
  const src = p.src === 'notation' ? `From notation: ${cite(p.from, p.url)}`
    : p.src && p.src !== 'written' ? `Transcribed from ${esc(p.src)}` : '';
  const checkText = p.src === 'written'
    ? `Composed for this app in the Kirana style${p.ref ? `, after ${esc(p.ref)}` : ''}, not transcribed from a recording.`
    : p.src === 'notation'
      ? esc(p.srcNote || 'The notes are as written in the source; the rhythm is set for this app, since the source gives none.')
      : 'Transcribed by pitch tracking.';
  const playingThis = Lib.playing && Lib.entry === p;
  $('libDetail').innerHTML = `
    <div class="detail-scroll">
      <div class="detail-title"><h2>${esc(p.name)}</h2><span class="muted small">${esc(meta)}</span></div>
      <div class="lib-notation" id="libNotation">${notationHTML(parsed, p)}</div>
      <div class="lib-facts muted small">${notes} notes over ${beats} beat${beats === 1 ? '' : 's'} · ${where} in ${esc(Tabla.taal().name)}${p.gamak ? ' · gamak on every note' : ''}${perBeat > 1 ? ` · ${nps.toFixed(1)} notes a second at ${S.bpm} BPM` : ''}${p.bpm && p.bpm !== S.bpm ? ` · <button class="link-btn" id="libSuggest">learn it at ${p.bpm} BPM</button>` : ''}</div>
      ${p.why ? `<p class="lib-why">${esc(p.why)}</p>` : ''}
      <div class="legend">⌒ meend into the note · small note = kan · – hold · · rest · numbers = matras, X = sam</div>
      ${src ? `<div class="legend">${src}</div>` : ''}
      ${p.check ? `<div class="check-note">${checkText} Worth checking with your teacher; you can edit phrases.js.</div>` : ''}
    </div>
    <div class="detail-actions lib-actions">
      <button class="btn primary" id="libPlay">${playingThis ? '■ Stop' : '▶ Play'}</button>
      <button class="btn toggle${S.libLoop ? ' on' : ''}" id="libLoop" aria-pressed="${!!S.libLoop}">Loop</button>
      <div class="seg lib-lay" role="group" aria-label="Speed">
        ${LAYS.map(l => `<button data-lay="${l}" class="${Lib.lay() === l ? 'sel' : ''}">${l === 0.5 ? '½×' : l + '×'}</button>`).join('')}
      </div>
    </div>`;
  $('libPlay').onclick = () => {
    if (Lib.playing && Lib.entry === p) { Lib.stop(); return; }
    useRaga(p.raga);
    Lib.play(p);
  };
  $('libLoop').onclick = () => { S.libLoop = !S.libLoop; save(); renderLibDetail(); };
  $('libDetail').querySelectorAll('[data-lay]').forEach(b => {
    b.onclick = () => { S.libLay = Number(b.dataset.lay); save(); renderLibDetail(); Lib.restart(); };
  });
  if ($('libSuggest')) $('libSuggest').onclick = () => setLibTempo(p.bpm, true);
}

function setLibTempo(bpm, restart) {
  S.bpm = clamp(Math.round(bpm), 20, 400);
  save();
  renderSettings();
  keepInStep();
  renderLibHead();
  if (restart) Lib.restart();
  if ($('library') && !$('library').hidden) renderLibDetail();
}

function renderLibHead() {
  $('libBpm').textContent = S.bpm;
  $('libTabla').setAttribute('aria-pressed', String(S.libTabla !== false));
  $('libTablaName').textContent = Tabla.taal().name;
  $('libTanpura').setAttribute('aria-pressed', String(Tanpura.playing));
}

// Highlight the note being heard, in the sheet and in the bar at the bottom of the main screen.
Lib.onToken = ti => {
  for (const id of ['libNotation', 'npTokens']) {
    const el = $(id);
    if (el) el.querySelectorAll('.tok').forEach(t => t.classList.toggle('cur', Number(t.dataset.i) === ti));
  }
};

function libChanged() {
  const sheetOpen = !$('library').hidden;
  if (sheetOpen) { renderLibTree(); const b = $('libPlay'); if (b) b.textContent = Lib.playing && Lib.entry === libSel ? '■ Stop' : '▶ Play'; }
  renderLibHead();
  // keep playing after the sheet is closed: show it in the bar at the bottom, with a stop button
  const nb = document.querySelector('.navbar');
  if (Lib.playing && !sheetOpen) {
    $('npLabel').textContent = Lib.entry.name;
    $('npTokens').innerHTML = flatHTML(Lib.parsed);
    nb.classList.add('np');
  } else if (!Lib.playing && nb.dataset.lib) nb.classList.remove('np');
  if (Lib.playing && !sheetOpen) nb.dataset.lib = '1'; else delete nb.dataset.lib;
}

// The phrase on one line, for the bar at the bottom.
function flatHTML(parsed) {
  return parsed.beats.map(b => b.slots.filter(s => s.n).map(s =>
    `<span class="tok" data-i="${s.ti}">${swaraText(Object.keys(OFF).find(k => OFF[k] === s.n.off), s.n.oct)}</span>`).join('')).join(' ');
}

$('libraryBtn').onclick = e => { e.stopPropagation(); openLibrary(); };
$('libClose').onclick = () => { $('library').hidden = true; libChanged(); };
$('npStop').addEventListener('click', () => Lib.stop());
$('libTabla').onclick = () => {
  S.libTabla = S.libTabla === false;
  save();
  if (S.libTabla === false && Lib.startedTabla) { Tabla.stop(); Lib.startedTabla = false; }
  renderLibHead();
  Lib.restart();
};
$('libTanpura').onclick = () => {
  if (libSel) useRaga(libSel.raga);
  Tanpura.toggle();
  setTimeout(renderLibHead, 0);
};
document.querySelectorAll('[data-libbpm]').forEach(b => {
  b.onclick = () => setLibTempo(S.bpm + Number(b.dataset.libbpm), true);
});
