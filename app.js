'use strict';
/* global THAATS, RAGAS */

// =====================================================================
// Helpers & notation
// =====================================================================
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const OFF = { S: 0, r: 1, R: 2, g: 3, G: 4, m: 5, M: 6, P: 7, d: 8, D: 9, n: 10, N: 11 };
const LETTERS = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];
const SWARA_NAME = ['Sa', 'Re', 'Re', 'Ga', 'Ga', 'Ma', 'Ma', 'Pa', 'Dha', 'Dha', 'Ni', 'Ni'];
const KIND = ['', 'komal', 'shuddha', 'komal', 'shuddha', 'shuddha', 'tivra', '', 'komal', 'shuddha', 'komal', 'shuddha'];
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const HARMONIUM_KEYS = ['white 1', 'black 1', 'white 2', 'black 2', 'white 3', 'white 4', 'black 3', 'white 5', 'black 4', 'white 6', 'black 5', 'white 7'];

// mandra = dot below, taar = dot above, ati-taar = two dots above
function swaraText(letter, oct) {
  if (oct < 0) return letter + '̣';
  if (oct === 1) return letter + '̇';
  if (oct >= 2) return letter + '̈';
  return letter;
}
const TOKEN_RE = /([SrRgGmMPdDnN])([.']?)/g;
const formatPhrase = s => s.replace(TOKEN_RE, (_, l, o) => swaraText(l, o === '.' ? -1 : o === "'" ? 1 : 0));
const tokens = s => [...s.matchAll(TOKEN_RE)].map(m => ({ l: m[1], oct: m[2] === '.' ? -1 : m[2] === "'" ? 1 : 0 }));

// =====================================================================
// Ragas
// =====================================================================
const ALL_RAGAS = new Map();
for (const t of THAATS) {
  const notes = t.scale.split(/\s+/);
  ALL_RAGAS.set(t.name + ' thaat', {
    name: t.name + ' thaat', thaat: t.name, isThaat: true, time: '',
    aaroh: t.scale + " S'", avaroh: "S' " + notes.slice(1).reverse().join(' ') + ' S',
  });
}
for (const r of RAGAS) ALL_RAGAS.set(r.name, r);

const JATI = { 5: 'Audav', 6: 'Shadav', 7: 'Sampurna' };
function ragaInfo(r) {
  const up = tokens(r.aaroh), dn = tokens(r.avaroh);
  const upSet = new Set(up.map(t => OFF[t.l])), dnSet = new Set(dn.map(t => OFF[t.l]));
  const all = [...new Set([...upSet, ...dnSet])].sort((a, b) => a - b);
  const j = s => JATI[s.size] || `${s.size} notes`;
  const jati = upSet.size === dnSet.size ? j(upSet) : `${j(upSet)}–${j(dnSet)}`;
  return { up, dn, upSet, dnSet, all, jati };
}

// =====================================================================
// Settings (remembered)
// =====================================================================
const DEFAULTS = { saPc: 1, saOct: 3, cents: 0, raga: 'Yaman', slide: 'glide', first: 'auto', extra: 'off', bpm: 60, balance: 60 };
const S = Object.assign({}, DEFAULTS, (() => { try { return JSON.parse(localStorage.getItem('riyaz') || '{}'); } catch { return {}; } })());
if (!ALL_RAGAS.has(S.raga)) S.raga = DEFAULTS.raga;
const save = () => { try { localStorage.setItem('riyaz', JSON.stringify(S)); } catch {} };

const currentRaga = () => ALL_RAGAS.get(S.raga);
const saMidi = () => 12 * (S.saOct + 1) + S.saPc;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12 + S.cents / 1200);

// =====================================================================
// Audio engine
// =====================================================================
let ctx = null, master, notesBus, tanpuraBus, reedWave;

function audio() {
  if (ctx) return ctx;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {} // play with silent switch on (iOS 17+)
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
  comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
  notesBus = ctx.createGain(); notesBus.connect(master);
  tanpuraBus = ctx.createGain(); tanpuraBus.connect(master);
  // Harmonium reed: rich, slightly nasal spectrum
  const N = 48, real = new Float32Array(N), imag = new Float32Array(N);
  for (let n = 1; n < N; n++) imag[n] = Math.pow(n, -0.85) * (n % 2 ? 1 : 0.65) * (n > 14 ? 0.6 : 1);
  reedWave = ctx.createPeriodicWave(real, imag);
  applyBalance();
  return ctx;
}
function unlock() {
  audio();
  if (ctx.state !== 'running') ctx.resume();
}
function applyBalance() {
  if (!ctx) return;
  const b = S.balance / 100; // 0 = tanpura louder, 1 = notes louder
  notesBus.gain.value = Math.min(1, b * 2) * 0.9;
  tanpuraBus.gain.value = Math.min(1, (1 - b) * 2) * 0.9;
}

// One sustained harmonium voice whose pitch can glide (meend).
function harmoniumVoice(midi) {
  const c = audio(), t = c.currentTime, f = mtof(midi);
  const o1 = c.createOscillator(), o2 = c.createOscillator();
  o1.setPeriodicWave(reedWave); o2.setPeriodicWave(reedWave);
  o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = 6;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = Math.min(5200, f * 14); lp.Q.value = 0.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.setTargetAtTime(0.16, t, 0.018);
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(notesBus);
  o1.start(t); o2.start(t);
  let stopped = false;
  return {
    setPitch(m, smooth) {
      if (stopped) return;
      const tt = c.currentTime, ff = mtof(m);
      const tc = smooth ? 0.02 : 0.004;
      o1.frequency.setTargetAtTime(ff, tt, tc);
      o2.frequency.setTargetAtTime(ff, tt, tc);
      lp.frequency.setTargetAtTime(Math.min(5200, ff * 14), tt, 0.03);
    },
    stop(fast) {
      if (stopped) return;
      stopped = true;
      const tt = c.currentTime;
      g.gain.cancelScheduledValues(tt);
      g.gain.setValueAtTime(g.gain.value, tt);
      g.gain.setTargetAtTime(0, tt, fast ? 0.012 : 0.05);
      o1.stop(tt + 0.6); o2.stop(tt + 0.6);
    },
  };
}

// =====================================================================
// Tanpura (synthesised: additive strings with a moving "jawari" formant)
// =====================================================================
function synthString(sr, f, dur) {
  const N = Math.floor(sr * dur), out = new Float32Array(N);
  const H = Math.max(8, Math.min(48, Math.floor(7000 / f)));
  const B = 64, tau = 2.4 + 120 / f;
  const ck = new Float64Array(H + 1), sk = new Float64Array(H + 1);
  const c = new Float64Array(H + 1), s = new Float64Array(H + 1), amp = new Float64Array(H + 1), tgt = new Float64Array(H + 1);
  for (let k = 1; k <= H; k++) {
    const w = 2 * Math.PI * f * k / sr, ph = Math.random() * 2 * Math.PI;
    ck[k] = Math.cos(w); sk[k] = Math.sin(w); c[k] = Math.cos(ph); s[k] = Math.sin(ph);
  }
  for (let b0 = 0; b0 < N; b0 += B) {
    const t = b0 / sr;
    const env = (1 - Math.exp(-t / 0.006)) * Math.exp(-t / tau) * (t > dur - 0.4 ? Math.max(0, (dur - t) / 0.4) : 1);
    const center = 2.5 + 22 * Math.exp(-t / 1.7) + 1.5 * Math.sin(2 * Math.PI * 0.33 * t);
    for (let k = 1; k <= H; k++) {
      const d = k - center;
      tgt[k] = env * Math.pow(k, -0.6) * (0.22 + 1.5 * Math.exp(-d * d / 18)) * Math.exp(-t * k * 0.01);
    }
    const end = Math.min(N, b0 + B), len = end - b0;
    for (let k = 1; k <= H; k++) {
      let a = amp[k], cc = c[k], ss = s[k];
      const da = (tgt[k] - a) / len, cw = ck[k], sw = sk[k];
      for (let i = b0; i < end; i++) {
        out[i] += a * ss;
        const nc = cc * cw - ss * sw;
        ss = ss * cw + cc * sw; cc = nc; a += da;
      }
      const r = 1 / Math.hypot(cc, ss);
      c[k] = cc * r; s[k] = ss * r; amp[k] = tgt[k];
    }
  }
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
  const norm = 0.5 / (peak || 1);
  for (let i = 0; i < N; i++) out[i] *= norm;
  return out;
}

const STRING_SEMI = { P: -5, m: -7, M: -6, N: -1, d: -4, D: -3, G: -8 }; // relative to madhya Sa, in mandra

const Tanpura = {
  playing: false, timer: null, nextTime: 0, idx: 0, gen: 0,
  cache: new Map(), last: new Map(),

  firstString() {
    if (S.first !== 'auto') return S.first;
    const r = currentRaga();
    if (r.tanpura) return r.tanpura;
    const all = ragaInfo(r).all;
    return all.includes(7) ? 'P' : all.includes(5) ? 'm' : 'N';
  },
  strings() {
    const first = this.firstString();
    const list = [{ label: swaraText(first, -1), semi: STRING_SEMI[first] }];
    if (S.extra !== 'off' && S.extra !== first) list.push({ label: swaraText(S.extra, -1), semi: STRING_SEMI[S.extra] });
    list.push({ label: 'S', semi: 0, sa: true }, { label: 'S', semi: 0, sa: true, rate: 1.0009 }, { label: swaraText('S', -1), semi: -12, sa: true });
    return list;
  },
  freqOf(semi) { return mtof(saMidi() + semi); },
  async prepare() {
    const c = audio(), gen = ++this.gen;
    for (const st of this.strings()) {
      const f = this.freqOf(st.semi), key = f.toFixed(2);
      if (this.cache.has(key)) continue;
      await new Promise(r => setTimeout(r, 0)); // keep UI responsive
      if (gen !== this.gen) return;
      const data = synthString(c.sampleRate, f, 8);
      const buf = c.createBuffer(1, data.length, c.sampleRate);
      buf.getChannelData(0).set(data);
      this.cache.set(key, buf);
    }
  },
  async start() {
    unlock();
    this.playing = true;
    updateTanpuraUI();
    await this.prepare();
    if (!this.playing) return;
    this.idx = 0;
    this.nextTime = ctx.currentTime + 0.08;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 40);
    this.tick();
  },
  stop() {
    this.playing = false;
    clearInterval(this.timer);
    const t = ctx ? ctx.currentTime : 0;
    for (const v of this.last.values()) {
      v.g.gain.setTargetAtTime(0, t, 0.25);
      v.src.stop(t + 1.5);
    }
    this.last.clear();
    updateTanpuraUI();
  },
  toggle() { this.playing ? this.stop() : this.start(); },
  async retune() {
    renderPluckChips();
    if (this.playing) await this.prepare();
  },
  tick() {
    const list = this.strings(), beat = 60 / S.bpm;
    if (this.idx >= list.length) this.idx = 0;
    while (this.nextTime < ctx.currentTime + 0.2) {
      const i = this.idx;
      this.pluck(list[i], i, this.nextTime);
      // a little breathing space after the low Sa, then the cycle repeats
      this.nextTime += beat * (i === list.length - 1 ? 2 : 1);
      this.idx = (i + 1) % list.length;
    }
  },
  pluck(st, i, t) {
    const buf = this.cache.get(this.freqOf(st.semi).toFixed(2));
    if (!buf) return;
    const jitter = (Math.random() - 0.5) * 0.02;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = st.rate || 1;
    const g = ctx.createGain();
    g.gain.value = 0.8 + Math.random() * 0.15;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = [-0.35, -0.12, 0.12, 0.35, 0][i % 5] || 0; src.connect(g).connect(pan).connect(tanpuraBus); }
    else src.connect(g).connect(tanpuraBus);
    const prev = this.last.get(i);
    if (prev) { prev.g.gain.setTargetAtTime(0, t, 0.06); prev.src.stop(t + 0.5); }
    src.start(t + jitter);
    this.last.set(i, { src, g });
    const delay = Math.max(0, (t - ctx.currentTime) * 1000);
    setTimeout(() => flashPluck(i), delay);
  },
};

// =====================================================================
// Pads
// =====================================================================
const stage = $('stage'), track = $('track'), minimap = $('minimap'), mmWindow = $('mmWindow');
let pads = [], step = 90, scrollX = 0, info = null;

function buildPads() {
  const r = currentRaga();
  info = ragaInfo(r);
  pads = [];
  for (let oct = -1; oct <= 1; oct++) for (const off of info.all) pads.push({ off, oct });
  pads.push({ off: 0, oct: 2 });

  track.innerHTML = '';
  for (const p of pads) {
    const letter = LETTERS[p.off];
    p.semi = p.oct * 12 + p.off;
    p.held = 0;
    let tag = '';
    if (!r.isThaat) {
      if (r.vadi === letter) tag = 'vadi';
      else if (r.samvadi === letter) tag = 'samvadi';
      else if (!info.upSet.has(p.off)) tag = 'avaroh only';
      else if (!info.dnSet.has(p.off)) tag = 'aaroh only';
    }
    const el = document.createElement('div');
    // Zig-zag: S up · r/R g/G down · m/M P up · d/D n/N down
    const up = [0, 5, 6, 7].includes(p.off);
    el.className = 'pad' + (up ? '' : ' down') + (p.off === 0 ? ' sa' : '');
    el.innerHTML = `<span class="sw">${swaraText(letter, p.oct)}</span><span class="tag">${tag}</span>`;
    track.appendChild(el);
    p.el = el;
  }

  // minimap
  minimap.querySelectorAll('.tick').forEach(t => t.remove());
  for (const p of pads) {
    const t = document.createElement('span');
    t.className = 'tick' + (p.off === 0 ? ' sa' : '');
    minimap.insertBefore(t, mmWindow);
    p.tick = t;
  }
  const n = info.all.length;
  const labels = $('mmLabels').children;
  for (const l of labels) l.style.width = (n * 12) + 'px';
  $('mmLabels').style.paddingLeft = '3px';

  layout();
  resetScroll();
  updateHeader();
}

function layout() {
  const W = stage.clientWidth;
  step = Math.max(58, W / (info.all.length + 2));
  pads.forEach((p, i) => { p.el.style.left = (i * step + 3) + 'px'; p.el.style.width = (step - 6) + 'px'; });
  track.style.width = pads.length * step + 'px';
  clampScroll();
  applyScroll(false);
}
const maxScroll = () => Math.max(0, pads.length * step - stage.clientWidth);
const clampScroll = () => { scrollX = clamp(scrollX, 0, maxScroll()); };
function resetScroll() {
  const i = pads.findIndex(p => p.oct === 0 && p.off === 0);
  scrollX = i * step - 0.5 * step;
  clampScroll();
  applyScroll(false);
}
function applyScroll(anim) {
  track.classList.toggle('anim', anim);
  mmWindow.classList.toggle('instant', !anim);
  track.style.transform = `translate3d(${-scrollX}px,0,0)`;
  const first = scrollX / step, count = stage.clientWidth / step;
  mmWindow.style.left = (first * 12 + 1) + 'px';
  mmWindow.style.width = (count * 12 + 2) + 'px';
  pads.forEach((p, i) => p.tick.classList.toggle('in', i + 1 > first && i < first + count));
}
function slideBy(nPads) {
  // snap so a pad edge sits at the half-pad position
  scrollX = Math.round((scrollX + 0.5 * step) / step + nPads) * step - 0.5 * step;
  clampScroll();
  applyScroll(true);
}

// ---------- pitch from horizontal position ----------
const padMidi = i => saMidi() + pads[i].semi;
function pitchAt(p) {
  const N = pads.length;
  if (S.slide === 'steps') {
    const i = clamp(Math.floor(p), 0, N - 1);
    return { midi: padMidi(i), idx: i };
  }
  // Meend: each pad's middle is a "hold zone" (exact note); pitch glides between pads.
  const q = p - 0.5, i = Math.floor(q), t = q - i, HOLD = 0.28;
  if (i < 0) return { midi: padMidi(0), idx: 0 };
  if (i >= N - 1) return { midi: padMidi(N - 1), idx: N - 1 };
  let s = t <= HOLD ? 0 : t >= 1 - HOLD ? 1 : (t - HOLD) / (1 - 2 * HOLD);
  s = s * s * (3 - 2 * s);
  return { midi: padMidi(i) + (padMidi(i + 1) - padMidi(i)) * s, idx: s < 0.5 ? i : i + 1 };
}

function setHeld(idx, delta) {
  const p = pads[idx];
  if (!p) return;
  p.held = Math.max(0, p.held + delta);
  p.el.classList.toggle('on', p.held > 0);
}

// ---------- gestures ----------
// One finger always plays (and slides = meend). Two fingers that land together and
// move sideways together scroll the strip instead.
const touches = new Map();
let scrolling = null, stageLeft = 0;

stage.addEventListener('pointerdown', e => {
  e.preventDefault();
  unlock();
  stageLeft = stage.getBoundingClientRect().left;
  const p = (e.clientX - stageLeft + scrollX) / step;
  const tch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), voice: null, idx: -1, shift: 0 };
  touches.set(e.pointerId, tch);
  if (scrolling) { scrolling.ids.add(e.pointerId); return; }
  // Start exactly on the touched pad's note; slides bend from there.
  const padIdx = clamp(Math.floor(p), 0, pads.length - 1);
  tch.shift = (padIdx + 0.5) - p;
  tch.idx = padIdx;
  tch.voice = harmoniumVoice(padMidi(padIdx));
  setHeld(padIdx, 1);
});

window.addEventListener('pointermove', e => {
  const tch = touches.get(e.pointerId);
  if (!tch) return;
  tch.x = e.clientX; tch.y = e.clientY;

  if (scrolling) {
    const xs = [...touches.values()].filter(t => scrolling.ids.has(t.id)).map(t => t.x);
    const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
    scrollX = scrolling.startScroll - (avg - scrolling.startAvg);
    clampScroll();
    applyScroll(false);
    return;
  }

  // Detect a two-finger swipe: two touches that started close in time and both move the same way.
  if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    const dxa = a.x - a.x0, dxb = b.x - b.x0;
    const together = Math.abs(a.t0 - b.t0) < 180;
    const horizontal = Math.abs(dxa) > Math.abs(a.y - a.y0) && Math.abs(dxb) > Math.abs(b.y - b.y0);
    if (together && horizontal && Math.sign(dxa) === Math.sign(dxb) && Math.abs(dxa) > 22 && Math.abs(dxb) > 22) {
      for (const t of [a, b]) { if (t.voice) t.voice.stop(true); if (t.idx >= 0) setHeld(t.idx, -1); t.voice = null; t.idx = -1; }
      const avg0 = (a.x0 + b.x0) / 2;
      scrolling = { ids: new Set([a.id, b.id]), startScroll: scrollX, startAvg: avg0 };
      return;
    }
  }

  if (!tch.voice) return;
  const p = (e.clientX - stageLeft + scrollX) / step + tch.shift;
  const { midi, idx } = pitchAt(p);
  tch.voice.setPitch(midi, S.slide === 'glide');
  if (idx !== tch.idx) { setHeld(tch.idx, -1); setHeld(idx, 1); tch.idx = idx; }
});

function endTouch(e) {
  const tch = touches.get(e.pointerId);
  if (!tch) return;
  touches.delete(e.pointerId);
  if (tch.voice) tch.voice.stop(false);
  if (tch.idx >= 0) setHeld(tch.idx, -1);
  if (scrolling) {
    scrolling.ids.delete(e.pointerId);
    if (scrolling.ids.size === 0) { scrolling = null; slideBy(0); }
  }
}
window.addEventListener('pointerup', endTouch);
window.addEventListener('pointercancel', endTouch);

function releaseAll() {
  for (const t of touches.values()) { if (t.voice) t.voice.stop(true); }
  touches.clear();
  scrolling = null;
  pads.forEach(p => { p.held = 0; p.el.classList.remove('on'); });
}

$('navLeft').onclick = () => slideBy(-4);
$('navRight').onclick = () => slideBy(4);

// Minimap: tap or drag to jump
function minimapJump(e, anim) {
  const rect = minimap.getBoundingClientRect();
  const idx = (e.clientX - rect.left - 3) / 12;
  scrollX = (idx - stage.clientWidth / step / 2) * step;
  clampScroll();
  applyScroll(anim);
}
let mmDragging = false;
minimap.addEventListener('pointerdown', e => { mmDragging = true; minimap.setPointerCapture(e.pointerId); minimapJump(e, true); });
minimap.addEventListener('pointermove', e => { if (mmDragging) minimapJump(e, false); });
minimap.addEventListener('pointerup', () => { mmDragging = false; slideBy(0); });
minimap.addEventListener('pointercancel', () => { mmDragging = false; });

window.addEventListener('resize', () => { if (info) layout(); });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

// =====================================================================
// Header
// =====================================================================
function updateHeader() {
  const r = currentRaga();
  $('ragaName').textContent = r.isThaat ? r.thaat : r.name;
  $('ragaThaat').textContent = r.isThaat ? 'thaat scale' : r.thaat + ' thaat';
}
function updateTanpuraUI() {
  $('tanpuraBtn').setAttribute('aria-pressed', String(Tanpura.playing));
  $('tanpuraPlay').classList.toggle('playing', Tanpura.playing);
  $('tanpuraPlay').setAttribute('aria-label', Tanpura.playing ? 'Stop tanpura' : 'Start tanpura');
  $('tanpuraStatus').textContent = Tanpura.playing ? 'Tanpura playing' : 'Tanpura';
}
$('tanpuraBtn').onclick = () => Tanpura.toggle();
$('tanpuraPlay').onclick = () => Tanpura.toggle();

function flashPluck(i) {
  const btn = $('tanpuraBtn');
  btn.classList.add('pulse');
  setTimeout(() => btn.classList.remove('pulse'), 120);
  const chip = [...$('pluckChips').children].find(c => c.dataset.idx.split(',').includes(String(i)));
  if (chip) { chip.classList.add('hit'); setTimeout(() => chip.classList.remove('hit'), 260); }
}

// =====================================================================
// Sheets
// =====================================================================
function openSheet(id) { $(id).hidden = false; releaseAll(); }
function closeSheet(id) { $(id).hidden = true; stopPreview(); }
document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => closeSheet(b.closest('.sheet').id); });

// ---------- Raga browser ----------
let browserSel = S.raga;
const openThaats = new Set();

$('ragaBtn').onclick = () => {
  browserSel = S.raga;
  openThaats.add(currentRaga().thaat);
  $('search').value = '';
  renderTree();
  renderDetail();
  openSheet('browser');
};
$('search').addEventListener('input', renderTree);

function matches(r, q) {
  if (!q) return true;
  // "r G d" (two or more swara letters separated by spaces) = find ragas containing those notes
  const noteQuery = /^[SrRgGmMPdDnN](\s+[SrRgGmMPdDnN])+$/.test(q);
  if (noteQuery) {
    const all = ragaInfo(r).all;
    return q.split(/\s+/).every(l => all.includes(OFF[l]));
  }
  return r.name.toLowerCase().includes(q.toLowerCase());
}

function renderTree() {
  const q = $('search').value.trim();
  const tree = $('tree');
  tree.innerHTML = '';
  let any = false;
  for (const t of THAATS) {
    const items = [...ALL_RAGAS.values()].filter(r => r.thaat === t.name && matches(r, q));
    const ragas = items.filter(r => !r.isThaat);
    if (q && !items.length) continue;
    any = true;
    const open = q ? true : openThaats.has(t.name);
    const head = document.createElement('button');
    head.className = 'tree-thaat' + (open ? ' open' : '');
    head.innerHTML = `<span class="caret">${open ? '▾' : '▸'}</span><span>${esc(t.name)}</span><span class="right">${ragas.length} raga${ragas.length === 1 ? '' : 's'}</span>`;
    head.onclick = () => { open ? openThaats.delete(t.name) : openThaats.add(t.name); renderTree(); };
    tree.appendChild(head);
    if (!open) continue;
    for (const r of items) {
      const b = document.createElement('button');
      b.className = 'tree-raga' + (r.isThaat ? ' thaat-scale' : '') + (r.name === browserSel ? ' sel' : '');
      b.innerHTML = r.isThaat
        ? `<span>Thaat scale</span><span class="right">${esc(formatPhrase(t.scale))}</span>`
        : `<span>${esc(r.name)}</span><span class="right">${esc((r.time || '').toLowerCase())}</span>`;
      b.onclick = () => { browserSel = r.name; renderTree(); renderDetail(); };
      tree.appendChild(b);
    }
  }
  if (!any) tree.innerHTML = '<div class="tree-empty">No ragas match.</div>';
}

function renderDetail() {
  const r = ALL_RAGAS.get(browserSel);
  const inf = ragaInfo(r);
  const strip = LETTERS.map((l, i) => `<span class="${i === 0 ? 'sa' : inf.all.includes(i) ? 'on' : ''}">${l}</span>`).join('');
  const kinds = inf.all.filter(o => o !== 0 && o !== 7).map(o =>
    `<span class="${KIND[o] === 'shuddha' ? '' : 'alt'}"><b>${LETTERS[o]}</b> ${SWARA_NAME[o]} ${KIND[o]}</span>`).join('');
  const meta = [r.isThaat ? 'Thaat (parent scale)' : r.thaat + ' thaat', inf.jati, r.time].filter(Boolean).join(' · ');
  const facts = [];
  facts.push(['Aaroh', formatPhrase(r.aaroh)], ['Avaroh', formatPhrase(r.avaroh)]);
  if (r.pakad) facts.push(['Pakad', formatPhrase(r.pakad)]);
  if (r.phrases && r.phrases.length) facts.push(['Key phrases', r.phrases.map(p => `<div>${esc(formatPhrase(p))}</div>`).join(''), true]);
  const vs = [];
  if (r.vadi) vs.push(`${r.vadi} <span class="muted small">vadi</span>`);
  if (r.samvadi) vs.push(`${r.samvadi} <span class="muted small">samvadi</span>`);
  const tp = r.tanpura || (inf.all.includes(7) ? 'P' : inf.all.includes(5) ? 'm' : 'N');
  vs.push(`${swaraText(tp, -1)} <span class="muted small">tanpura</span>`);

  $('detail').innerHTML = `
    <div class="detail-scroll">
      <div class="detail-title"><h2>${esc(r.isThaat ? r.thaat + ' thaat' : r.name)}</h2><span class="muted small">${esc(meta)}</span></div>
      <div class="strip">${strip}</div>
      <div class="kinds">${kinds}</div>
      <div class="facts">
        ${facts.map(([k, v, html]) => `<span class="k">${k}</span><span class="v">${html ? v : esc(v)}</span>`).join('')}
        <span class="k">Notes</span><span class="v plain">${vs.join(' &nbsp;·&nbsp; ')}</span>
      </div>
      ${r.rules && r.rules.length ? `<ul class="rules">${r.rules.map(x => `<li>${esc(formatPhrase(x))}</li>`).join('')}</ul>` : ''}
      <div class="legend">lowercase = komal · M = tivra Ma · dot below = lower octave · dot above = upper octave</div>
      ${r.check ? '<div class="check-note">Some details here were written from memory — worth checking with your teacher or a book. You can edit ragas.js.</div>' : ''}
    </div>
    <div class="detail-actions">
      <button class="btn" id="hearBtn">▶ Hear aaroh–avaroh</button>
      <span class="grow"></span>
      <button class="btn primary" id="useBtn">Play ${esc(r.isThaat ? r.thaat : r.name)}</button>
    </div>`;
  $('hearBtn').onclick = () => togglePreview(r);
  $('useBtn').onclick = () => {
    S.raga = r.name; save();
    buildPads();
    Tanpura.retune();
    closeSheet('browser');
  };
}

// Preview aaroh + avaroh with the harmonium
let preview = null;
function togglePreview(r) {
  if (preview) { stopPreview(); return; }
  unlock();
  const seq = [...tokens(r.aaroh), ...tokens(r.avaroh)];
  let i = 0;
  const btn = $('hearBtn');
  btn.textContent = '■ Stop';
  preview = { voice: null, timer: null };
  const stepFn = () => {
    if (!preview) return;
    if (i >= seq.length) { stopPreview(); return; }
    const t = seq[i++];
    const midi = saMidi() + t.oct * 12 + OFF[t.l];
    if (preview.voice) preview.voice.setPitch(midi, true);
    else preview.voice = harmoniumVoice(midi);
    preview.timer = setTimeout(stepFn, i === Math.ceil(seq.length / 2) ? 700 : 420);
  };
  stepFn();
}
function stopPreview() {
  if (!preview) return;
  clearTimeout(preview.timer);
  if (preview.voice) preview.voice.stop(false);
  preview = null;
  const btn = $('hearBtn');
  if (btn) btn.textContent = '▶ Hear aaroh–avaroh';
}

// ---------- Settings ----------
$('settingsBtn').onclick = () => { renderSettings(); openSheet('settings'); };

const saGrid = $('saGrid');
NOTE_NAMES.forEach((n, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<b>${n}</b><span>${HARMONIUM_KEYS[i]}</span>`;
  b.onclick = () => { S.saPc = i; changedTuning(); };
  saGrid.appendChild(b);
});
$('octDown').onclick = () => { S.saOct = clamp(S.saOct - 1, 2, 4); changedTuning(); };
$('octUp').onclick = () => { S.saOct = clamp(S.saOct + 1, 2, 4); changedTuning(); };
document.querySelectorAll('[data-cents]').forEach(b => {
  b.onclick = () => { S.cents = clamp(S.cents + Number(b.dataset.cents), -50, 50); changedTuning(); };
});
document.querySelectorAll('[data-slide]').forEach(b => { b.onclick = () => { S.slide = b.dataset.slide; save(); renderSettings(); }; });
document.querySelectorAll('[data-first]').forEach(b => { b.onclick = () => { S.first = b.dataset.first; save(); renderSettings(); Tanpura.retune(); }; });
document.querySelectorAll('[data-extra]').forEach(b => { b.onclick = () => { S.extra = b.dataset.extra; save(); renderSettings(); Tanpura.retune(); }; });
document.querySelectorAll('[data-bpm]').forEach(b => {
  b.onclick = () => { S.bpm = clamp(S.bpm + Number(b.dataset.bpm), 30, 140); save(); renderSettings(); };
});
$('balance').addEventListener('input', e => { S.balance = Number(e.target.value); save(); applyBalance(); });

function changedTuning() {
  save();
  renderSettings();
  Tanpura.retune();
}

function renderSettings() {
  [...saGrid.children].forEach((b, i) => b.classList.toggle('sel', i === S.saPc));
  $('saOctLabel').textContent = NOTE_NAMES[S.saPc] + S.saOct;
  $('saHz').textContent = mtof(saMidi()).toFixed(1) + ' Hz';
  $('centsVal').textContent = (S.cents > 0 ? '+' : '') + S.cents;
  document.querySelectorAll('[data-slide]').forEach(b => b.classList.toggle('sel', b.dataset.slide === S.slide));
  document.querySelectorAll('[data-first]').forEach(b => {
    b.classList.toggle('sel', b.dataset.first === S.first);
    if (b.dataset.first === 'auto') b.textContent = 'Auto (' + Tanpura.firstString() + ')';
  });
  document.querySelectorAll('[data-extra]').forEach(b => b.classList.toggle('sel', b.dataset.extra === S.extra));
  $('bpmVal').textContent = S.bpm;
  $('balance').value = S.balance;
  renderPluckChips();
}

function renderPluckChips() {
  // The two middle Sa strings share one chip ("S S"); each chip flashes when its string is plucked.
  const list = Tanpura.strings(), chips = [];
  list.forEach((s, i) => {
    const prev = chips[chips.length - 1];
    if (s.label === 'S' && prev && prev.label === 'S') { prev.idx.push(i); prev.text = 'S S'; }
    else chips.push({ label: s.label, text: s.label, sa: s.sa, idx: [i] });
  });
  $('pluckChips').innerHTML = chips.map(c => `<span class="${c.sa ? 'sa' : ''}" data-idx="${c.idx.join(',')}">${c.text}</span>`).join('');
  const autoBtn = document.querySelector('[data-first="auto"]');
  if (autoBtn) autoBtn.textContent = 'Auto (' + Tanpura.firstString() + ')';
}

// =====================================================================
// Start
// =====================================================================
audio();
buildPads();
renderSettings();
updateTanpuraUI();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
