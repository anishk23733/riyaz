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
const DEFAULTS = { saPc: 1, saOct: 3, cents: 0, raga: 'Yaman', slide: 'glide', first: null, extra: null, bpm: 60, balance: 60 };
const S = Object.assign({}, DEFAULTS, (() => { try { return JSON.parse(localStorage.getItem('riyaz') || '{}'); } catch { return {}; } })());
if (!ALL_RAGAS.has(S.raga)) S.raga = DEFAULTS.raga;
if (S.first === 'auto') S.first = null;
if (S.extra === 'off' && !localStorage.getItem('riyaz-v2')) S.extra = null;
try { localStorage.setItem('riyaz-v2', '1'); } catch {}
const save = () => { try { localStorage.setItem('riyaz', JSON.stringify(S)); } catch {} };

const currentRaga = () => ALL_RAGAS.get(S.raga);
const saMidi = () => 12 * (S.saOct + 1) + S.saPc;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12 + S.cents / 1200);

// =====================================================================
// Audio engine
// =====================================================================
let ctx = null, master, notesBus, tanpuraBus, reedWave, reedBus, noiseBuf;

function audio() {
  if (ctx && ctx.state !== 'closed') return ctx;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {} // play with silent switch on (iOS 17+)
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8; comp.knee.value = 12; comp.ratio.value = 2.5;
  comp.attack.value = 0.012; comp.release.value = 0.3; // gentle: no 'punch' when a note starts
  comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
  notesBus = ctx.createGain(); notesBus.connect(master);
  tanpuraBus = ctx.createGain(); tanpuraBus.connect(master);
  // --- Harmonium model ---
  // Free reeds vibrate like a narrow pulse: buzzy, with notches in the spectrum.
  const N = 80, real = new Float32Array(N), imag = new Float32Array(N), duty = 0.23;
  for (let n = 1; n < N; n++) imag[n] = Math.abs(Math.sin(Math.PI * n * duty)) / n * Math.exp(-n / 55);
  reedWave = ctx.createPeriodicWave(real, imag);

  // Shared "instrument body": bellows wobble -> wooden-box resonances -> soften the top end.
  reedBus = ctx.createGain();
  const bellows = ctx.createGain(); bellows.gain.value = 1;
  const lfo1 = ctx.createOscillator(), lfo1g = ctx.createGain();
  lfo1.frequency.value = 0.55; lfo1g.gain.value = 0.06;      // slow pumping of the bellows
  const lfo2 = ctx.createOscillator(), lfo2g = ctx.createGain();
  lfo2.frequency.value = 4.7; lfo2g.gain.value = 0.015;      // slight air-pressure flutter
  lfo1.connect(lfo1g).connect(bellows.gain); lfo2.connect(lfo2g).connect(bellows.gain);
  lfo1.start(); lfo2.start();
  const body1 = ctx.createBiquadFilter(); body1.type = 'peaking'; body1.frequency.value = 850; body1.Q.value = 1.2; body1.gain.value = 4;
  const body2 = ctx.createBiquadFilter(); body2.type = 'peaking'; body2.frequency.value = 2300; body2.Q.value = 1.5; body2.gain.value = 5;
  const box = ctx.createBiquadFilter(); box.type = 'peaking'; box.frequency.value = 300; box.Q.value = 0.9; box.gain.value = -3;
  const top = ctx.createBiquadFilter(); top.type = 'lowpass'; top.frequency.value = 6500; top.Q.value = 0.5;
  reedBus.connect(bellows).connect(box).connect(body1).connect(body2).connect(top).connect(notesBus);

  // A little air noise for the reeds.
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  applyBalance();
  return ctx;
}
// ---------- Keeping audio alive on iPhone ----------
// iOS can suspend, interrupt (calls, Siri, other apps, screen lock) or silently stall the
// audio engine. We resume it on every touch, watch that its clock keeps moving, and if it
// has died, rebuild it from scratch — no page reload needed.
function unlock() {
  audio();
  if (ctx.state === 'running') return;
  const c = ctx;
  c.resume().then(() => {
    setTimeout(() => { if (ctx === c && c.state !== 'running') rebuildAudio(); }, 400);
  }).catch(() => rebuildAudio());
}
function rebuildAudio() {
  const tanpuraWasOn = Tanpura.playing;
  if (tanpuraWasOn) Tanpura.stop();
  if (typeof releaseAll === 'function') releaseAll();
  const old = ctx;
  ctx = null;
  try { old && old.close(); } catch {}
  audio();
  Tanpura.cache.clear();
  decodeHarmonium();
  if (tanpuraWasOn) Tanpura.start();
}
let lastClock = -1, stalls = 0;
setInterval(() => {
  if (!ctx || document.hidden) return;
  if (ctx.state === 'running') {
    if (ctx.currentTime === lastClock) { if (++stalls >= 2) { stalls = 0; rebuildAudio(); } }
    else stalls = 0;
    lastClock = ctx.currentTime;
  } else if (ctx.state !== 'closed') {
    ctx.resume().catch(() => {});
  }
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });
window.addEventListener('pageshow', () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });
['touchend', 'click'].forEach(t => window.addEventListener(t, unlock, { passive: true }));

function applyBalance() {
  if (!ctx) return;
  const b = S.balance / 100; // 0 = tanpura louder, 1 = notes louder
  notesBus.gain.value = Math.min(1, b * 2) * 0.9;
  tanpuraBus.gain.value = Math.min(1, (1 - b) * 2) * 0.9;
}

// One sustained harmonium voice whose pitch can glide (meend).
// Like a real 2-reed harmonium: the main reed, a second reed tuned a few cents sharp
// (the gentle beating you hear on a real one) and a lower-octave "bass" reed.
let lastNoteOn = -1e9;
const VOICE_LEVEL = 0.085;

// Every new note goes through here. Real recorded harmonium once loaded; until then the
// generated harmonium. In fast playing (taans) notes must speak instantly and in tune.
function harmoniumVoice(midi) {
  const nowMs = performance.now();
  const quick = nowMs - lastNoteOn < 300 || (typeof touches !== 'undefined' && touches.size > 1);
  lastNoteOn = nowMs;
  return Harm.ready ? sampledVoice(midi, quick) : synthVoice(midi, quick);
}

// ---------- Recorded harmonium ----------
// Samples: harmonium recorded at Yale's Euterpea Studio (Freesound #330410 by donyaquick, CC0),
// cut into single notes by tonejs-instruments (CC-BY 3.0); loop points added for this app.
const Harm = { list: [], raw: new Map(), ready: false };
async function loadHarmonium() {
  try {
    const list = await (await fetch('harmonium/samples.json')).json();
    await Promise.all(list.map(async s => Harm.raw.set(s.file, await (await fetch('harmonium/' + s.file)).arrayBuffer())));
    Harm.list = list;
    await decodeHarmonium();
  } catch (e) { console.warn('Harmonium samples unavailable, using generated sound', e); }
}
async function decodeHarmonium() {
  if (!Harm.list.length) return;
  Harm.ready = false;
  const c = audio();
  await Promise.all(Harm.list.map(s => new Promise((ok, fail) => c.decodeAudioData(Harm.raw.get(s.file).slice(0), b => { s.buf = b; ok(); }, fail))));
  Harm.ready = Harm.list.every(s => s.buf);
}
function nearestSample(m) {
  let best = Harm.list[0];
  for (const s of Harm.list) if (Math.abs(s.midi - m) < Math.abs(best.midi - m)) best = s;
  return best;
}
const rateFor = (m, s) => mtof(m) / (440 * Math.pow(2, (s.midi - 69) / 12));
const SAMPLE_LEVEL = 0.9;

function sampledVoice(midi, quick) {
  const c = audio(), t = c.currentTime;
  const out = c.createGain();
  // Onset: fast enough to feel instant, slow enough not to thump (~15 ms; 25 ms for a phrase's first note)
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(SAMPLE_LEVEL, t + (quick ? 0.015 : 0.025));
  out.connect(notesBus);
  let stopped = false, swapTimer = null, target = midi;
  // One looping recording, pitch-shifted to the note; meend bends its playback rate.
  function layer(m, when, fade, offset) {
    const s = nearestSample(m);
    const src = c.createBufferSource();
    src.buffer = s.buf; src.loop = true; src.loopStart = s.loopStart; src.loopEnd = s.loopEnd;
    src.playbackRate.setValueAtTime(rateFor(m, s), when);
    const g = c.createGain();
    g.gain.setValueAtTime(fade ? 0 : 1, when);
    if (fade) g.gain.linearRampToValueAtTime(1, when + fade);
    src.connect(g).connect(out);
    src.start(when, offset);
    return { s, src, g };
  }
  // First note of a phrase uses the recorded attack; fast notes start in the steady tone.
  let cur = layer(midi, t, 0, quick ? 0.35 : 0.01);
  return {
    setPitch(m, tc) {
      if (stopped) return;
      target = m;
      const tt = c.currentTime;
      cur.src.playbackRate.cancelScheduledValues(tt);
      cur.src.playbackRate.setTargetAtTime(rateFor(m, cur.s), tt, tc);
      // Once the pitch settles far from this recording, crossfade to the nearest recorded note
      // so the timbre stays natural.
      clearTimeout(swapTimer);
      if (nearestSample(m) === cur.s) return;
      swapTimer = setTimeout(() => {
        if (stopped || target !== m) return;
        const t2 = c.currentTime, old = cur;
        cur = layer(m, t2, 0.06, cur.s.loopStart + Math.random() * 0.4);
        old.g.gain.setValueAtTime(1, t2);
        old.g.gain.linearRampToValueAtTime(0, t2 + 0.06);
        old.src.stop(t2 + 0.12);
      }, Math.max(40, tc * 4000));
    },
    articulate() {
      if (stopped) return;
      const tt = c.currentTime;
      out.gain.cancelScheduledValues(tt);
      out.gain.setValueAtTime(out.gain.value, tt);
      out.gain.setTargetAtTime(SAMPLE_LEVEL * 0.55, tt, 0.003);
      out.gain.setTargetAtTime(SAMPLE_LEVEL, tt + 0.011, 0.006);
    },
    stop(fast) {
      if (stopped) return;
      stopped = true;
      clearTimeout(swapTimer);
      const tt = c.currentTime;
      out.gain.cancelScheduledValues(tt);
      out.gain.setValueAtTime(out.gain.value, tt);
      out.gain.setTargetAtTime(0, tt, fast ? 0.01 : 0.03);
      cur.src.stop(tt + 0.4);
    },
  };
}

// ---------- Generated harmonium (fallback while samples load) ----------
function synthVoice(midi, quick) {
  const c = audio(), t = c.currentTime, f = mtof(midi);
  const reeds = [
    { ratio: 1, detune: 0, level: 1 },
    { ratio: 1, detune: 4, level: 0.55 },
    { ratio: 0.5, detune: -2, level: 0.5 },
  ];
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.setTargetAtTime(VOICE_LEVEL, t, quick ? 0.006 : 0.012);
  g.connect(reedBus);
  const oscs = reeds.map(r => {
    const o = c.createOscillator(), lv = c.createGain();
    o.setPeriodicWave(reedWave);
    o.detune.value = r.detune;
    if (quick) {
      o.frequency.setValueAtTime(f * r.ratio, t);
    } else {
      // a phrase's first note: reed starts a hair flat and settles onto pitch
      o.frequency.setValueAtTime(f * r.ratio * 0.996, t);
      o.frequency.setTargetAtTime(f * r.ratio, t, 0.02);
    }
    lv.gain.value = r.level;
    o.connect(lv).connect(g);
    o.start(t);
    return { o, ratio: r.ratio };
  });
  // breathy air noise, mostly at the attack
  const nz = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
  nz.buffer = noiseBuf; nz.loop = true; nz.loopStart = Math.random();
  nf.type = 'bandpass'; nf.frequency.value = 2800; nf.Q.value = 0.8;
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(0.02, t + 0.02);
  ng.gain.setTargetAtTime(0.012, t + 0.012, 0.05);
  nz.connect(nf).connect(ng).connect(g);
  nz.start(t);
  let stopped = false;
  return {
    setPitch(m, tc) {
      if (stopped) return;
      const tt = c.currentTime, ff = mtof(m);
      for (const { o, ratio } of oscs) {
        o.frequency.cancelScheduledValues(tt);
        o.frequency.setTargetAtTime(ff * ratio, tt, tc);
      }
    },
    // A tiny dip in volume, so consecutive notes in a fast run are heard as separate notes.
    articulate() {
      if (stopped) return;
      const tt = c.currentTime;
      g.gain.cancelScheduledValues(tt);
      g.gain.setValueAtTime(g.gain.value, tt);
      g.gain.setTargetAtTime(VOICE_LEVEL * 0.55, tt, 0.003);
      g.gain.setTargetAtTime(VOICE_LEVEL, tt + 0.011, 0.006);
    },
    stop(fast) {
      if (stopped) return;
      stopped = true;
      const tt = c.currentTime;
      g.gain.cancelScheduledValues(tt);
      g.gain.setValueAtTime(g.gain.value, tt);
      g.gain.setTargetAtTime(0, tt, fast ? 0.01 : 0.028);
      for (const { o } of oscs) o.stop(tt + 0.5);
      nz.stop(tt + 0.5);
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

// A raga's usual tanpura tuning: first string from the data (or P, else m, else N),
// extra string only where the raga data names one.
function ragaTanpura(r) {
  const all = ragaInfo(r).all;
  const first = r.tanpura || (all.includes(7) ? 'P' : all.includes(5) ? 'm' : 'N');
  return { first, extra: r.tanpuraExtra || 'off' };
}
const STRING_ORDER = ['P', 'm', 'M', 'd', 'D', 'N', 'G'];
const STRING_SEMI = { P: -5, m: -7, M: -6, N: -1, d: -4, D: -3, G: -8 }; // relative to madhya Sa, in mandra

const Tanpura = {
  playing: false, timer: null, nextTime: 0, idx: 0, gen: 0,
  cache: new Map(), last: new Map(),

  firstString() { return S.first || ragaTanpura(currentRaga()).first; },
  extraString() { return S.extra || ragaTanpura(currentRaga()).extra; },
  strings() {
    const first = this.firstString();
    const list = [{ label: swaraText(first, -1), semi: STRING_SEMI[first] }];
    const extra = this.extraString();
    if (extra !== 'off' && extra !== first) list.push({ label: swaraText(extra, -1), semi: STRING_SEMI[extra] });
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

// Swaras that share a name (r/R, g/G, m/M, d/D, n/N). If a raga uses both forms, they share
// one split pad: the higher form (R G M D N) on top, the lower form (r g m d n) below.
const SWARA_GROUPS = [[0], [1, 2], [3, 4], [5, 6], [7], [8, 9], [10, 11]];
const heldCount = new Map(); // element -> number of fingers on it

function swaraTag(r, off) {
  if (r.isThaat) return '';
  const letter = LETTERS[off];
  if (r.vadi === letter) return 'vadi';
  if (r.samvadi === letter) return 'samvadi';
  if (!info.upSet.has(off)) return 'avaroh only';
  if (!info.dnSet.has(off)) return 'aaroh only';
  return '';
}

function buildPads() {
  const r = currentRaga();
  info = ragaInfo(r);
  const cols = SWARA_GROUPS.map(g => g.filter(o => info.all.includes(o))).filter(g => g.length);
  info.colsPerOctave = cols.length;
  pads = [];
  for (let oct = -1; oct <= 1; oct++) for (const offs of cols) pads.push({ oct, offs });
  pads.push({ oct: 2, offs: [0] });

  track.innerHTML = '';
  heldCount.clear();
  for (const p of pads) {
    p.split = p.offs.length === 2;
    p.lo = p.offs[0];
    p.hi = p.offs[p.offs.length - 1];
    const el = document.createElement('div');
    if (p.split) {
      el.className = 'pad split';
      el.innerHTML =
        `<div class="half hi"><span class="sw">${swaraText(LETTERS[p.hi], p.oct)}</span><span class="tag">${swaraTag(r, p.hi)}</span></div>` +
        `<div class="half lo"><span class="sw">${swaraText(LETTERS[p.lo], p.oct)}</span><span class="tag">${swaraTag(r, p.lo)}</span></div>`;
      p.hiEl = el.children[0];
      p.loEl = el.children[1];
    } else {
      // Zig-zag: S up · R G down · M P up · D N down
      const up = [0, 5, 6, 7].includes(p.lo);
      el.className = 'pad' + (up ? '' : ' down') + (p.lo === 0 ? ' sa' : '');
      el.innerHTML = `<span class="sw">${swaraText(LETTERS[p.lo], p.oct)}</span><span class="tag">${swaraTag(r, p.lo)}</span>`;
    }
    track.appendChild(el);
    p.el = el;
  }

  // minimap: one tick per pad column
  minimap.querySelectorAll('.tick').forEach(t => t.remove());
  for (const p of pads) {
    const t = document.createElement('span');
    t.className = 'tick' + (p.lo === 0 ? ' sa' : '');
    minimap.insertBefore(t, mmWindow);
    p.tick = t;
  }
  for (const l of $('mmLabels').children) l.style.width = (cols.length * 12) + 'px';
  $('mmLabels').style.paddingLeft = '3px';

  layout();
  resetScroll();
  updateHeader();
}

function layout() {
  const W = stage.clientWidth;
  step = Math.max(58, W / (info.colsPerOctave + 2));
  pads.forEach((p, i) => { p.el.style.left = (i * step + 3) + 'px'; p.el.style.width = (step - 6) + 'px'; });
  track.style.width = pads.length * step + 'px';
  clampScroll();
  applyScroll(false);
}
const maxScroll = () => Math.max(0, pads.length * step - stage.clientWidth);
const clampScroll = () => { scrollX = clamp(scrollX, 0, maxScroll()); };
function resetScroll() {
  const i = pads.findIndex(p => p.oct === 0 && p.lo === 0);
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
  $('navLeft').disabled = scrollX <= 1;
  $('navRight').disabled = scrollX >= maxScroll() - 1;
}
function slideBy(nPads) {
  // snap so a pad edge sits at the half-pad position
  scrollX = Math.round((scrollX + 0.5 * step) / step + nPads) * step - 0.5 * step;
  clampScroll();
  applyScroll(true);
}

// ---------- which note a pad plays ----------
const offMidi = (i, off) => saMidi() + pads[i].oct * 12 + off;
const EDGE = 0.12; // fraction of a pad you must cross past the edge before switching (no flicker)
function padAt(p, current) {
  if (current >= 0 && p >= current - EDGE && p < current + 1 + EDGE) return current;
  return clamp(Math.floor(p), 0, pads.length - 1);
}

// Smart choice for split pads (e.g. n/N in Khamaj):
//  1. If you deliberately touched or moved to a half of this pad, that half wins.
//  2. Otherwise, when sliding, use the form the raga uses in that direction
//     (aaroh going up, avaroh coming down) — e.g. Khamaj: N going up, n coming down.
//  3. Otherwise, whichever half your finger is on.
function variantOf(i, tch) {
  const p = pads[i];
  if (!p.split) return p.lo;
  if (tch.choice != null && tch.choiceIdx === i) return tch.choice;
  const dirSet = tch.dir > 0 ? info.upSet : tch.dir < 0 ? info.dnSet : null;
  if (dirSet) {
    const c = p.offs.filter(o => dirSet.has(o));
    if (c.length === 1) return c[0];
  }
  return tch.yHalf === 'hi' ? p.hi : p.lo;
}
const elFor = (i, off) => { const p = pads[i]; return !p.split ? p.el : off === p.hi ? p.hiEl : p.loEl; };

// ---------- Meend ----------
// While the finger moves, pitch follows it continuously along the raga's notes. Each pad's
// middle holds the exact note and the pitch curves smoothly (slow–fast–slow) between pads,
// so P→R in Yaman is one unbroken glide that brushes M and G on the way. The moment the
// finger pauses, the pitch eases onto the nearest raga note, so it never rests off-raga.
const HOLD = 0.2;           // part of each pad (either side of its middle) that holds the exact note
const MEEND_SMOOTH = 0.045; // smoothing (s) — removes finger jitter so the curve sounds sung
const SETTLE_MS = 70;       // pause this long and the pitch settles onto the nearest note
const TAAN_SPEED = 5;       // pads per second; faster than this = taan (crisp notes, no glide)
function meendPitch(p, tch) {
  const N = pads.length, q = p - 0.5, i = Math.floor(q), t = q - i;
  if (i < 0) return offMidi(0, variantOf(0, tch));
  if (i >= N - 1) return offMidi(N - 1, variantOf(N - 1, tch));
  let s = t <= HOLD ? 0 : t >= 1 - HOLD ? 1 : (t - HOLD) / (1 - 2 * HOLD);
  s = s * s * (3 - 2 * s);
  const a = offMidi(i, variantOf(i, tch)), b = offMidi(i + 1, variantOf(i + 1, tch));
  return a + (b - a) * s;
}
const nearestPad = p => clamp(Math.round(p - 0.5), 0, pads.length - 1);

// Light up exactly the pad (or half-pad) a finger is sounding.
function showHeld(tch, el) {
  if (tch.heldEl === el) return;
  if (tch.heldEl) {
    const n = (heldCount.get(tch.heldEl) || 1) - 1;
    heldCount.set(tch.heldEl, n);
    if (n <= 0) tch.heldEl.classList.remove('on');
  }
  tch.heldEl = el;
  if (el) { heldCount.set(el, (heldCount.get(el) || 0) + 1); el.classList.add('on'); }
}

// ---------- gestures ----------
// In portrait the whole app is drawn rotated 90° (see style.css), so the app's
// "horizontal" axis is the screen's vertical one. These map screen touches into app space.
const portraitMQ = matchMedia('(orientation: portrait)');
const ax = e => portraitMQ.matches ? e.clientY : e.clientX;      // along the pads
const ay = e => portraitMQ.matches ? -e.clientX : e.clientY;     // across the pads
const startOf = el => { const r = el.getBoundingClientRect(); return portraitMQ.matches ? r.top : r.left; };
// 0 = top of the pads, 1 = bottom (in app space)
function yFrac(e, rect) {
  return portraitMQ.matches ? (rect.right - e.clientX) / rect.width : (e.clientY - rect.top) / rect.height;
}
function updateYHalf(tch, e) {
  const f = yFrac(e, tch.rect);
  if (f < 0.46) tch.yHalf = 'hi';
  else if (f > 0.54) tch.yHalf = 'lo';
}

// One finger always plays (and slides = meend). Two fingers that land together and
// move sideways together scroll the strip instead.
const touches = new Map();
let scrolling = null, stageLeft = 0;

stage.addEventListener('pointerdown', e => {
  e.preventDefault();
  unlock();
  stageLeft = startOf(stage);
  const p = (ax(e) - stageLeft + scrollX) / step;
  const tch = {
    id: e.pointerId, x0: ax(e), y0: ay(e), x: ax(e), y: ay(e), t0: performance.now(),
    voice: null, idx: -1, rect: stage.getBoundingClientRect(), yHalf: 'hi', dir: 0, lastRaw: p,
    choice: null, choiceIdx: -1, heldEl: null,
  };
  updateYHalf(tch, e);
  touches.set(e.pointerId, tch);
  if (scrolling) { scrolling.ids.add(e.pointerId); return; }
  const idx = padAt(p, -1);
  tch.idx = idx;
  tch.p0 = p;
  tch.shift = (idx + 0.5) - p;
  if (pads[idx].split) { tch.choice = tch.yHalf === 'hi' ? pads[idx].hi : pads[idx].lo; tch.choiceIdx = idx; }
  const off = variantOf(idx, tch);
  tch.off = off;
  tch.voice = harmoniumVoice(offMidi(idx, off));
  showHeld(tch, elFor(idx, off));
});

window.addEventListener('pointermove', e => {
  const tch = touches.get(e.pointerId);
  if (!tch) return;
  tch.x = ax(e); tch.y = ay(e);

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
      for (const t of [a, b]) { if (t.voice) t.voice.stop(true); showHeld(t, null); t.voice = null; t.idx = -1; }
      scrolling = { ids: new Set([a.id, b.id]), startScroll: scrollX, startAvg: (a.x0 + b.x0) / 2 };
      return;
    }
  }

  if (!tch.voice) return;
  const raw = (ax(e) - stageLeft + scrollX) / step;
  if (Math.abs(raw - tch.lastRaw) > 0.03) { tch.dir = Math.sign(raw - tch.lastRaw); tch.lastRaw = raw; }
  const prevHalf = tch.yHalf;
  updateYHalf(tch, e);

  // Moving up/down within a split pad is a deliberate choice of form (and a meend between them).
  const curIdx = S.slide === 'steps' ? padAt(raw, tch.idx) : nearestPad(raw + tch.shift * Math.max(0, 1 - Math.abs(raw - tch.p0)));
  if (curIdx !== tch.choiceIdx) { tch.choice = null; tch.choiceIdx = -1; }
  if (pads[curIdx].split && tch.yHalf !== prevHalf) {
    tch.choice = tch.yHalf === 'hi' ? pads[curIdx].hi : pads[curIdx].lo;
    tch.choiceIdx = curIdx;
  }

  if (S.slide === 'steps') {
    const off = variantOf(curIdx, tch);
    if (curIdx === tch.idx && off === tch.off) return;
    tch.voice.setPitch(offMidi(curIdx, off), 0.003);
    tch.idx = curIdx; tch.off = off;
    showHeld(tch, elFor(curIdx, off));
    return;
  }

  // Meend. Where you first touched always sounds that pad's exact note; that offset fades
  // out over the first pad of movement, so the pitch stays in line with your finger.
  const moved = Math.abs(raw - tch.p0);
  if (moved < 0.12) {
    // still on the first pad: only a vertical change of form (split pad) changes the note
    const off = variantOf(tch.idx, tch);
    if (off !== tch.off) {
      tch.off = off;
      tch.voice.setPitch(offMidi(tch.idx, off), MEEND_SMOOTH * 1.5);
      showHeld(tch, elFor(tch.idx, off));
    }
    return;
  }
  const p = raw + tch.shift * Math.max(0, 1 - moved);
  // How fast is the finger moving (pads per second)? Slow = meend, fast = crisp taan.
  const now = performance.now();
  if (tch.lastT) {
    const inst = Math.abs(p - tch.lastP) / Math.max(1, now - tch.lastT) * 1000;
    tch.speed = 0.6 * (tch.speed || 0) + 0.4 * inst;
  }
  tch.lastT = now; tch.lastP = p;
  const idx = nearestPad(p), off = variantOf(idx, tch);
  const changed = idx !== tch.idx || off !== tch.off;
  if (tch.speed > TAAN_SPEED) {
    // Taan: jump almost straight to each exact note, with a tiny articulation between notes.
    if (changed) { tch.voice.setPitch(offMidi(idx, off), 0.006); tch.voice.articulate(); }
  } else {
    tch.voice.setPitch(meendPitch(p, tch), MEEND_SMOOTH);
  }
  tch.idx = idx; tch.off = off;
  showHeld(tch, elFor(idx, off));
  clearTimeout(tch.settle);
  tch.settle = setTimeout(() => {
    if (!tch.voice) return;
    const i2 = nearestPad(p), o2 = variantOf(i2, tch);
    tch.voice.setPitch(offMidi(i2, o2), 0.05);
  }, SETTLE_MS);
});

function endTouch(e) {
  const tch = touches.get(e.pointerId);
  if (!tch) return;
  touches.delete(e.pointerId);
  clearTimeout(tch.settle);
  if (tch.voice) tch.voice.stop(false);
  showHeld(tch, null);
  if (scrolling) {
    scrolling.ids.delete(e.pointerId);
    if (scrolling.ids.size === 0) { scrolling = null; slideBy(0); }
  }
}
window.addEventListener('pointerup', endTouch);
window.addEventListener('pointercancel', endTouch);

function releaseAll() {
  for (const t of touches.values()) { clearTimeout(t.settle); if (t.voice) t.voice.stop(true); }
  touches.clear();
  scrolling = null;
  heldCount.clear();
  track.querySelectorAll('.on').forEach(el => el.classList.remove('on'));
}

$('navLeft').onclick = () => slideBy(-4);
$('navRight').onclick = () => slideBy(4);

// Minimap: tap or drag to jump
function minimapJump(e, anim) {
  const idx = (ax(e) - startOf(minimap) - 3) / 12;
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
portraitMQ.addEventListener('change', () => { releaseAll(); if (info) requestAnimationFrame(layout); });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
window.addEventListener('pagehide', () => releaseAll());
window.addEventListener('blur', () => releaseAll());

// Failsafe against stuck notes: iOS occasionally loses a finger-lift event (e.g. when a system
// gesture interrupts). If no fingers are on the screen at all, nothing should be sounding.
['touchend', 'touchcancel'].forEach(type => window.addEventListener(type, e => {
  if (e.touches.length === 0 && touches.size > 0) releaseAll();
}, { passive: true }));

// No zooming: iOS ignores the viewport's no-zoom setting, so block double-tap and pinch zoom here.
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));

// Which side is the camera on in landscape? Only that side needs to stay clear.
function updateNotchSide() {
  const a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
  document.documentElement.dataset.notch = a === 90 ? 'left' : (a === 270 || a === -90) ? 'right' : 'none';
}
updateNotchSide();
window.addEventListener('orientationchange', updateNotchSide);
window.addEventListener('resize', updateNotchSide);

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
    S.raga = r.name;
    S.first = null; S.extra = null; // use this raga's tuning until you change it
    save();
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
    if (preview.voice) preview.voice.setPitch(midi, 0.025);
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
// Tanpura string chips: the raga's usual choice is marked with a dot.
function renderStringChips() {
  const def = ragaTanpura(currentRaga());
  const firstOpts = STRING_ORDER.filter(x => ['P', 'm', 'N', def.first].includes(x));
  const extraOpts = ['off', ...STRING_ORDER.filter(x => ['N', 'm', 'G', def.extra].includes(x))];
  const chip = (kind, val, cur, isDef) =>
    `<button data-${kind}="${val}" class="${val === cur ? 'sel' : ''}${isDef ? ' def' : ''}">${val === 'off' ? 'Off' : swaraText(val, -1)}</button>`;
  $('firstChips').innerHTML = firstOpts.map(v => chip('first', v, Tanpura.firstString(), v === def.first)).join('');
  $('extraChips').innerHTML = extraOpts.map(v => chip('extra', v, Tanpura.extraString(), v === def.extra)).join('');
  $('firstChips').querySelectorAll('button').forEach(b => { b.onclick = () => { S.first = b.dataset.first === def.first ? null : b.dataset.first; save(); renderSettings(); Tanpura.retune(); }; });
  $('extraChips').querySelectorAll('button').forEach(b => { b.onclick = () => { S.extra = b.dataset.extra === def.extra ? null : b.dataset.extra; save(); renderSettings(); Tanpura.retune(); }; });
}
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
  renderStringChips();
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
}

// =====================================================================
// Start
// =====================================================================
audio();
loadHarmonium();
buildPads();
renderSettings();
updateTanpuraUI();

// Updates: check for a new version on launch and whenever the app comes back to the foreground.
// If one is found right at launch, reload into it immediately; if you're already practising,
// wait until you next leave and return to the app, so it never interrupts you.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let updatePending = false, reg = null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install, nothing to update
    const busy = Tanpura.playing || touches.size > 0 || performance.now() > 8000;
    if (busy) updatePending = true; else location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (updatePending && !Tanpura.playing) location.reload();
    else if (reg) reg.update().catch(() => {});
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { reg = r; }).catch(() => {});
  });
}
