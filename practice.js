'use strict';
/* global $, S, esc, clamp, save, audio, unlock, ctx, saMidi, mtof, OFF, swaraText, ALL_RAGAS, currentRaga,
   Tabla, Tanpura, TAALS, vibhagOf, renderSettings, renderTablaSettings, updateTablaUI, keepInStep, openSheet,
   Lib, parseNotes, useRaga, Pitch, Sing, EXERCISES, TRACKS, LEVEL_NAMES, SOURCES, exerciseNotes, ragaScale, BILAWAL, PATHS, PATH_STAGES */

// =====================================================================
// Practice: a graded riyaz course (exercises.js). Each exercise is drawn as a note graph, swaras
// up the side and matras along the bottom, with a playhead that follows the harmonium and the
// tabla. Sing turns the microphone on and draws your voice over the same graph, then scores
// each pass. Progress (the tempo each exercise is at, when it was clean, the days you practised)
// is kept in this browser.
// =====================================================================

// ---------- progress ----------
const PR_KEY = 'riyaz-practice';
const Prog = {
  d: (() => { try { return JSON.parse(localStorage.getItem(PR_KEY) || '{}'); } catch { return {}; } })(),
  save() { try { localStorage.setItem(PR_KEY, JSON.stringify(this.d)); } catch {} },
  ex(id) { this.d.ex = this.d.ex || {}; return this.d.ex[id] || (this.d.ex[id] = {}); },
  today() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; },
  practised(id) {
    const d = this.today();
    this.d.days = this.d.days || {};
    const list = this.d.days[d] || (this.d.days[d] = []);
    if (!list.includes(id)) { list.push(id); this.save(); }
    const p = this.ex(id);
    if (p.last !== d) { p.last = d; p.sessions = (p.sessions || 0) + 1; this.save(); }
  },
  doneToday(id) { return ((this.d.days || {})[this.today()] || []).includes(id); },
  streak() {
    const days = this.d.days || {};
    let n = 0;
    const t = new Date();
    if (!days[this.today()]) t.setDate(t.getDate() - 1); // today not yet: count up to yesterday
    for (;;) {
      const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      if (!days[k] || !days[k].length) return n;
      n++; t.setDate(t.getDate() - 1);
    }
  },
  bpm(ex) { const p = this.ex(ex.id); return p.bpm || ex.bpm.start; },
  mastered(ex) { return !!this.ex(ex.id).mastered; },
};

// The tempo after a clean session: one step toward the target.
function nextBpm(ex, bpm) {
  const { target, step } = ex.bpm;
  return step > 0 ? Math.min(target, bpm + step) : Math.max(target, bpm + step);
}
const reached = (ex, bpm) => ex.bpm.step > 0 ? bpm >= ex.bpm.target : bpm <= ex.bpm.target;

// ---------- the exercise, laid out ----------
const taalOf = name => TAALS.find(t => t.name === name) || TAALS[0];
const LAY_NAME = { 1: 'Thah', 2: 'Dugun', 3: 'Tigun', 4: 'Chaugun', 6: 'Chhagun', ladder: 'Ladder' };
const LAY_SHORT = { 1: '1×', 2: '2×', 3: '3×', 4: '4×', 6: '6×', ladder: 'Ladder' };

function prScaleRaga() {
  const r = currentRaga();
  return S.prScale === 'raga' && r && !r.isFree ? r : null;
}
function exRaga(ex) {
  if (ex.raga && ex.raga !== 'current') return ALL_RAGAS.get(ex.raga);
  if (ex.raga === 'current') return currentRaga();
  return prScaleRaga() || ALL_RAGAS.get('Bilawal thaat');
}
const needsRaga = ex => ex.raga === 'current' && (() => { const r = currentRaga(); return !r || r.isThaat || r.isFree; })();

function exContext(ex) {
  const r = exRaga(ex);
  const scale = ex.scale ? (prScaleRaga() ? ragaScale(prScaleRaga()) : BILAWAL) : ragaScale(r);
  return { scale, n: scale.length, raga: r };
}
function exLays(ex) { return [...ex.lays, ...(ex.ladder ? ['ladder'] : [])]; }
function exLay(ex) {
  const p = Prog.ex(ex.id), lays = exLays(ex);
  return lays.includes(p.lay) ? p.lay : lays[0];
}
function buildExercise(ex) {
  const c = exContext(ex), lay = exLay(ex), tl = taalOf(ex.taal);
  const notes = exerciseNotes(ex, c, lay, tl.matras);
  const parsed = parseNotes(notes);
  // guide off: every note is yours to sing (drawn and timed, not played)
  if (S.prGuide === 'off') for (const e of parsed.events) e.silent = true;
  return { ex, c, lay, taal: tl, notes, parsed, raga: exRaga(ex) };
}

// ---------- the note graph ----------
const G = {
  canvas: null, w: 0, h: 0, dpr: 1, x0: 0, drag: null, built: null,
  // the matra each beat falls on (lands: 'sam' shifts the start so the last beat is sam)
  offset(b) { return b.ex.lands === 'sam' ? -(b.parsed.beats.length - 1) : b.ex.startAt ? b.ex.startAt - 1 : 0; },
  pitch(e) { return e.oct * 12 + e.off; },
  size() {
    const cv = this.canvas;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    cv.width = Math.round(this.w * this.dpr); cv.height = Math.round(this.h * this.dpr);
  },
  geo(b) {
    const ev = b.parsed.events, B = b.parsed.beats.length;
    const ps = ev.flatMap(e => [this.pitch(e), ...(e.kan ? [e.kan.oct * 12 + e.kan.off] : [])]);
    let lo = Math.min(0, ...ps) - 1, hi = Math.max(...ps, 7) + 1;
    if (hi - lo < 9) { const mid = (hi + lo) / 2; lo = Math.floor(mid - 4.5); hi = lo + 9; }
    const gut = 30, top = 18, bot = 4;
    const maxSlots = Math.max(...b.parsed.beats.map(x => x.slots.length));
    const minPpb = clamp(maxSlots * 12, 20, 64);
    const avail = this.w - gut - 6;
    const ppb = B * minPpb <= avail ? avail / B : minPpb;
    return { B, lo, hi, gut, top, bot, ppb, rowH: (this.h - top - bot) / (hi - lo), view: avail / ppb };
  },
  y(g, p) { return g.top + (g.hi - p) * g.rowH; },
  x(g, beat) { return g.gut + (beat - this.x0) * g.ppb; },

  draw(b, play, mic) {
    const cv = this.canvas;
    if (!cv || !b) return;
    // laid out while the sheet was hidden (or resized since): size it to what is on screen now
    const r = cv.getBoundingClientRect();
    if (r.width < 2) return;
    if (Math.abs(r.width - this.w) > 0.5 || Math.abs(r.height - this.h) > 0.5) this.size();
    const c2 = cv.getContext('2d');
    c2.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c2.clearRect(0, 0, this.w, this.h);
    const g = this.geo(b);
    // follow the playhead; otherwise stay where the finger put it
    const maxX0 = Math.max(0, g.B - g.view);
    if (play != null && !this.drag) this.x0 = clamp(play - g.view * 0.3, 0, maxX0);
    this.x0 = clamp(this.x0, 0, maxX0);
    const sc = new Set(b.c.scale.map(l => OFF[l]));
    for (const e of b.parsed.events) sc.add(((e.off % 12) + 12) % 12);
    const tl = b.taal, M = tl.matras, off = this.offset(b);
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim() || '#f2a33a';

    // swara lines
    c2.font = '11px -apple-system, system-ui, sans-serif';
    c2.textBaseline = 'middle';
    for (let p = Math.ceil(g.lo); p <= g.hi; p++) {
      const pc = ((p % 12) + 12) % 12;
      if (!sc.has(pc)) continue;
      const y = this.y(g, p), isSa = pc === 0;
      c2.strokeStyle = isSa ? 'rgba(242,163,58,.32)' : 'rgba(236,234,228,.09)';
      c2.lineWidth = 1;
      c2.beginPath(); c2.moveTo(g.gut, y); c2.lineTo(this.w, y); c2.stroke();
      const letter = Object.keys(OFF).find(k => OFF[k] === pc && (k === 'S' || b.c.scale.includes(k) || b.parsed.events.some(e => e.off === pc)));
      c2.fillStyle = isSa ? accent : '#a9a69e';
      c2.textAlign = 'right';
      c2.fillText(swaraText(letter || '?', Math.floor(p / 12)), g.gut - 6, y);
    }

    // matras: a line on each, stronger on each vibhag, saffron on sam; X 2 0 3 on top
    const first = Math.floor(this.x0), last = Math.min(g.B, Math.ceil(this.x0 + g.view) + 1);
    c2.textAlign = 'center';
    c2.textBaseline = 'alphabetic';
    for (let i = first; i <= last; i++) {
      const x = this.x(g, i);
      if (x < g.gut - 1) continue;
      const m = (((i + off) % M) + M) % M, vb = vibhagOf(tl, m);
      const sam = m === 0, mark = vb.first ? String(vb.mark) : null;
      c2.strokeStyle = sam ? 'rgba(242,163,58,.55)' : vb.first ? 'rgba(236,234,228,.22)' : 'rgba(236,234,228,.07)';
      c2.lineWidth = sam ? 1.5 : 1;
      if (mark === '0') c2.setLineDash([3, 3]);
      c2.beginPath(); c2.moveTo(x, g.top - 2); c2.lineTo(x, this.h - g.bot); c2.stroke();
      c2.setLineDash([]);
      if (i >= g.B) continue;
      if (mark != null) {
        c2.font = 'bold 11px -apple-system, system-ui, sans-serif';
        c2.fillStyle = sam ? accent : '#a9a69e';
        c2.fillText(sam && !tl.samIsKhali ? 'X' : mark, x + Math.min(10, g.ppb / 2), 12);
      } else if (g.ppb >= 22) {
        c2.font = '10px -apple-system, system-ui, sans-serif';
        c2.fillStyle = '#5c5a55';
        c2.fillText(String(m + 1), x + Math.min(10, g.ppb / 2), 12);
      }
    }

    // notes
    const ev = b.parsed.events;
    const lw = clamp(g.rowH * 0.5, 3, 9);
    c2.lineCap = 'round';
    let prev = null;
    for (let k = 0; k < ev.length; k++) {
      const e = ev[k], p = this.pitch(e);
      const xa = this.x(g, e.b), xb = this.x(g, e.b + e.len);
      const touching = prev && Math.abs(prev.b + prev.len - e.b) < 1e-6;
      if (xb < g.gut - 20 || xa > this.w + 20) { prev = e; continue; }
      const y = this.y(g, p);
      const now = play != null && play >= e.b && play < e.b + e.len;
      const past = play != null && play >= e.b + e.len;
      const col = e.silent ? (now ? '#eceae4' : past ? 'rgba(236,234,228,.45)' : 'rgba(236,234,228,.75)')
        : now ? accent : past ? 'rgba(242,163,58,.5)' : '#8d8a82';
      c2.strokeStyle = col; c2.fillStyle = col;
      c2.lineWidth = e.silent ? 1.5 : lw;
      const pad = Math.min(2, (xb - xa) * 0.15);
      // the path of the voice through the note: meend from the last note, andolan, gamak
      const path = [];
      if (e.glide && prev && touching) {
        const py = this.y(g, this.pitch(prev));
        const frac = e.glide > 1 ? 0.65 : 0.12;
        path.push([xa, py], [xa + (xb - xa) * frac, y], [xb - pad, y]);
      } else if (e.andolan) {
        // as many slow swings as the harmonium plays (one every 0.9 s)
        const n = Math.max(1, Math.round(e.len * (60 / S.bpm) / 0.9));
        for (let j = 0; j <= n * 16; j++) {
          const t = j / (n * 16), x = xa + pad + (xb - xa - 2 * pad) * t;
          const env = Math.min(1, t * 6, (1 - t) * 6);
          path.push([x, y + g.rowH * 0.32 * env * (0.5 - 0.5 * Math.cos(2 * Math.PI * n * t))]);
        }
      } else if (b.ex.gamak) {
        const ya = this.y(g, p + 1), w = Math.min(10, (xb - xa) * 0.35);
        path.push([xa + pad, ya], [xa + pad + w * 0.5, y], [xa + pad + w * 0.75, y - g.rowH * 0.2], [xa + pad + w, y], [xb - pad, y]);
      } else path.push([xa + pad, y], [Math.max(xa + pad + 0.5, xb - pad), y]);
      if (e.silent) {
        // your turn: an outlined bar
        c2.setLineDash([4, 3]);
        const r = lw / 2 + 1;
        c2.beginPath();
        c2.moveTo(path[0][0], path[0][1] - r);
        for (const [x, yy] of path.slice(1)) c2.lineTo(x, yy - r);
        for (const [x, yy] of path.slice().reverse()) c2.lineTo(x, yy + r);
        c2.closePath(); c2.stroke();
        c2.setLineDash([]);
      } else {
        c2.beginPath();
        c2.moveTo(path[0][0], path[0][1]);
        for (const [x, yy] of path.slice(1)) c2.lineTo(x, yy);
        c2.stroke();
      }
      if (e.kan) {
        const ky = this.y(g, e.kan.oct * 12 + e.kan.off);
        c2.lineWidth = 1.5;
        c2.beginPath(); c2.moveTo(xa - 5, ky); c2.lineTo(xa + 1, y); c2.stroke();
        c2.beginPath(); c2.arc(xa - 5, ky, 2.2, 0, 2 * Math.PI); c2.fill();
      }
      // the swara's name over it, when there is room
      if (xb - xa >= 15 && g.rowH >= 9) {
        c2.font = `${now ? 'bold ' : ''}11px -apple-system, system-ui, sans-serif`;
        c2.textAlign = 'left';
        c2.textBaseline = 'alphabetic';
        c2.fillStyle = now ? accent : e.silent ? 'rgba(236,234,228,.7)' : '#bdbab2';
        const letter = Object.keys(OFF).find(l => OFF[l] === e.off);
        c2.fillText(swaraText(letter, e.oct), xa + 1, y - lw / 2 - 3);
      }
      prev = e;
    }

    // the bandish words over their matras
    if (b.ex.words) {
      c2.font = 'italic 11px -apple-system, system-ui, sans-serif';
      c2.textAlign = 'left';
      c2.textBaseline = 'alphabetic';
      c2.fillStyle = accent;
      for (const w of b.ex.words) {
        const x = this.x(g, w.b);
        if (x < g.gut - 4 || x > this.w) continue;
        c2.fillText(w.t, x + 2, this.h - g.bot - 3);
      }
    }

    // your voice
    if (mic && mic.length) {
      c2.strokeStyle = 'rgba(120, 200, 255, .95)';
      c2.lineWidth = 2;
      c2.lineJoin = 'round';
      c2.beginPath();
      let pb = null;
      for (const q of mic) {
        const x = this.x(g, q.b), yy = this.y(g, q.c / 100);
        if (pb == null || q.b - pb > 0.25 / Math.max(1, b.parsed.beats.length / 64) && q.b - pb > 0.12) c2.moveTo(x, yy); else c2.lineTo(x, yy);
        pb = q.b;
      }
      c2.stroke();
    }

    // playhead
    if (play != null && play >= 0 && play <= g.B) {
      const x = this.x(g, play);
      c2.strokeStyle = 'rgba(236,234,228,.8)';
      c2.lineWidth = 1.5;
      c2.beginPath(); c2.moveTo(x, g.top - 4); c2.lineTo(x, this.h - g.bot); c2.stroke();
    }
    // scroll position hint
    if (g.B > g.view + 0.01) {
      const w = this.w - g.gut, f = g.view / g.B;
      c2.fillStyle = 'rgba(236,234,228,.18)';
      c2.fillRect(g.gut + (this.x0 / g.B) * w, this.h - 2, Math.max(16, w * f), 2);
    }
  },
};

// ---------- singing along: microphone -> points on the graph, and a score per pass ----------
const Mic = {
  on: false, stream: null, src: null, an: null, sink: null, data: null, ctxRef: null, floor: 0.003, raw: [],
  pts: [], lastPts: [], winSec: 0.043, lastT: 0, result: null,

  async start() {
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) { prMessage(window.isSecureContext ? "This browser can't use the microphone." : 'The microphone only works over https.'); return; }
    if (typeof Sing !== 'undefined' && Sing.on) Sing.close(); // one listener at a time
    unlock();
    if (typeof Sing !== 'undefined') Sing.setSession('play-and-record');
    this.on = true;
    renderPrActions();
    try {
      this.stream = await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (err) {
      this.on = false;
      if (typeof Sing !== 'undefined') Sing.setSession('playback');
      prMessage(err && err.name === 'NotAllowedError' ? 'Microphone is blocked. Allow it for this site, then tap Sing again.' : "Couldn't open the microphone.");
      renderPrActions();
      return;
    }
    if (!this.on) { this.stream.getTracks().forEach(t => t.stop()); return; }
    this.attach();
    prMessage('Use earphones, so the harmonium and tanpura stay out of the microphone.');
  },
  attach() {
    const c = audio();
    this.detach();
    this.ctxRef = c;
    const d = Math.max(1, Math.round(c.sampleRate / 24000));
    this.src = c.createMediaStreamSource(this.stream);
    this.an = c.createAnalyser();
    this.an.fftSize = 1 << Math.round(Math.log2(1024 * d));
    this.an.smoothingTimeConstant = 0;
    this.sink = c.createGain();
    this.sink.gain.value = 0;
    this.src.connect(this.an).connect(this.sink).connect(c.destination);
    this.data = new Float32Array(this.an.fftSize);
    this.winSec = this.an.fftSize / c.sampleRate;
  },
  detach() { for (const n of [this.src, this.an, this.sink]) { try { n && n.disconnect(); } catch {} } this.src = this.an = this.sink = null; },
  stop() {
    this.on = false;
    this.detach();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (typeof Sing !== 'undefined') Sing.setSession('playback');
    renderPrActions();
  },
  toggle() { this.on ? this.stop() : this.start(); },

  // one reading: where in the exercise you are (in beats) and your pitch (cents above Sa,
  // moved by octaves to the octave of the note you should be singing)
  sample(b) {
    if (!this.on || !this.an || !Lib.playing || !Lib.pass || Lib.entry !== prEntry) return;
    if (ctx !== this.ctxRef) this.attach();
    const c = this.ctxRef;
    if (!c || c.state !== 'running') return;
    const t = c.currentTime - this.winSec / 2 - (c.outputLatency || 0) - 0.02;
    if (t <= this.lastT) return;
    this.lastT = t;
    this.an.getFloatTimeDomainData(this.data);
    const p = Pitch.detect(this.data, c.sampleRate);
    this.floor = Math.max(0.0003, p.rms < this.floor ? this.floor * 0.6 + p.rms * 0.4 : this.floor * 1.0004);
    const voiced = p.hz > 0 && p.clarity >= 0.8 && p.rms >= Math.max(0.0015, this.floor * 2.2);
    if (!voiced) { this.raw = []; return; }
    const cents = 1200 * Math.log2(p.hz / mtof(saMidi()));
    this.raw.push(cents);
    if (this.raw.length > 3) this.raw.shift();
    const c3 = this.raw.length === 3 ? [...this.raw].sort((x, y) => x - y)[1] : cents;
    const pass = Lib.pass, beat = (t - pass.t0) / pass.spb;
    if (beat < -0.5 || beat > b.parsed.beats.length + 0.5) return;
    const e = noteAt(b, beat) || noteAt(b, beat - 0.5) || noteAt(b, beat + 0.5);
    const ref = e ? G.pitch(e) * 100 : this.pts.length ? this.pts[this.pts.length - 1].c : 0;
    this.pts.push({ b: beat, c: c3 - 1200 * Math.round((c3 - ref) / 1200) });
  },

  // A pass ended: how much of it was in tune.
  score(b) {
    const pts = this.pts;
    this.lastPts = pts;
    this.pts = [];
    if (pts.length < 8) return null;
    const ev = b.parsed.events;
    const mine = ev.some(e => e.silent) && S.prGuide !== 'off' ? ev.filter(e => e.silent) : ev;
    let n = 0, ok = 0, sum = 0, hit = 0;
    const per = [];
    for (const e of mine) {
      // the steady part of the note: after its start (and its meend), before its end
      const a = e.b + Math.min(e.len * (e.glide > 1 ? 0.7 : 0.25), 0.5), z = e.b + e.len - Math.min(0.1, e.len * 0.1);
      const tol = e.andolan ? 70 : 35;
      const ps = pts.filter(q => q.b >= a && q.b <= z);
      if (ps.length) hit++;
      for (const q of ps) {
        const d = q.c - G.pitch(e) * 100;
        n++; sum += d;
        if (Math.abs(d) <= tol) ok++;
        per.push({ e, d });
      }
    }
    if (!n) return null;
    // the swara you were furthest off on, on average
    const bySw = new Map();
    for (const { e, d } of per) { const k = G.pitch(e); const v = bySw.get(k) || { s: 0, n: 0, e }; v.s += d; v.n++; bySw.set(k, v); }
    let worst = null;
    for (const v of bySw.values()) { const m = v.s / v.n; if (v.n >= 4 && (!worst || Math.abs(m) > Math.abs(worst.m))) worst = { m, e: v.e }; }
    return { acc: ok / n, notes: hit, of: mine.length, lean: sum / n, worst };
  },
};

function noteAt(b, beat) {
  for (const e of b.parsed.events) if (beat >= e.b && beat < e.b + e.len) return e;
  return null;
}

// ---------- the Practice sheet ----------
let prSel = null;        // selected exercise id, or 'today'
let prBuilt = null;      // the selected exercise, laid out
let prEntry = null;      // what Lib is playing for us
let prFromPlan = null;   // the plan, when an exercise was opened from it
let prRaf = 0;
const prOpenTracks = new Set();

function prMessage(text) { const el = $('prMsg'); if (el) { el.textContent = text || ''; el.hidden = !text; } }

function openPractice() {
  if (!prSel) prSel = S.prSel || 'today';
  if (prSel !== 'today' && !EXERCISES.find(e => e.id === prSel)) prSel = 'today';
  const ex = EXERCISES.find(e => e.id === prSel);
  if (ex) prOpenTracks.add(ex.track);
  renderPrHead();
  renderPrSide();
  renderPrDetail();
  openSheet('practice');
  const sel = $('prSide').querySelector('.sel');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'center' });
  cancelAnimationFrame(prRaf);
  const frame = () => {
    if ($('practice').hidden) return;
    prRaf = requestAnimationFrame(frame);
    prFrame();
  };
  prRaf = requestAnimationFrame(frame);
}

function closePractice() {
  $('practice').hidden = true;
  cancelAnimationFrame(prRaf);
  if (Mic.on) Mic.stop();
  if (typeof libChanged === 'function') libChanged();
}

function renderPrHead() {
  const r = currentRaga();
  const rn = r && !r.isFree ? (r.isThaat ? r.thaat : r.name) : null;
  $('prScale').innerHTML = `<button data-sc="bilawal" class="${S.prScale !== 'raga' ? 'sel' : ''}">Bilawal</button>` +
    (rn ? `<button data-sc="raga" class="${S.prScale === 'raga' ? 'sel' : ''}">${esc(rn)}</button>` : '');
  $('prScale').querySelectorAll('button').forEach(b => {
    b.onclick = () => { S.prScale = b.dataset.sc; save(); Lib.stop(); renderPrHead(); renderPrDetail(); };
  });
  $('prBpm').textContent = S.bpm;
  $('prTabla').setAttribute('aria-pressed', String(S.prTabla !== false));
  $('prTanpura').setAttribute('aria-pressed', String(Tanpura.playing));
}

// ---------- the list: Today, then each track ----------
const LV_DOTS = l => `<span class="lv lv${Math.min(3, l)}${l >= 4 ? ' lv4' : ''}" aria-label="${esc(LEVEL_NAMES[l])}"></span>`;

function renderPrSide() {
  const side = $('prSide');
  const plan = todayPlan();
  const doneN = plan.filter(p => Prog.doneToday(p.ex.id)).length;
  const streak = Prog.streak();
  let html = `<button class="pr-today${prSel === 'today' ? ' sel' : ''}" data-today>
    <span class="nm">Today's riyaz</span>
    <span class="right">${doneN}/${plan.length}${streak > 1 ? ` · ${streak} days` : ''}</span></button>`;
  for (const t of TRACKS) {
    const items = EXERCISES.filter(e => e.track === t.id);
    const mastered = items.filter(e => Prog.mastered(e)).length;
    const open = prOpenTracks.has(t.id);
    html += `<button class="tree-thaat pr-track${open ? ' open' : ''}" data-track="${t.id}">
      <span class="caret">${open ? '▾' : '▸'}</span><span>${esc(t.name)}</span>
      <span class="pr-bar" aria-hidden="true"><span style="width:${Math.round(100 * mastered / items.length)}%"></span></span>
      <span class="right">${mastered}/${items.length}</span></button>`;
    if (!open) continue;
    html += prItems(items, e => LEVEL_NAMES[e.level]);
  }
  if (typeof PATHS !== 'undefined') {
    html += `<div class="pr-group">Raga paths</div>`;
    for (const t of PATHS) {
      const items = pathItems(t.id);
      if (!items.length) continue;
      const mastered = items.filter(e => Prog.mastered(e)).length;
      const open = prOpenTracks.has(t.id);
      html += `<button class="tree-thaat pr-track${open ? ' open' : ''}" data-track="${t.id}">
        <span class="caret">${open ? '▾' : '▸'}</span><span>${esc(t.name)}</span>
        <span class="pr-bar" aria-hidden="true"><span style="width:${Math.round(100 * mastered / items.length)}%"></span></span>
        <span class="right">${mastered}/${items.length}</span></button>`;
      if (open) html += prItems(items, e => (PATH_STAGES.find(s => s.id === e.stage) || {}).name || '');
    }
  }
  side.innerHTML = html;
  side.querySelector('[data-today]').onclick = () => selectPr('today');
  side.querySelectorAll('[data-track]').forEach(b => {
    b.onclick = () => { const id = b.dataset.track; prOpenTracks.has(id) ? prOpenTracks.delete(id) : prOpenTracks.add(id); renderPrSide(); };
  });
  side.querySelectorAll('[data-ex]').forEach(b => { b.onclick = () => { prFromPlan = null; selectPr(b.dataset.ex); }; });
}

// the rows of one track or path, with a heading wherever `head` changes
function prItems(items, head) {
  let html = '', h = null;
  for (const e of items) {
    const hh = head(e);
    if (hh !== h) { h = hh; html += `<div class="pr-level">${esc(h)}</div>`; }
    const p = Prog.ex(e.id);
    const status = p.mastered ? '<span class="pr-ok" aria-label="Mastered">✓</span>' : p.bpm && p.bpm !== e.bpm.start ? `<span class="pr-at">${p.bpm}</span>` : '';
    html += `<button class="tree-raga lib-item pr-item${prSel === e.id ? ' sel' : ''}${Lib.playing && prEntry && Lib.entry === prEntry && prBuilt && prBuilt.ex === e ? ' playing' : ''}" data-ex="${e.id}">
      ${LV_DOTS(e.level)}<span class="nm">${esc(e.name)}</span>${Prog.doneToday(e.id) ? '<span class="pr-dot" aria-label="Practised today"></span>' : ''}<span class="right">${status}</span></button>`;
  }
  return html;
}

// a raga path's lessons in the order they are learnt: by stage, then level
// within a stage: your class notes first, then what was composed in their method, then the rest
const cnRank = e => (e.cn === 'notes' ? 0 : e.cn === 'method' ? 1 : 2);
function pathItems(id) {
  const st = e => PATH_STAGES.findIndex(s => s.id === e.stage);
  return EXERCISES.filter(e => e.track === id).map((e, i) => [e, i])
    .sort((a, b) => st(a[0]) - st(b[0]) || cnRank(a[0]) - cnRank(b[0]) || a[0].level - b[0].level || a[1] - b[1]).map(x => x[0]);
}
const trackOf = id => TRACKS.find(t => t.id === id) || (typeof PATHS !== 'undefined' && PATHS.find(t => t.id === id)) || { name: '' };
const isPath = ex => typeof PATHS !== 'undefined' && PATHS.some(t => t.id === ex.track);

function selectPr(id) {
  const ex = EXERCISES.find(e => e.id === id);
  if (!(Lib.playing && prBuilt && prBuilt.ex === ex)) { if (prEntry && Lib.entry === prEntry) Lib.stop(); }
  prSel = id;
  S.prSel = id;
  save();
  Mic.pts = []; Mic.lastPts = []; Mic.result = null;
  if (ex) {
    prOpenTracks.add(ex.track);
    if (isPath(ex)) S.prPath = ex.track;
    // start at this exercise's working tempo
    if (!Lib.playing) setPrTempo(Prog.bpm(ex));
  }
  renderPrSide();
  renderPrDetail();
}

// ---------- Today's riyaz: one exercise from each part of practice, in the traditional order ----------
function prLevel() { return clamp(S.prLevel || 3, 1, 4); }
// the raga path for today: your current raga's, else the last one you opened, else the first
function todayPath() {
  if (typeof PATHS === 'undefined') return null;
  const r = currentRaga(), has = p => pathItems(p.id).length;
  return PATHS.find(p => r && p.raga === r.name && has(p)) || PATHS.find(p => p.id === S.prPath && has(p)) || PATHS.find(has) || null;
}
function todayPlan() {
  const L = prLevel(), mins = S.prMinutes || 30;
  const pick = (track, skip = []) => {
    const items = EXERCISES.filter(e => e.track === track && e.level <= L && !skip.includes(e) && !needsRaga(e));
    if (!items.length) return null;
    // the first one not yet mastered at your level (or the highest level this skill has below it),
    // then any lower one still open; else one to keep fresh, by the day
    const top = Math.max(...items.map(e => e.level));
    const open = items.find(e => e.level === top && !Prog.mastered(e)) || items.find(e => !Prog.mastered(e));
    if (open) return open;
    const day = Math.floor(Date.now() / 864e5);
    return items[day % items.length];
  };
  const day = Math.floor(Date.now() / 864e5);
  const plan = [];
  const add = (track, why, skip) => { const e = pick(track, skip); if (e && !plan.some(p => p.ex === e)) plan.push({ ex: e, why }); };
  // in a raga path, the next lesson not yet mastered, in the path's own order
  const addPath = (path, stages, why) => {
    const items = pathItems(path.id).filter(e => stages.includes(e.stage));
    const at = items.filter(e => e.level <= Math.max(L, 2));
    const e = at.find(x => !Prog.mastered(x)) || at[day % Math.max(1, at.length)];
    if (e && !plan.some(p => p.ex === e)) plan.push({ ex: e, why });
  };
  add('swar', 'Warm up on Sa');
  add('alankar', 'Alankar');
  if (mins >= 30) add('alankar', 'Second alankar', plan.map(p => p.ex));
  add('orn', 'Ornament');
  const path = todayPath();
  if (path) {
    addPath(path, ['swar', 'chalan', 'badhat', 'orn'], `Raga · ${path.name}`);
    if (mins >= 30) addPath(path, ['laya', 'taan'], `Raga taan · ${path.name}`);
  } else add('raga', 'Raga');
  add(day % 2 ? 'taan' : 'laya', day % 2 ? 'Speed' : 'Laya');
  if (mins >= 45) add(day % 2 ? 'laya' : 'taan', day % 2 ? 'Laya' : 'Speed');
  add('ear', 'Ear');
  // share the time out in proportion to each exercise's own length
  const total = plan.reduce((s, p) => s + p.ex.minutes, 0);
  for (const p of plan) p.min = Math.max(2, Math.round(p.ex.minutes * mins / total));
  return plan;
}

function renderToday() {
  const plan = todayPlan();
  const L = prLevel();
  const streak = Prog.streak();
  $('prDetail').innerHTML = `
    <div class="detail-scroll">
      <div class="detail-title"><h2>Today's riyaz</h2><span class="muted small">${streak ? `${streak} day${streak > 1 ? 's' : ''} in a row` : 'start a streak today'}</span></div>
      <div class="pr-opts">
        <div class="seg small-seg" role="group" aria-label="Level">${[1, 2, 3, 4].map(l => `<button data-lv="${l}" class="${L === l ? 'sel' : ''}">${esc(LEVEL_NAMES[l])}</button>`).join('')}</div>
        <div class="seg small-seg" role="group" aria-label="Minutes">${[15, 30, 45].map(m => `<button data-min="${m}" class="${(S.prMinutes || 30) === m ? 'sel' : ''}">${m} min</button>`).join('')}</div>
      </div>
      <p class="lib-why">In the usual order of a riyaz: settle on Sa, alankars from slow to fast, an ornament, then the raga (the next lessons in its own path: ${esc(todayPath() ? todayPath().name : 'choose a raga')}), speed or laya, and a little ear work. Each one is the next exercise you haven't mastered at the level you pick. The raga follows the one chosen on the main screen when it has a path.</p>
      <div class="pr-plan">${plan.map((p, i) => {
        const done = Prog.doneToday(p.ex.id), lay = exLay(p.ex);
        return `<button class="pr-row${done ? ' done' : ''}" data-plan="${i}">
          <span class="pr-n">${done ? '✓' : i + 1}</span>
          <span class="pr-what"><span class="k">${esc(p.why)} · ${esc(isPath(p.ex) ? (PATH_STAGES.find(x => x.id === p.ex.stage) || {}).name : LEVEL_NAMES[p.ex.level])}</span><span class="v">${esc(p.ex.name)}</span></span>
          <span class="pr-when"><b>${p.min} min</b><span>${Prog.bpm(p.ex)} BPM · ${esc(LAY_NAME[lay] || lay)}</span></span></button>`;
      }).join('')}</div>
      <div class="legend">Mark an exercise clean when you got through it without a slip (or Sing scored it 80% in tune); next time it starts a few BPM closer to its target. Progress stays in this browser.</div>
    </div>`;
  $('prDetail').querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { S.prLevel = Number(b.dataset.lv); save(); renderPrSide(); renderToday(); }; });
  $('prDetail').querySelectorAll('[data-min]').forEach(b => { b.onclick = () => { S.prMinutes = Number(b.dataset.min); save(); renderToday(); }; });
  $('prDetail').querySelectorAll('[data-plan]').forEach(b => {
    b.onclick = () => { prFromPlan = plan.map(p => p.ex.id); selectPr(plan[Number(b.dataset.plan)].ex.id); };
  });
}

// ---------- one exercise ----------
function cite(k) {
  const s = SOURCES[k];
  return s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : '';
}

function renderPrDetail() {
  if (prSel === 'today') { prBuilt = null; renderToday(); return; }
  const ex = EXERCISES.find(e => e.id === prSel);
  if (!ex) return;
  if (needsRaga(ex)) {
    prBuilt = null;
    $('prDetail').innerHTML = `<div class="detail-scroll"><div class="detail-title"><h2>${esc(ex.name)}</h2></div>
      <p class="lib-why">This one uses your current raga's aaroh, pakad and phrases. Choose a raga (not a thaat or free play) with the raga button on the main screen, then come back.</p></div>`;
    return;
  }
  prBuilt = buildExercise(ex);
  const b = prBuilt, p = Prog.ex(ex.id);
  const tr = trackOf(ex.track), path = isPath(ex) ? tr : null;
  const ragaName = ex.raga && ex.raga !== 'current' ? ex.raga : ex.raga === 'current' ? (b.raga.name) : null;
  const scaleName = ex.scale ? (prScaleRaga() ? `${prScaleRaga().isThaat ? prScaleRaga().thaat : prScaleRaga().name} notes` : 'Bilawal') : null;
  const meta = [path ? `${tr.name} path` : tr.name, path ? (PATH_STAGES.find(x => x.id === ex.stage) || {}).name : null, LEVEL_NAMES[ex.level], ex.taal, path ? null : ragaName || scaleName, `${ex.minutes} min`].filter(Boolean).join(' · ');
  const work = Prog.bpm(ex);
  const dir = ex.bpm.step > 0 ? 'faster is harder' : 'slower is harder: longer notes';
  const lays = exLays(ex);
  const lay = exLay(ex);
  const cleanList = (p.clean || []).slice(-3).reverse().map(c => `${c.bpm} BPM ${LAY_SHORT[c.lay] || ''} on ${c.d.slice(5)}`).join(', ');
  const planIdx = prFromPlan ? prFromPlan.indexOf(ex.id) : -1;
  const evN = b.parsed.events.length, beatsN = b.parsed.beats.length;
  const secs = Math.round(beatsN * 60 / S.bpm);
  const mine = b.parsed.events.filter(e => e.silent).length;
  const libN = ex.raga === 'current' && typeof PHRASES !== 'undefined' ? PHRASES.filter(x => x.raga === b.raga.name).length : 0;

  $('prDetail').innerHTML = `
    <div class="detail-scroll" id="prScroll">
      ${planIdx >= 0 ? `<div class="pr-planbar"><button class="link-btn" id="prBack">‹ Today</button><span class="muted small">${planIdx + 1} of ${prFromPlan.length}</span><span class="grow"></span>${planIdx + 1 < prFromPlan.length ? '<button class="link-btn" id="prNext">Next ›</button>' : ''}</div>` : ''}
      <div class="detail-title"><h2>${esc(ex.name)}</h2><span class="muted small">${esc(meta)}</span></div>
      <div class="pr-graph-wrap"><canvas id="prGraph" aria-label="The notes of the exercise on a graph: swaras up the side, matras along the bottom"></canvas></div>
      <div class="pr-under">
        <span id="prResult" class="pr-result muted small">${evN} notes over ${beatsN} matras, about ${secs} s a pass at ${S.bpm} BPM${mine ? ` · outlined notes are your turn` : ''}</span>
      </div>
      <div id="prMsg" class="check-note pr-msg" hidden></div>
      <p class="lib-why">${esc(ex.purpose)}</p>
      ${ex.why ? `<div class="pr-sec pr-why"><b>Why it's built this way</b><p>${esc(ex.why)}</p></div>` : ''}
      ${ex.flags ? `<div class="check-note">${ex.flags.map(f => esc(f)).join('<br>')}</div>` : ''}
      <div class="pr-tempo">
        <div class="pr-tempo-top">
          <span><b>Tempo</b> <span class="muted small">start ${ex.bpm.start}, target ${ex.bpm.target} BPM, ${ex.bpm.step > 0 ? '+' : ''}${ex.bpm.step} each clean session (${dir})</span></span>
        </div>
        <div class="pr-tempo-row">
          <span>Working at <b>${work} BPM</b>${lays.length > 1 ? ` · ${esc(LAY_NAME[lay] || lay)}` : ''}${p.mastered ? ' · <span class="pr-ok">mastered</span>' : ''}</span>
          <span class="grow"></span>
          <button class="btn small${Mic.result && Mic.result.clean ? ' primary' : ''}" id="prClean">Clean at ${S.bpm} ✓</button>
        </div>
        ${cleanList ? `<div class="muted small">Clean: ${esc(cleanList)}</div>` : ''}
      </div>
      ${ex.how ? `<div class="pr-sec"><b>How</b><ol>${ex.how.map(h => `<li>${esc(h)}</li>`).join('')}</ol></div>` : ''}
      <div class="pr-sec"><b>Listen for</b><p>${esc(ex.listen)}</p></div>
      <div class="pr-sec"><b>Common mistakes</b><p>${esc(ex.mistakes)}</p></div>
      <div class="pr-sec"><b>Then make it harder</b><p>${esc(ex.harder)}</p></div>
      ${lays.length > 1 ? `<div class="legend">Speeds: thah is one note a matra, dugun two, tigun three, chaugun four. Ladder sings them one after another, each filling the same time. Raise the tempo only when the fastest speed is clean.</div>` : ''}
      ${libN ? `<div class="legend">${libN} aalaps and taans for ${esc(b.raga.name)} are in the Library (book icon).</div>` : ''}
      ${ex.src ? `<div class="legend">Follows: ${ex.src.map(cite).join('; ')}</div>` : ''}
      ${ex.his ? `<details class="pr-about"><summary class="muted small">As written in your notes</summary><ol class="pr-his">${ex.his.map(h => `<li>${esc(h)}</li>`).join('')}</ol></details>` : ''}
      ${prProvenance(ex)}
      ${path ? prPathAbout(path) : ''}
      <details class="pr-notation"><summary class="muted small">Notation</summary><div class="lib-notation" id="prNotation"></div></details>
    </div>
    <div class="detail-actions lib-actions pr-actions" id="prActions"></div>`;

  G.canvas = $('prGraph');
  G.x0 = 0;
  G.size();
  hookGraphDrag();
  renderPrActions();
  $('prClean').onclick = () => markClean(ex);
  if ($('prBack')) $('prBack').onclick = () => selectPr('today');
  if ($('prNext')) $('prNext').onclick = () => selectPr(prFromPlan[planIdx + 1]);
  const det = $('prDetail').querySelector('.pr-notation');
  det.addEventListener('toggle', () => { if (det.open) $('prNotation').innerHTML = flatNotation(b); });
  G.draw(b, null, Mic.lastPts);
  G.dirty = true;
}

// where the notes come from, said plainly
function prProvenance(ex) {
  if (ex.cn === 'notes') return `<div class="legend">From your class notes (${esc(ex.cnFile || ex.raga)}). The notes and their order are yours; the timing follows your marks: a note is a matra, [ ] is double speed, - holds one note and a long dash two. Where your page gives no rhythm (the aalap steps), the app sets one.</div>`;
  if (ex.cn === 'method') return '<div class="check-note">Composed for this app in the method of your class notes, not from the notes themselves. The "why" says which pattern of yours it extends.</div>';
  if (ex.cn === 'others') return '<div class="check-note">Composed for this app, Bhimsen-inspired, in the structure of your class notes (numbered steps, a palta, taans between a mukhda). Not from your notes; worth checking with your teacher.</div>';
  const link = (t, u) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t);
  if (ex.from) return `<div class="legend">Notes from a published notation: ${link(ex.from, ex.url)}. ${esc(ex.srcNote || 'The rhythm is set for this app.')}</div>
    <div class="check-note">Worth checking with your teacher: a notation on paper leaves out how the notes are sung.</div>`;
  if (ex.total) return `<div class="check-note">${ex.sourced} of these ${ex.total} aalaps follow a published notation; the rest are Bhimsen-inspired, composed for this app in the Kirana style. Each one's source is on its own lesson.</div>`;
  if (ex.composed) return `${ex.ref ? `<div class="legend">The shape follows how Bhimsen Joshi built taans, as described in ${esc(ex.ref)}. The notes are composed for this app.</div>` : ''}
    <div class="check-note">Bhimsen-inspired, in the Kirana style: composed for this app, not transcribed from his recordings. Worth checking with your teacher; you can edit ragapaths.js${ex.fromLib ? ' and phrases.js' : ''}.</div>`;
  if (ex.check) return '<div class="check-note">Written for this app from descriptions of the raga, not transcribed. Worth checking with your teacher; you can edit exercises.js.</div>';
  return '';
}
function prPathAbout(p) {
  return `<details class="pr-about"><summary class="muted small">About ${esc(p.name)}</summary>
    <p>${esc(p.character)}</p>
    <p><b>Rests on</b> ${esc(p.nyas)}.</p>
    <p><b>Goes wrong by</b> ${esc(p.pitfalls)}.</p>
    <p>${esc(p.neighbours)}</p>
    ${p.facts ? `<p><b>Your notes:</b> ${esc(p.facts)}</p>` : ''}
    ${p.method ? `<p><b>How your notes build it</b></p>${p.method.map(m => `<p>${esc(m)}</p>`).join('')}` : ''}
    ${p.unclear && p.unclear.length ? `<p><b>Unclear in the notes</b></p><ul>${p.unclear.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
    ${p.unplaced && p.unplaced.some(u => !u.kept) ? `<p><b>Taans not placed yet</b> (they don't come out to their beat count by the dash and bracket rules, so they aren't in a lesson)</p><ul>${p.unplaced.filter(u => !u.kept).map(u => `<li>${esc(u.where)}: ${esc(u.text)} (${esc(u.why)})</li>`).join('')}</ul>` : ''}</details>`;
}

// the notation, beat by beat (for reading or copying)
function flatNotation(b) {
  return b.parsed.beats.map(bt => `<span class="bt${bt.slots.length > 1 ? ' many' : ''}"><span class="mt"></span><span class="sl">${bt.slots.map(s => {
    if (s.hold) return '<span class="hd">–</span>';
    if (s.rest) return '<span class="rs">·</span>';
    const n = s.n, l = Object.keys(OFF).find(k => OFF[k] === n.off);
    const kan = n.kan ? `<sup class="kan">${swaraText(Object.keys(OFF).find(k => OFF[k] === n.kan.off), n.kan.oct)}</sup>` : '';
    return `${n.glide ? '<span class="gl">⌒</span>' : ''}${kan}<span class="tok${n.silent ? ' mine' : ''}">${swaraText(l, n.oct)}${n.andolan ? '<sup class="kan">~</sup>' : ''}</span>`;
  }).join('')}</span></span>`).join('');
}

function renderPrActions() {
  const el = $('prActions');
  if (!el || !prBuilt) return;
  const ex = prBuilt.ex;
  const playing = Lib.playing && prEntry && Lib.entry === prEntry;
  const lays = exLays(ex), lay = exLay(ex);
  el.innerHTML = `
    <button class="btn primary" id="prPlay">${playing ? '■ Stop' : '▶ Play'}</button>
    ${lays.length > 1 ? `<div class="seg lib-lay" role="group" aria-label="Speed">${lays.map(l => `<button data-lay="${l}" class="${l === lay ? 'sel' : ''}">${LAY_SHORT[l]}</button>`).join('')}</div>` : ''}
    <button class="btn toggle${S.prGuide === 'off' ? '' : ' on'}" id="prGuide" aria-pressed="${S.prGuide !== 'off'}">Guide</button>
    <button class="btn toggle${Mic.on ? ' on' : ''}" id="prSing" aria-pressed="${Mic.on}">Sing</button>`;
  $('prPlay').onclick = () => (playing ? Lib.stop() : playPr());
  el.querySelectorAll('[data-lay]').forEach(b => {
    b.onclick = () => {
      const v = b.dataset.lay === 'ladder' ? 'ladder' : Number(b.dataset.lay);
      Prog.ex(ex.id).lay = v; Prog.save();
      const was = Lib.playing && Lib.entry === prEntry;
      renderPrDetail();
      if (was) playPr();
    };
  });
  $('prGuide').onclick = () => {
    S.prGuide = S.prGuide === 'off' ? 'play' : 'off'; save();
    const was = Lib.playing && Lib.entry === prEntry;
    renderPrDetail();
    if (was) playPr();
  };
  $('prSing').onclick = () => Mic.toggle();
}

function playPr() {
  const b = prBuilt;
  if (!b) return;
  const ex = b.ex;
  // the taal the exercise is counted in
  if (S.taal !== ex.taal) {
    if (Tabla.playing) Tabla.stop();
    S.taal = ex.taal;
    save();
    renderTablaSettings();
    updateTablaUI();
  }
  // exercises that belong to a raga switch the app to it (tanpura and pads follow)
  if (ex.raga && ex.raga !== 'current' && S.raga !== ex.raga) useRaga(ex.raga);
  Mic.pts = []; Mic.result = null;
  prEntry = { raga: ex.raga ? b.raga.name : prScaleRaga() ? prScaleRaga().name : 'Bilawal thaat', name: ex.name, notes: b.notes, parsed: b.parsed, lands: ex.lands, startAt: ex.startAt, gamak: !!ex.gamak };
  Lib.play(prEntry, {
    lay: 1, tabla: S.prTabla !== false, loop: true,
    onToken: () => {},
    onChange: () => { renderPrActions(); renderPrSide(); },
    onPass: pass => { if (pass.n > 0) passDone(); },
  });
  renderPrActions();
}

// A pass of the exercise finished: count the day, score the singing.
function passDone() {
  const b = prBuilt;
  if (!b) return;
  Prog.practised(b.ex.id);
  if (Mic.on) {
    const r = Mic.score(b);
    if (r) {
      r.clean = r.acc >= 0.8 && r.notes >= Math.ceil(r.of * 0.9);
      Mic.result = r;
      const lean = Math.abs(r.lean) >= 8 ? ` · leaning ${Math.round(Math.abs(r.lean))}¢ ${r.lean > 0 ? 'sharp' : 'flat'}` : '';
      const worst = r.worst && Math.abs(r.worst.m) >= 20 ? ` · furthest off on ${swaraText(Object.keys(OFF).find(k => OFF[k] === r.worst.e.off), r.worst.e.oct)} (${r.worst.m > 0 ? '+' : ''}${Math.round(r.worst.m)}¢)` : '';
      const el = $('prResult');
      if (el) {
        el.className = 'pr-result small' + (r.clean ? ' good' : '');
        el.textContent = `Last pass: ${Math.round(r.acc * 100)}% in tune on ${r.notes} of ${r.of} notes${lean}${worst}${r.clean ? ' · clean' : ''}`;
      }
      const cb = $('prClean');
      if (cb) cb.classList.toggle('primary', r.clean);
      const p = Prog.ex(b.ex.id);
      if (!p.best || r.acc > p.best) { p.best = Math.round(r.acc * 100) / 100; Prog.save(); }
    }
  }
  renderPrSide();
}

function markClean(ex) {
  const p = Prog.ex(ex.id);
  const lay = exLay(ex), lays = exLays(ex);
  p.clean = p.clean || [];
  p.clean.push({ d: Prog.today(), bpm: S.bpm, lay });
  if (p.clean.length > 30) p.clean.shift();
  // mastered: clean at the target tempo at the fastest speed (or the ladder)
  const top = lay === 'ladder' || lay === Math.max(...ex.lays) || lays.length === 1;
  if (reached(ex, S.bpm) && top) p.mastered = true;
  // next time: a step on, at the speed you were at; at the fastest speed the tempo moves,
  // at a slower one you move up a speed first
  if (!top) {
    const i = ex.lays.indexOf(lay);
    p.lay = ex.lays[i + 1] || lay;
    p.bpm = S.bpm;
  } else p.bpm = nextBpm(ex, S.bpm);
  Prog.practised(ex.id);
  Prog.save();
  const msg = p.mastered && reached(ex, S.bpm) ? 'Mastered. It stays in Today now and then, to keep it fresh.'
    : !top ? `Clean. Next: ${LAY_NAME[p.lay]} at ${p.bpm} BPM.` : `Clean. Next time: ${p.bpm} BPM.`;
  renderPrSide();
  const was = Lib.playing && Lib.entry === prEntry;
  if (!was) setPrTempo(p.bpm);
  renderPrDetail();
  prMessage(msg);
}

function setPrTempo(bpm) {
  S.bpm = clamp(Math.round(bpm), 20, 400);
  save();
  renderSettings();
  keepInStep();
  if ($('prBpm')) $('prBpm').textContent = S.bpm;
  if (typeof renderLibHead === 'function') renderLibHead();
}

// ---------- every frame: the playhead, your voice ----------
let prWasLive = false;
function prFrame() {
  const b = prBuilt;
  if (!b || !G.canvas) return;
  let play = null;
  const live = Lib.playing && prEntry && Lib.entry === prEntry;
  // nothing moving: draw only when something changed
  if (!live && !Mic.on && !G.dirty && !G.drag && !prWasLive) return;
  prWasLive = live;
  G.dirty = false;
  if (Lib.playing && prEntry && Lib.entry === prEntry && Lib.pass && ctx) {
    const now = ctx.currentTime - (ctx.outputLatency || 0);
    const beat = (now - Lib.pass.t0) / Lib.pass.spb;
    if (beat >= -0.0001 && beat <= b.parsed.beats.length) play = beat;
    Mic.sample(b);
  }
  G.draw(b, play, Mic.pts.length ? Mic.pts : Mic.lastPts);
}

// drag the graph sideways to look along a long exercise
function hookGraphDrag() {
  const cv = G.canvas;
  if (!cv) return;
  cv.onpointerdown = e => {
    if (!prBuilt) return;
    G.drag = { x: e.clientX, x0: G.x0 };
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
  };
  cv.onpointermove = e => {
    if (!G.drag || !prBuilt) return;
    const g = G.geo(prBuilt);
    G.x0 = G.drag.x0 - (e.clientX - G.drag.x) / g.ppb;
    G.dirty = true;
  };
  cv.onpointerup = cv.onpointercancel = () => { G.drag = null; };
}

window.addEventListener('resize', () => { if (!$('practice').hidden && G.canvas) { G.size(); G.dirty = true; } });

// ---------- header controls ----------
$('practiceBtn').onclick = e => { e.stopPropagation(); openPractice(); };
$('prClose').onclick = () => closePractice();
$('prTabla').onclick = () => {
  S.prTabla = S.prTabla === false;
  save();
  if (S.prTabla === false && Lib.startedTabla) { Tabla.stop(); Lib.startedTabla = false; }
  renderPrHead();
  if (Lib.playing && Lib.entry === prEntry) playPr();
};
$('prTanpura').onclick = () => {
  if (prBuilt && prBuilt.ex.raga && prBuilt.ex.raga !== 'current') useRaga(prBuilt.ex.raga);
  Tanpura.toggle();
  setTimeout(renderPrHead, 0);
};
document.querySelectorAll('[data-prbpm]').forEach(b => {
  b.onclick = () => {
    setPrTempo(S.bpm + Number(b.dataset.prbpm));
    // a tempo you choose by hand becomes the exercise's working tempo
    if (prBuilt) { Prog.ex(prBuilt.ex.id).bpm = S.bpm; Prog.save(); }
    const was = Lib.playing && Lib.entry === prEntry;
    renderPrDetail();
    if (was) Lib.restart();
  };
});
