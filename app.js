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
// Free play: all 12 swaras, every swara with two forms on a split pad, no raga rules.
const FREE_PLAY = {
  name: 'Free play', thaat: '', isFree: true, time: '',
  aaroh: "S r R g G m M P d D n N S'", avaroh: "S' N n D d P M m G g R r S",
};
ALL_RAGAS.set(FREE_PLAY.name, FREE_PLAY);

// Ragas whose swaras fit none of the 10 thaats use thaat: 'Other' (shown in their own group).
const OTHER = 'Other';
const thaatLabel = r => r.thaat === OTHER ? 'no thaat' : r.thaat + ' thaat';

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
const DEFAULTS = { taal: 'Teentaal', tablaVol: 0.8, bayanVol: 0.7, saPc: 1, saOct: 3, cents: 0, raga: 'Yaman', slide: 'glide', second: 'pull', first: null, extra: null, bpm: 80, balance: 60 };
const S = Object.assign({}, DEFAULTS, (() => { try { return JSON.parse(localStorage.getItem('riyaz') || '{}'); } catch { return {}; } })());
if (!ALL_RAGAS.has(S.raga)) S.raga = DEFAULTS.raga;
if (S.first === 'auto') S.first = null;
// One shared tempo for tabla and tanpura (older versions stored a separate tabla tempo)
if (typeof S.tablaBpm === 'number') { S.bpm = S.tablaBpm; delete S.tablaBpm; }
if (typeof S.bpm !== 'number' || S.bpm === 60 && !localStorage.getItem('riyaz-tempo')) S.bpm = 80;
try { localStorage.setItem('riyaz-tempo', '1'); } catch {}
if (S.extra === 'off' && !localStorage.getItem('riyaz-v2')) S.extra = null;
try { localStorage.setItem('riyaz-v2', '1'); } catch {}
// Settings are saved on the phone (localStorage), with a backup copy in the app's offline
// storage in case iOS ever clears the main copy. (Note: Safari and the home-screen app have
// separate storage on iPhone — settings made in one don't appear in the other.)
const SETTINGS_BACKUP = 'riyaz-settings';
const save = () => {
  try { localStorage.setItem('riyaz', JSON.stringify(S)); } catch {}
  try {
    if ('caches' in window) caches.open(SETTINGS_BACKUP).then(c => c.put('settings.json', new Response(JSON.stringify(S), { headers: { 'Content-Type': 'application/json' } }))).catch(() => {});
  } catch {}
};
// Ask the browser to keep this app's data permanently (not cleared when space runs low).
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch {}
const hadSavedSettings = (() => { try { return !!localStorage.getItem('riyaz'); } catch { return false; } })();

const currentRaga = () => ALL_RAGAS.get(S.raga);
const saMidi = () => 12 * (S.saOct + 1) + S.saPc;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12 + S.cents / 1200);

// =====================================================================
// Audio engine
// =====================================================================
let ctx = null, master, notesBus, tanpuraBus, tablaBus, reedWave, reedBus, noiseBuf;

function audio() {
  if (ctx && ctx.state !== 'closed') return ctx;
  // play with silent switch on (iOS 17+); while singing, the session must also record
  try { if (navigator.audioSession) navigator.audioSession.type = typeof Sing !== 'undefined' && Sing.listening ? 'play-and-record' : 'playback'; } catch {}
  // Ask for the lowest output latency the device allows (matters for fast taans).
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 0 });
  // Zero-latency soft clip as the safety limiter (a compressor adds ~6 ms of lookahead delay).
  const clip = ctx.createWaveShaper();
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) { const x = i / (curve.length - 1) * 2 - 1; curve[i] = Math.tanh(1.2 * x) / Math.tanh(1.2); }
  clip.curve = curve;
  clip.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(clip);
  notesBus = ctx.createGain(); notesBus.connect(master);
  tanpuraBus = ctx.createGain(); tanpuraBus.connect(master);
  tablaBus = ctx.createGain(); tablaBus.gain.value = S.tablaVol; tablaBus.connect(master);
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
  const tanpuraWasOn = Tanpura.playing, tablaWasOn = Tabla.playing;
  if (tablaWasOn) Tabla.stop();
  if (tanpuraWasOn) Tanpura.stop();
  if (typeof releaseAll === 'function') releaseAll();
  const old = ctx;
  ctx = null;
  try { old && old.close(); } catch {}
  audio();
  Tanpura.cache.clear();
  decodeHarmonium();
  decodeTanpura();
  decodeTabla();
  if (tablaWasOn) Tabla.start();
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
// Each recording's true pitch (measured from its loop; they're a few cents sharp, by different amounts).
const sampleHz = s => 440 * Math.pow(2, (s.midi - 69) / 12 + (s.cents || 0) / 1200);
const rateFor = (m, s) => mtof(m) / sampleHz(s);
const SAMPLE_LEVEL = 1.0;
const BLEND = 0.15;     // semitones either side of the switch point between two recordings where they're blended
const XFADE = 0.03;     // a change of recording always takes at least this long (s): no phasey flicker, yet
                        // short enough that a recording isn't heard pitch-shifted far from its own note
const GAIN_STEP = 0.004; // spacing (s) of the scheduled blend points
const STEP_XF = 0.02;    // a key change (no glide): old and new note overlap this long (s), like legato on a real harmonium

// There's a recording for (nearly) every semitone, so a note is shifted by at most half a
// semitone and every exact note plays its own recording. Between recordings a and b the switch
// happens halfway (if a note is missing, at the half-semitone past it, never on a note).
function switchPoint(a, b) { const g = b.midi - a.midi; return a.midi + (g % 2 ? g / 2 : g / 2 + 0.5); }
// The mix of recordings for pitch m as linear fractions { index: share } (shares add up to 1).
function sampleMix(m) {
  const L = Harm.list;
  if (m <= L[0].midi) return { 0: 1 };
  if (m >= L[L.length - 1].midi) return { [L.length - 1]: 1 };
  let i = 0;
  while (L[i + 1].midi <= m) i++;
  const c = switchPoint(L[i], L[i + 1]);
  if (m <= c - BLEND) return { [i]: 1 };
  if (m >= c + BLEND) return { [i + 1]: 1 };
  const f = (m - (c - BLEND)) / (2 * BLEND);
  return { [i]: 1 - f, [i + 1]: f };
}
// Shares -> equal-power gains (two unrelated recordings add up in power, not amplitude).
function mixGains(a) {
  let n = 0;
  for (const k in a) n += a[k] * a[k];
  n = Math.sqrt(n) || 1;
  const g = {};
  for (const k in a) g[k] = a[k] / n;
  return g;
}
// Which recordings to hear at a pitch, and how loud (depends only on the pitch, so a note sounds
// the same whether you tap it or slide to it).
function sampleWeights(m) {
  const g = mixGains(sampleMix(m));
  return Object.keys(g).map(k => [Harm.list[k], g[k]]);
}

function sampledVoice(midi, quick) {
  const c = audio(), t = c.currentTime;
  const out = c.createGain();
  // Onset: ~6 ms for fast taps (they start in the steady tone, so no thump); 15 ms for a phrase's first note
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(SAMPLE_LEVEL, t + (quick ? 0.006 : 0.015));
  out.connect(notesBus);
  const layers = new Map(); // recording index -> { src, g, pts: [[time, gain], ...] scheduled }
  let stopped = false;
  // The pitch as scheduled: playbackRate approaches the target exponentially (setTargetAtTime),
  // so the pitch at any moment is known exactly; new layers start at exactly that pitch.
  let P = { t, v: midi, m: midi, tc: 1 };
  const pitchAt = tt => {
    if (tt <= P.t) return P.v;
    const r0 = Math.pow(2, P.v / 12), r1 = Math.pow(2, P.m / 12);
    return 12 * Math.log2(r1 + (r0 - r1) * Math.exp(-(tt - P.t) / P.tc));
  };
  const gainAt = (L, tt) => {
    const p = L.pts;
    if (!p.length || tt <= p[0][0]) return p.length ? p[0][1] : 0;
    for (let k = 1; k < p.length; k++) {
      if (tt <= p[k][0]) return p[k - 1][1] + (p[k][1] - p[k - 1][1]) * (tt - p[k - 1][0]) / (p[k][0] - p[k - 1][0]);
    }
    return p[p.length - 1][1];
  };

  function layerFor(i, when, offset) {
    let L = layers.get(i);
    if (L) return L;
    const s = Harm.list[i];
    const src = c.createBufferSource();
    src.buffer = s.buf; src.loop = true; src.loopStart = s.loopStart; src.loopEnd = s.loopEnd;
    const g = c.createGain();
    g.gain.setValueAtTime(0, when);
    src.connect(g).connect(out);
    src.start(when, offset);
    L = { src, g, pts: [] };
    layers.set(i, L);
    return L;
  }
  // Glide every layer to pitch m (time constant tc) and crossfade the recordings along the way.
  // The blend follows the pitch curve itself (scheduled point by point), moving no faster than
  // XFADE per recording, and power-normalised, so there are no dips, flickers or blips.
  function goTo(m, tc, first) {
    const tt = c.currentTime;
    const mNow = first ? m : pitchAt(tt);
    P = { t: tt, v: mNow, m, tc: Math.max(tc, 1e-4) };
    // current mix (as shares) -> path of mixes toward the target
    let a;
    if (first) a = sampleMix(m);
    else {
      a = {}; let sum = 0;
      for (const [i, L] of layers) { const g = gainAt(L, tt); if (g > 1e-6) { a[i] = g; sum += g; } }
      for (const i in a) a[i] /= sum || 1;
    }
    const aEnd = sampleMix(m);
    const times = [tt], path = [mixGains(a)];
    if (!first) {
      const horizon = Math.min(6 * Math.max(tc, 0.003), 0.5), step = GAIN_STEP / XFADE;
      for (let k = 1; k < 400; k++) {
        const tk = tt + k * GAIN_STEP;
        const want = tk - tt <= horizon ? sampleMix(pitchAt(tk)) : aEnd;
        const na = {}; let sum = 0;
        for (const i of new Set([...Object.keys(a), ...Object.keys(want)])) {
          const x = a[i] || 0, d = (want[i] || 0) - x;
          const v = x + Math.max(-step, Math.min(step, d));
          if (v > 1e-6) { na[i] = v; sum += v; }
        }
        for (const i in na) na[i] /= sum;
        a = na;
        times.push(tk); path.push(mixGains(a));
        if (tk - tt > horizon) {
          let done = true;
          for (const i of new Set([...Object.keys(a), ...Object.keys(aEnd)])) if (Math.abs((a[i] || 0) - (aEnd[i] || 0)) > 1e-6) { done = false; break; }
          if (done) break;
        }
      }
    }
    for (const w of path) for (const i in w) layerFor(+i, tt, first ? (quick ? Harm.list[i].steady || 0.35 : 0.01) : Harm.list[i].loopStart + Math.random() * 0.4);
    const tEnd = times[times.length - 1];
    for (const [i, L] of layers) {
      const s = Harm.list[i];
      L.src.playbackRate.cancelScheduledValues(tt);
      L.src.playbackRate.setValueAtTime(rateFor(mNow, s), tt);
      if (!first && tc > 0) L.src.playbackRate.setTargetAtTime(rateFor(m, s), tt, tc);
      const g0 = first ? path[0][i] || 0 : gainAt(L, tt);
      L.g.gain.cancelScheduledValues(tt);
      L.g.gain.setValueAtTime(g0, tt);
      const pts = [[tt, g0]];
      const n = times.length;
      for (let k = 1; k < n; k++) {
        const w = path[k][i] || 0, wp = path[k - 1][i] || 0, wn = k < n - 1 ? path[k + 1][i] || 0 : NaN;
        if (Math.abs(w - wp) < 1e-9 && Math.abs(w - wn) < 1e-9) continue; // only the corners
        L.g.gain.linearRampToValueAtTime(w, times[k]);
        pts.push([times[k], w]);
      }
      L.pts = pts;
      clearTimeout(L.kill);
      if (!(aEnd[i] > 0)) {
        // fading out: stop it once silent (unless the pitch comes back)
        L.kill = setTimeout(() => {
          if (layers.get(i) === L && gainAt(L, c.currentTime) < 1e-4) { L.src.stop(); layers.delete(i); }
        }, (tEnd - tt) * 1000 + 400);
      }
    }
  }
  goTo(midi, 0, true);

  // A key change, as on a real harmonium: no glide. The sounding recordings keep their pitch and
  // fade out while the new note's own recordings (already in their steady tone) fade in, over
  // STEP_XF with equal power (two reeds briefly sounding together: legato, no gap, no slide).
  function jumpTo(m) {
    const tt = c.currentTime, mNow = pitchAt(tt);
    if (Math.abs(m - mNow) < 0.05) { goTo(m, 0.005, false); return; }
    const n = Math.max(2, Math.round(STEP_XF / 0.002));
    for (const [i, L] of layers) {
      const g0 = gainAt(L, tt);
      clearTimeout(L.kill);
      L.src.playbackRate.cancelScheduledValues(tt);
      L.src.playbackRate.setValueAtTime(rateFor(mNow, Harm.list[i]), tt);
      L.g.gain.cancelScheduledValues(tt);
      L.g.gain.setValueAtTime(g0, tt);
      for (let k = 1; k <= n; k++) L.g.gain.linearRampToValueAtTime(g0 * Math.cos(Math.PI / 2 * k / n), tt + STEP_XF * k / n);
      L.src.stop(tt + STEP_XF + 0.05);
    }
    layers.clear();
    P = { t: tt, v: m, m, tc: 1e-4 };
    for (const [k, w] of Object.entries(mixGains(sampleMix(m)))) {
      const s = Harm.list[k], L = layerFor(+k, tt, s.steady || s.loopStart);
      L.src.playbackRate.setValueAtTime(rateFor(m, s), tt);
      const pts = [[tt, 0]];
      for (let j = 1; j <= n; j++) {
        const at = tt + STEP_XF * j / n, v = w * Math.sin(Math.PI / 2 * j / n);
        L.g.gain.linearRampToValueAtTime(v, at);
        pts.push([at, v]);
      }
      L.pts = pts;
    }
  }

  return {
    setPitch(m, tc) { if (!stopped) goTo(m, tc, false); },
    jumpTo(m) { if (!stopped) jumpTo(m); },
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
      const tt = c.currentTime;
      out.gain.cancelScheduledValues(tt);
      out.gain.setValueAtTime(out.gain.value, tt);
      out.gain.setTargetAtTime(0, tt, fast ? 0.01 : 0.03);
      for (const L of layers.values()) { clearTimeout(L.kill); L.src.stop(tt + 0.4); }
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
    jumpTo(m) { this.setPitch(m, 0.002); },
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
// Tanpura: real recorded plucks, pitch-shifted to each string. Until they're loaded
// (or if they fail) a synthesised tanpura is used (additive strings with a moving
// "jawari" formant).
// =====================================================================

// ---------- Recorded tanpura ----------
// Samples: single string plucks by luckylittleraven on Freesound (CC0), pack 23512.
// Each file's true pitch was measured from its harmonics ('hz' in the manifest).
const Tamb = { list: [], raw: new Map(), ready: false, pending: null, gen: 0 };
function loadTanpura() {
  Tamb.pending = (async () => {
    try {
      const list = await (await fetch('tanpura/samples.json')).json();
      await Promise.all(list.map(async s => Tamb.raw.set(s.file, await (await fetch('tanpura/' + s.file)).arrayBuffer())));
      Tamb.list = list;
      await decodeTanpura();
    } catch (e) { console.warn('Tanpura samples unavailable, using generated sound', e); }
  })();
  return Tamb.pending;
}
function decodeTanpura() {
  if (!Tamb.list.length) return Promise.resolve();
  Tamb.ready = false;
  const c = audio(), gen = ++Tamb.gen; // a newer decode (audio engine rebuilt) supersedes this one
  Tamb.pending = Promise.all(Tamb.list.map(s => new Promise((ok, fail) =>
    c.decodeAudioData(Tamb.raw.get(s.file).slice(0), b => { if (gen === Tamb.gen) s.buf = b; ok(); }, fail))))
    .then(() => { if (gen === Tamb.gen) Tamb.ready = Tamb.list.every(s => s.buf); })
    .catch(e => console.warn('Tanpura samples failed to decode', e));
  return Tamb.pending;
}
const TANPURA_SAMPLE_LEVEL = 1.6; // recordings are quieter (RMS) than the generated strings
const TANPURA_PREROLL = 0.012;    // silence kept before each pluck's attack in the files

// The recording(s) to use for a string at f Hz: the nearest-pitched pluck, or — so repeated
// plucks aren't identical — any pluck within half a semitone of being as close.
function tanpuraSampleFor(f) {
  const dist = s => Math.abs(Math.log2(f / s.hz)) * 12;
  const best = Math.min(...Tamb.list.map(dist));
  const near = Tamb.list.filter(s => dist(s) <= best + 0.5);
  return near[Math.floor(Math.random() * near.length)];
}

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

// The tanpura plucks on the shared beat: once per beat at slow/medium tempo, every 2nd or
// 3rd beat when fast, so it never sounds frantic (plucks stay at least ~0.55 s apart).
function pluckSpacing() {
  const beat = 60 / S.bpm;
  return beat * Math.max(1, Math.ceil(0.55 / beat - 1e-9));
}

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
    // Recorded plucks need no preparation; give them a moment to finish loading before
    // falling back to generating strings.
    if (!Tamb.ready && Tamb.pending) await Promise.race([Tamb.pending, new Promise(r => setTimeout(r, 1500))]);
    if (Tamb.ready || gen !== this.gen) return;
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
    // in step with the tabla if it's already playing
    this.nextTime = Tabla.playing && Tabla.nextTime > ctx.currentTime ? Tabla.nextTime : ctx.currentTime + 0.08;
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
    const list = this.strings(), beat = pluckSpacing();
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
    // Recorded pluck when available (pitch-shifted to the string), else the generated string.
    const f = this.freqOf(st.semi) * (st.rate || 1);
    const s = Tamb.ready ? tanpuraSampleFor(f) : null;
    const buf = s ? s.buf : this.cache.get(this.freqOf(st.semi).toFixed(2));
    if (!buf) return;
    const jitter = (Math.random() - 0.5) * 0.02;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = s ? f / s.hz : (st.rate || 1);
    const g = ctx.createGain();
    const force = Math.random();             // how hard this pluck is: a bit louder and brighter
    g.gain.value = (0.8 + force * 0.15) * (s ? TANPURA_SAMPLE_LEVEL : 1);
    let out = src;
    if (s) {
      const tone = ctx.createBiquadFilter();
      tone.type = 'highshelf'; tone.frequency.value = 2500; tone.gain.value = -2.5 + force * 3;
      out = src.connect(tone);
    }
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = [-0.35, -0.12, 0.12, 0.35, 0][i % 5] || 0; out.connect(g).connect(pan).connect(tanpuraBus); }
    else out.connect(g).connect(tanpuraBus);
    const prev = this.last.get(i);
    if (prev) { prev.g.gain.setTargetAtTime(0, t, 0.06); prev.src.stop(t + 0.5); }
    // recorded plucks start a random few ms into their pre-roll, so attacks don't line up mechanically
    src.start(t + jitter, s ? Math.random() * TANPURA_PREROLL * 0.8 : 0);
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
  if (r.isFree) return KIND[off]; // shuddha / komal / tivra (S and P have none)
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
const HOLD = 0.1;           // while sliding, passing notes are only brushed (small hold), not stepped on
const MEEND_SMOOTH = 0.03;  // smoothing (s) — removes finger jitter; small so pitch stays with the finger
const SETTLE_MS = 40;       // slow/still this long and the pitch locks onto the nearest note
const SPEED_WINDOW = 60;    // ms of finger history used to judge speed
const UNLOCK_DIST = 0.15;   // how far (in pads) the finger must move before a slide starts
const SETTLE_SPEED = 1.0;   // pads per second; slower than this (for SETTLE_MS) = holding a note
const ARRIVE_SPEED = 1.5;   // reaching a pad's middle slower than this (settling, not a slow meend) locks onto it at once
const SNAP_SPEED = 10;      // pads per second; a swipe faster than this steps through the notes (grace notes, as on a
                            // real harmonium) instead of gliding; it glides again once slower than 60% of this
function lockOn(tch, idx, off, p) {
  clearTimeout(tch.settle);
  tch.locked = true;
  tch.lockP = p;
  tch.lockIdx = idx;
  tch.slowSince = 0;
  tch.snapping = false;
  tch.voice.setPitch(offMidi(idx, off), 0.005); // land exactly on the note, at once
  tch.idx = idx; tch.off = off;
  showHeld(tch, elFor(idx, off));
}
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
// The app only runs in landscape (portrait shows a "turn your phone" screen).
const portraitMQ = matchMedia('(orientation: portrait)');
const ax = e => e.clientX;   // along the pads
const ay = e => e.clientY;   // across the pads
const startOf = el => el.getBoundingClientRect().left;
// 0 = top of the pads, 1 = bottom (in app space)
function yFrac(e, rect) {
  return (e.clientY - rect.top) / rect.height;
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
  if (phrasePlayer) stopPhrase(); // playing yourself takes over from a phrase
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
  tch.locked = true;      // a touch starts locked on the pad's exact note
  tch.lockP = idx + 0.5;  // (same coordinates as the slide position, which starts at the pad's middle)
  if (pads[idx].split) { tch.choice = tch.yHalf === 'hi' ? pads[idx].hi : pads[idx].lo; tch.choiceIdx = idx; }
  const off = variantOf(idx, tch);
  tch.off = off;
  const host = S.second === 'pull' ? pullHost(tch, idx, off) : null;
  if (host) { startPull(tch, host, idx, off); return; }
  handOver();
  tch.voice = harmoniumVoice(offMidi(idx, off));
  showHeld(tch, elFor(idx, off));
});

// ---------- Pull (second finger) ----------
// Holding a note and pressing any other pad pulls the held note there with a meend (hold M,
// press P: M glides up to P; hold P, press R: P glides down to R); lifting that finger lets it
// glide gently back, and even a very quick tap completes the pull. If the held finger lets go
// first, the sound jumps straight to the second finger's note. Only for a note held a moment
// (PULL_MIN_HOLD_MS), so overlapping fingers in a fast taan still play separate notes.
// Settings can switch the second finger to play its own note instead (chords).
const PULL_MIN_HOLD_MS = 250, PULL_TC = 0.03, PULL_MIN_MS = 100, RELEASE_TC = 0.04;
// Glide a voice to m — or, with Settings > Steps, change note without any glide.
const moveVoice = (v, m, tc) => S.slide === 'steps' ? v.jumpTo(m) : v.setPitch(m, tc);
function pullHost(tch, idx, off) {
  let host = null;
  const now = performance.now();
  for (const t of touches.values()) {
    if (t === tch || !t.voice || t.puller || now - t.t0 < PULL_MIN_HOLD_MS) continue;
    if (t.idx === idx && t.off === off) continue; // same note: nothing to pull
    if (!host || t.t0 > host.t0) host = t;
  }
  return host;
}
function startPull(tch, host, idx, off) {
  tch.puller = true;
  tch.host = host;
  tch.idx = idx; tch.off = off;
  tch.pullStart = performance.now();
  (host.pulls || (host.pulls = [])).push(tch);
  clearTimeout(host.returnTimer);
  moveVoice(host.voice, offMidi(idx, off), PULL_TC);
  showHeld(tch, elFor(idx, off));
}
function endPull(tch) {
  const host = tch.host;
  if (!host) { showHeld(tch, null); return; }
  host.pulls = host.pulls.filter(t => t !== tch);
  const wait = Math.max(0, PULL_MIN_MS - (performance.now() - tch.pullStart));
  clearTimeout(host.returnTimer);
  host.returnTimer = setTimeout(() => {
    showHeld(tch, null);
    if (!host.voice || !touches.has(host.id)) return;
    const other = host.pulls[host.pulls.length - 1];
    const target = other ? offMidi(other.idx, other.off) : offMidi(host.idx, host.off);
    moveVoice(host.voice, target, other ? PULL_TC : RELEASE_TC);
  }, wait);
}

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

  if (tch.puller) {
    // sliding the pulling finger keeps pulling the held note along with it
    if (!tch.host || !tch.host.voice) return;
    const r = (ax(e) - stageLeft + scrollX) / step;
    updateYHalf(tch, e);
    const i = padAt(r, tch.idx), o = variantOf(i, tch);
    if (i === tch.idx && o === tch.off) return;
    tch.dir = Math.sign(i - tch.idx);
    tch.idx = i; tch.off = o;
    moveVoice(tch.host.voice, offMidi(i, o), MEEND_SMOOTH);
    showHeld(tch, elFor(i, o));
    return;
  }
  if (!tch.voice) return;
  if (tch.pulls && tch.pulls.length) return; // while being pulled, the held finger's wobble is ignored
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
    tch.voice.jumpTo(offMidi(curIdx, off));
    tch.idx = curIdx; tch.off = off;
    showHeld(tch, elFor(curIdx, off));
    return;
  }

  // Meend happens only while you're actually sliding.
  //  - Touching a pad locks onto its exact note; small finger wobble does nothing.
  //  - Moving clearly away (UNLOCK_DIST) starts a slide: pitch glides along the raga's notes.
  //  - Slowing down / stopping (judged by finger speed, not by events stopping — iPhones keep
  //    reporting tiny movements while you hold) locks onto the nearest note again, and it
  //    stays locked until you clearly move.
  const now = performance.now();
  const p = raw + tch.shift * Math.max(0, 1 - Math.abs(raw - tch.p0));
  // Speed = net movement over the last ~100 ms, so a finger that jitters in place reads as still.
  (tch.hist || (tch.hist = [])).push([now, p]);
  while (tch.hist.length > 2 && now - tch.hist[1][0] > SPEED_WINDOW) tch.hist.shift();
  const [t0, p0] = tch.hist[0];
  tch.speed = now - t0 > 15 ? Math.abs(p - p0) / (now - t0) * 1000 : (tch.speed || 0);

  if (tch.locked) {
    if (Math.abs(p - tch.lockP) < UNLOCK_DIST) {
      // holding: only a deliberate move to the other half of a split pad changes the note
      const off = variantOf(tch.idx, tch);
      if (off !== tch.off) {
        tch.off = off;
        tch.voice.setPitch(offMidi(tch.idx, off), MEEND_SMOOTH * 1.5);
        showHeld(tch, elFor(tch.idx, off));
      }
      return;
    }
    tch.locked = false;  // clearly moving: start sliding
    tch.slowSince = 0;
  }

  const idx = nearestPad(p), off = variantOf(idx, tch);
  const changed = idx !== tch.idx || off !== tch.off;

  // Arriving: the finger reaches a pad's middle and isn't rushing past -> that note, exactly, now.
  if (Math.abs(p - (idx + 0.5)) < HOLD && tch.speed < ARRIVE_SPEED && idx !== tch.lockIdx) {
    lockOn(tch, idx, off, p);
    tch.lockIdx = idx;
    return;
  }
  if (tch.speed < SETTLE_SPEED) {
    // slowing down: once slow for a moment, lock onto the nearest raga note
    if (!tch.slowSince) tch.slowSince = now;
    if (now - tch.slowSince > SETTLE_MS) {
      lockOn(tch, idx, off, p);
      return;
    }
  } else {
    tch.slowSince = 0;
  }

  // A quick swipe steps through the notes it passes, the way a harmonium player suggests a
  // meend with grace notes; a fast continuous glide only sounds like a siren.
  if (tch.speed > (tch.snapping ? SNAP_SPEED * 0.6 : SNAP_SPEED)) {
    if (!tch.snapping || changed) tch.voice.jumpTo(offMidi(idx, off));
    tch.snapping = true;
  } else {
    // A slower slide is a meend: one continuous curve that leans into each passing note,
    // e.g. P→R in Yaman flows P–M–G–R; the note you land on locks exactly.
    tch.snapping = false;
    tch.voice.setPitch(meendPitch(p, tch), MEEND_SMOOTH);
  }
  tch.idx = idx; tch.off = off;
  showHeld(tch, elFor(idx, off));
  // fallback: if events stop entirely, also lock on
  clearTimeout(tch.settle);
  tch.settle = setTimeout(() => { if (tch.voice && !tch.locked) lockOn(tch, nearestPad(p), variantOf(nearestPad(p), tch), p); }, SETTLE_MS);
});

// ---------- Fast tapped taans ----------
// A quick tap may touch the screen for only ~50 ms — too short to hear the note properly.
// So every tap sounds for at least MIN_NOTE_MS; and the moment the next note starts, a
// still-ringing tap hands over to it with a very quick crossfade (legato, no mush).
const MIN_NOTE_MS = 150;
const lingering = new Set();
function finishLingering(L, fast) {
  if (!lingering.has(L)) return;
  lingering.delete(L);
  clearTimeout(L.timer);
  L.voice.stop(fast);
  showHeld(L, null);
}
function handOver() { for (const L of [...lingering]) finishLingering(L, true); }

function endTouch(e) {
  const tch = touches.get(e.pointerId);
  if (!tch) return;
  touches.delete(e.pointerId);
  clearTimeout(tch.settle);
  if (tch.puller) { endPull(tch); return; }
  if (tch.pulls && tch.pulls.length) {
    // the held finger let go while being pulled: the sound carries on at the pulling finger
    clearTimeout(tch.returnTimer);
    const heir = tch.pulls[tch.pulls.length - 1];
    heir.puller = false; heir.host = null;
    heir.voice = tch.voice; tch.voice = null;
    heir.voice.jumpTo(offMidi(heir.idx, heir.off)); // jump straight to the second note
    heir.locked = true; heir.lockP = heir.idx + 0.5;
    heir.p0 = heir.lockP; heir.shift = 0; heir.hist = [];
    heir.pulls = tch.pulls.filter(p => p !== heir);
    for (const p of heir.pulls) p.host = heir;
    tch.pulls = [];
    showHeld(tch, null);
    return;
  }
  const age = performance.now() - tch.t0;
  if (tch.voice && age < MIN_NOTE_MS) {
    // short tap: keep it sounding (and lit) a little longer
    const L = { voice: tch.voice, heldEl: tch.heldEl };
    tch.heldEl = null;
    L.timer = setTimeout(() => finishLingering(L, false), MIN_NOTE_MS - age);
    lingering.add(L);
  } else {
    if (tch.voice) tch.voice.stop(false);
    showHeld(tch, null);
  }
  if (scrolling) {
    scrolling.ids.delete(e.pointerId);
    if (scrolling.ids.size === 0) { scrolling = null; slideBy(0); }
  }
}
window.addEventListener('pointerup', endTouch);
window.addEventListener('pointercancel', endTouch);

function releaseAll() {
  for (const L of [...lingering]) finishLingering(L, true);
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
  if (e.touches.length === 0 && touches.size > 0) { for (const t of [...touches.values()]) endTouch({ pointerId: t.id }); }
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
  $('ragaThaat').textContent = r.isFree ? 'all 12 swaras' : r.isThaat ? 'thaat scale' : thaatLabel(r);
}
// =====================================================================
// Tabla: plays the theka of the chosen taal (taals.js) from recorded strokes.
// Samples: mmiron "tabla bols" (Freesound pack 8162, CC0) and msarkar "Tabla"
// (Freesound pack 3571, Sampling+ 1.0 — non-commercial sharing with credit).
// The dayan (right drum) is retuned to your Sa; the bayan (left drum) is never retuned.
// =====================================================================
const Tab = { list: [], raw: new Map(), ready: false, gen: 0 };
async function loadTabla() {
  try {
    const list = await (await fetch('tabla/samples.json')).json();
    await Promise.all(list.map(async s => Tab.raw.set(s.file, await (await fetch('tabla/' + s.file)).arrayBuffer())));
    Tab.list = list;
    await decodeTabla();
  } catch (e) { console.warn('Tabla samples unavailable', e); }
}
async function decodeTabla() {
  if (!Tab.list.length) return;
  Tab.ready = false;
  const c = audio(), gen = ++Tab.gen;
  await Promise.all(Tab.list.map(s => new Promise((ok, fail) =>
    c.decodeAudioData(Tab.raw.get(s.file).slice(0), b => { if (gen === Tab.gen) s.buf = b; ok(); }, fail))));
  if (gen === Tab.gen) Tab.ready = Tab.list.every(s => s.buf);
}

// Mix level of each stroke type (the recordings are loudness-matched, so this sets the balance).
const TABLA_CLASS_GAIN = { na: 1, tin: 0.95, tun: 0.85, te: 0.55, re: 0.45, ge: 0.85, ke: 0.5, dha: 1.1, dhin: 1.1 };

// Retune a dayan recording (tuned to `hz`) to the player's Sa — or to Pa when Sa would need
// a big shift (tabla players do this too). Returns semitones of shift.
function dayanShift(hz) {
  const near = target => { const s = 12 * Math.log2(target / hz); return s - 12 * Math.round(s / 12); };
  const saHz = mtof(saMidi());
  const sSa = near(saHz), sPa = near(saHz * Math.pow(2, 7 / 12));
  return Math.abs(sSa) <= 4.5 || Math.abs(sSa) <= Math.abs(sPa) ? sSa : sPa;
}

const Tabla = {
  playing: false, timer: null, raf: 0, matra: 0, nextTime: 0, walk: 0,
  queue: [], last: { d: null, b: null }, recent: {},

  taal() { return TAALS.find(t => t.name === S.taal) || TAALS[0]; },

  // Pick a recording of a stroke type, never the same take twice in a row.
  pick(cls, ok = () => true) {
    let c = Tab.list.filter(s => s.cls === cls && s.buf && ok(s)); // only strokes that have loaded
    // One tabla as the main voice (mmiron's, tuned closest to Sa); the other set only now and
    // then, so a theka doesn't sound like two different drums taking turns.
    const main = c.filter(s => s.file.startsWith('m_'));
    if (main.length && Math.random() < 0.85) c = main;
    if (!c.length) return null;
    const pool = c.length > 1 ? c.filter(s => s !== this.recent[cls]) : c;
    const s = pool[Math.floor(Math.random() * pool.length)];
    this.recent[cls] = s;
    return s;
  },

  // Play one recording. drum: 'd' dayan, 'b' bayan, 'db' both (a full two-handed stroke).
  play(s, t, vel, damp) {
    const src = ctx.createBufferSource();
    src.buffer = s.buf;
    const shift = s.drum === 'b' ? 0 : dayanShift(s.hz);
    src.playbackRate.value = Math.pow(2, shift / 12);
    const g = ctx.createGain();
    g.gain.value = vel * (TABLA_CLASS_GAIN[s.cls] || 1) * (s.drum === 'b' ? S.bayanVol / 0.7 : 1);
    // inner-beat bayan strokes are damped after a moment, like a wrist resting on the drum
    if (damp) g.gain.setTargetAtTime(0, t + damp, 0.18);
    const tone = ctx.createBiquadFilter(); // harder strokes sound a little brighter
    tone.type = 'highshelf'; tone.frequency.value = 3000; tone.gain.value = (vel - 1) * 8;
    src.connect(tone).connect(g).connect(tablaBus);
    // Let strokes ring into each other, but a new stroke on a drum damps its previous one
    // (closed strokes damp hard; Ke cuts off a ringing Ge, as on a real bayan).
    const drums = s.drum === 'db' ? ['d', 'b'] : [s.drum];
    for (const dr of drums) {
      const prev = this.last[dr];
      if (prev) {
        const closed = s.cls === 'te' || s.cls === 're' || s.cls === 'ke';
        prev.g.gain.setTargetAtTime(0, t, closed ? 0.012 : dr === 'b' ? 0.04 : 0.03);
        prev.src.stop(t + 0.5);
      }
      this.last[dr] = { src, g };
    }
    src.start(t);
  },

  // One bol (e.g. Dha) at time t.
  stroke(st, t, vel, beat, first, ringOn) {
    if (!st) return;
    // Dha / Dhin: use a real two-handed recording when the dayan needs only a small retune,
    // otherwise layer a retuned dayan stroke over an untouched bayan stroke.
    const combo = st.b === 'ge' ? (st.d === 'na' ? 'dha' : st.d === 'tin' ? 'dhin' : null) : null;
    if (combo && Math.random() < (combo === 'dhin' ? 0.35 : 0.2)) {
      // real two-handed recordings: on strong beats, and for Dhin anywhere (its resonance is the point)
      const s = first || combo === 'dhin' ? this.pick(combo, x => Math.abs(dayanShift(x.hz)) <= 2.5) : null;
      if (s) { this.play(s, t, vel); return; }
    }
    if (st.d) { const s = this.pick(st.d); if (s) this.play(s, t, vel); }
    if (st.b) {
      // Choose the bayan Ge by context: long falling/steady Ge on strong beats and slow lay,
      // short Ge in fast lay.
      // The bayan isn't struck full-on every beat: it rings fully on sam / the start of a
      // section, and is lighter and damped in between. Dhin always gets an open (not short or
      // rising) Ge; the longest, steadiest Ge recordings only on sam.
      const want = first ? ['fall', 'flat'] : st.d === 'tin' ? ['fall'] : beat < 0.3 ? ['short', 'fall'] : ['fall'];
      const s = this.pick(st.b, x => st.b !== 'ge' || want.includes(x.ge));
      // Dhin's open ringing Ge is what makes it Dhin (vs Tin): keep it clear and undamped.
      const isDhin = st.d === 'tin';
      const level = first ? 1 : isDhin ? 0.85 : 0.62;
      // bayan lands a hair before/after the dayan, like real hands
      // damp inner-beat Ge — but let it ring on into a rest; ring longer at slow tempo
      const damp = !first && !ringOn && !isDhin && s.cls === 'ge' ? Math.max(0.3, beat * 0.45) : 0;
      if (s) this.play(s, t + (st.d ? (Math.random() - 0.5) * 0.008 : 0), vel * level * (st.accent ? 1.15 : 1), damp);
    }
  },

  scheduleMatra(i, t, beat) {
    const tl = this.taal(), entry = tl.theka[i];
    const vb = vibhagOf(tl, i);
    // Accents: sam strongest, first beat of each tali vibhag a little stronger, khali lighter.
    let acc = 1;
    if (vb.first) {
      if (i === 0 && !tl.samIsKhali) acc = 1.35;
      else if (String(vb.mark) === '0') acc = 0.85;
      else acc = 1.15;
    }
    // Human timing: a slow drift (±8 ms) plus a little per-stroke jitter; sam stays tight.
    this.walk = Math.max(-0.008, Math.min(0.008, this.walk * 0.9 + (Math.random() - 0.5) * 0.004));
    const parts = splitMatra(entry);
    const n = parts.length;
    // Fast clusters (TiRaKiTa) stay tight at slow tempo, ending on the next matra.
    const sub = n > 2 && beat / n > 0.11 ? 0.11 : beat / n;
    const clusterStart = n > 2 ? beat - sub * n : 0;
    parts.forEach((p, k) => {
      const at = n > 2 ? clusterStart + k * sub : p.frac * beat;
      const jitter = i === 0 && k === 0 ? 0 : Math.max(-0.008, Math.min(0.008, this.walk + (Math.random() - 0.5) * 0.006));
      const v = acc * (k === 0 ? 1 : n > 2 ? 0.7 : 0.85) * (0.94 + Math.random() * 0.12);
      // a stroke followed by a rest (e.g. Deepchandi's "Dhin –") rings on through it
      const nextEntry = tl.theka[(i + 1) % tl.matras];
      const ringOn = k === n - 1 && (nextEntry === '-' || nextEntry.startsWith('-'));
      this.stroke(p.stroke, t + at + jitter, v, beat, vb.first && k === 0, ringOn);
    });
    if (typeof Sing !== 'undefined') Sing.beat(t, i === 0, vb.first);
    this.queue.push({ time: t, matra: i, entry, mark: vb.first ? vb.mark : null, khali: String(tl.marks[vb.v]) === '0' });
  },

  tick() {
    if (!this.playing || !ctx) return;
    const tl = this.taal(), beat = 60 / S.bpm;
    if (this.matra >= tl.matras) this.matra = 0;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.scheduleMatra(this.matra, this.nextTime, beat);
      this.matra = (this.matra + 1) % tl.matras;
      this.nextTime += beat;
    }
  },

  start() {
    unlock();
    this.playing = true;
    this.matra = 0;
    this.queue = [];
    this.walk = 0;
    // in step with the tanpura if it's already playing: sam lands on its next pluck
    this.nextTime = Tanpura.playing && Tanpura.nextTime > ctx.currentTime + 0.02 ? Tanpura.nextTime : ctx.currentTime + 0.12;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    cancelAnimationFrame(this.raf);
    const frame = () => { this.showBeat(); if (this.playing) this.raf = requestAnimationFrame(frame); };
    this.raf = requestAnimationFrame(frame);
    updateTablaUI();
  },
  stop() {
    this.playing = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    const t = ctx ? ctx.currentTime : 0;
    for (const k of ['d', 'b']) {
      const v = this.last[k];
      if (v) { v.g.gain.setTargetAtTime(0, t, 0.08); v.src.stop(t + 0.6); }
      this.last[k] = null;
    }
    this.queue = [];
    updateTablaUI();
  },
  toggle() { this.playing ? this.stop() : this.start(); },
  // Changing taal while playing: restart cleanly on sam.
  restart() { if (this.playing) { this.stop(); this.start(); } },

  // Show the matra being heard right now (accounting for audio output latency).
  showBeat() {
    const now = ctx.currentTime - (ctx.outputLatency || 0);
    let cur = null;
    while (this.queue.length && this.queue[0].time <= now) cur = this.queue.shift();
    if (!cur) return;
    const tl = this.taal();
    $('tablaCount').textContent = `${cur.matra + 1}/${tl.matras}`;
    $('tablaBol').textContent = cur.entry === '-' ? '·' : cur.entry;
    const mk = $('tablaMark');
    mk.textContent = cur.mark == null ? '' : String(cur.mark);
    mk.className = 'tabla-mark' + (cur.mark == null ? '' : String(cur.mark) === 'X' ? ' sam' : String(cur.mark) === '0' ? ' khali' : ' tali');
    const btn = $('tablaBtn');
    btn.classList.toggle('on-sam', cur.matra === 0);
  },
};

function updateTablaUI() {
  const btn = $('tablaBtn');
  btn.setAttribute('aria-pressed', String(Tabla.playing));
  btn.classList.toggle('playing', Tabla.playing);
  $('tablaIdle').hidden = Tabla.playing;
  $('tablaLive').hidden = !Tabla.playing;
  if (!Tabla.playing) btn.classList.remove('on-sam');
  $('tablaIdleName').textContent = Tabla.taal().name;
}

function updateTanpuraUI() {
  $('tanpuraBtn').setAttribute('aria-pressed', String(Tanpura.playing));
  $('tanpuraPlay').classList.toggle('playing', Tanpura.playing);
  $('tanpuraPlay').setAttribute('aria-label', Tanpura.playing ? 'Stop tanpura' : 'Start tanpura');
  $('tanpuraStatus').textContent = Tanpura.playing ? 'Tanpura playing' : 'Tanpura';
}
$('tanpuraBtn').onclick = () => Tanpura.toggle();
$('tablaBtn').onclick = () => Tabla.toggle();
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
function closeSheet(id) { $(id).hidden = true; stopPhrase(); }
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
  // Free play sits at the very top
  if (!q || 'free play'.includes(q.toLowerCase())) {
    any = true;
    const b = document.createElement('button');
    b.className = 'tree-thaat free' + (browserSel === FREE_PLAY.name ? ' sel' : '');
    b.innerHTML = `<span class="caret">✦</span><span>Free play</span><span class="right">all 12 swaras</span>`;
    b.onclick = () => { browserSel = FREE_PLAY.name; renderTree(); renderDetail(); };
    tree.appendChild(b);
  }
  // The 10 thaats, then 'Other' for ragas that fit none of them (Charukeshi, Kirwani…)
  for (const t of [...THAATS, { name: OTHER, label: 'Other (no thaat)' }]) {
    const items = [...ALL_RAGAS.values()].filter(r => r.thaat === t.name && matches(r, q));
    const ragas = items.filter(r => !r.isThaat);
    if (q && !items.length) continue;
    any = true;
    const open = q ? true : openThaats.has(t.name);
    const head = document.createElement('button');
    head.className = 'tree-thaat' + (open ? ' open' : '');
    head.innerHTML = `<span class="caret">${open ? '▾' : '▸'}</span><span>${esc(t.label || t.name)}</span><span class="right">${ragas.length} raga${ragas.length === 1 ? '' : 's'}</span>`;
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
    `<span class="${KIND[o] === 'shuddha' ? '' : 'alt'}"><b>${SWARA_NAME[o]}</b> ${KIND[o]}</span>`).join('');
  const meta = r.isFree ? 'Every swara, every form — experiment freely'
    : [r.isThaat ? 'Thaat (parent scale)' : thaatLabel(r), inf.jati, r.time].filter(Boolean).join(' · ');
  // aaroh / avaroh / pakad / key phrases: each line has its own ▶ and lights up as it plays
  const plays = ragaPhrases(r);
  const row = (i) => `<button class="phrase-line" data-pl="${i}"><span class="play">▶</span><span class="v">${phraseHTML(plays[i][1])}</span></button>`;
  const facts = [['Aaroh', row(0)], ['Avaroh', row(1)]];
  let n = 2;
  if (r.pakad) facts.push(['Pakad', row(n++)]);
  if (r.phrases && r.phrases.length) facts.push(['Key phrases', r.phrases.map(() => row(n++)).join('')]);
  const vs = [];
  if (r.vadi) vs.push(`${r.vadi} <span class="muted small">vadi</span>`);
  if (r.samvadi) vs.push(`${r.samvadi} <span class="muted small">samvadi</span>`);
  const tp = r.tanpura || (inf.all.includes(7) ? 'P' : inf.all.includes(5) ? 'm' : 'N');
  vs.push(`${swaraText(tp, -1)} <span class="muted small">tanpura</span>`);

  $('detail').innerHTML = `
    <div class="detail-scroll">
      <div class="detail-title"><h2>${esc(r.isThaat ? r.thaat + ' thaat' : r.name)}</h2><span class="muted small">${esc(meta)}</span></div>
      ${r.isFree ? '<div class="legend">All 12 swaras. Swaras with two forms share a split pad: the higher form (R G M D N) on top, the lower (r g m d n) below. No raga rules — slide and tap anything.</div>' : ''}
      <div class="strip">${strip}</div>
      <div class="kinds">${kinds}</div>
      <div class="facts">
        ${facts.map(([k, v]) => `<span class="k">${k}</span><span class="v rows">${v}</span>`).join('')}
        <span class="k">Notes</span><span class="v plain">${vs.join(' &nbsp;·&nbsp; ')}</span>
      </div>
      ${r.rules && r.rules.length ? `<ul class="rules">${r.rules.map(x => `<li>${esc(formatPhrase(x))}</li>`).join('')}</ul>` : ''}
      <div class="legend">lowercase = komal · M = tivra Ma · dot below = lower octave · dot above = upper octave</div>
      ${r.check ? '<div class="check-note">Some details here were written from memory — worth checking with your teacher or a book. You can edit ragas.js.</div>' : ''}
    </div>
    <div class="detail-actions">
      <button class="btn" id="hearBtn">▶ Hear aaroh–avaroh</button>
      <span class="grow"></span>
      <button class="btn primary" id="useBtn">${r.isFree ? 'Start free play' : 'Play ' + esc(r.isThaat ? r.thaat : r.name)}</button>
    </div>`;
  const lines = [...$('detail').querySelectorAll('.phrase-line')];
  const playLine = (btn, str) => {
    if (btn.classList.contains('playing')) { stopPhrase(); return; }
    lines.forEach(l => { l.classList.remove('playing'); l.querySelector('.play').textContent = '▶'; });
    $('hearBtn').textContent = '▶ Hear aaroh–avaroh';
    btn.classList.add('playing');
    btn.querySelector('.play').textContent = '■';
    playPhrase(str, {
      onToken: ti => btn.querySelectorAll('.tok').forEach(t => t.classList.toggle('cur', Number(t.dataset.i) === ti)),
      onEnd: () => { btn.classList.remove('playing'); btn.querySelector('.play').textContent = '▶'; btn.querySelectorAll('.tok').forEach(t => t.classList.remove('cur')); },
    });
  };
  lines.forEach(btn => { btn.onclick = () => playLine(btn, plays[Number(btn.dataset.pl)][1]); });
  $('hearBtn').onclick = () => {
    const hb = $('hearBtn');
    if (hb.dataset.on) { stopPhrase(); return; }
    lines.forEach(l => { l.classList.remove('playing'); l.querySelector('.play').textContent = '▶'; });
    hb.dataset.on = '1'; hb.textContent = '■ Stop';
    playPhrase(r.aaroh + ' , ' + r.avaroh, { onEnd: () => { delete hb.dataset.on; hb.textContent = '▶ Hear aaroh–avaroh'; } });
  };
  $('useBtn').onclick = () => {
    S.raga = r.name;
    S.first = null; S.extra = null; // use this raga's tuning until you change it
    save();
    buildPads();
    Tanpura.retune();
    closeSheet('browser');
  };
}

// =====================================================================
// Phrase player: plays aaroh / avaroh / pakad / key phrases on the harmonium,
// lighting the actual pads as it goes (and scrolling them into view).
// =====================================================================
const PHRASE_SPEEDS = { slow: 0.6, medium: 0.4, fast: 0.24 }; // seconds per note
const PHRASE_RE = /([SrRgGmMPdDnN])([.']?)|,/g;
let phrasePlayer = null;

// Phrase text as tappable tokens: <span class="tok" data-i="n">…</span>
function phraseHTML(str) {
  let i = 0;
  return esc(str).replace(/([SrRgGmMPdDnN])([.']?)/g, (_, l, o) =>
    `<span class="tok" data-i="${i++}">${swaraText(l, o === '.' ? -1 : o === "'" ? 1 : 0)}</span>`);
}
function ragaPhrases(r) {
  const items = [['Aaroh', r.aaroh], ['Avaroh', r.avaroh]];
  if (r.pakad) items.push(['Pakad', r.pakad]);
  (r.phrases || []).forEach((p, i) => items.push([r.phrases.length > 1 ? `Phrase ${i + 1}` : 'Key phrase', p]));
  return items;
}
const padIndexFor = (oct, off) => pads.findIndex(p => p.oct === oct && p.offs.includes(off));
function keepPadVisible(i, anim) {
  const W = stage.clientWidth, x = i * step;
  if (x >= scrollX + step * 0.3 && x + step <= scrollX + W - step * 0.3) return;
  scrollX = x - W / 2 + step / 2;
  clampScroll();
  applyScroll(anim);
}

function playPhrase(str, hooks = {}) {
  stopPhrase();
  unlock();
  const seq = [];
  let ti = 0;
  for (const m of str.matchAll(PHRASE_RE)) {
    if (m[0] === ',') seq.push({ rest: true });
    else seq.push({ off: OFF[m[1]], oct: m[2] === '.' ? -1 : m[2] === "'" ? 1 : 0, ti: ti++ });
  }
  const dur = PHRASE_SPEEDS[S.phraseSpeed] || PHRASE_SPEEDS.medium;
  const pl = { voice: null, timer: null, held: { heldEl: null }, hooks };
  phrasePlayer = pl;
  // bring the phrase's range into view first
  const idxs = seq.filter(x => !x.rest).map(x => padIndexFor(x.oct, x.off)).filter(i => i >= 0);
  if (idxs.length) keepPadVisible(Math.round((Math.min(...idxs) + Math.max(...idxs)) / 2), true);
  let k = 0;
  const next = () => {
    if (phrasePlayer !== pl) return;
    if (k >= seq.length) { stopPhrase(); return; }
    const x = seq[k++];
    if (x.rest) {
      // phrase break: lift the note, short breath
      if (pl.voice) { pl.voice.stop(false); pl.voice = null; }
      showHeld(pl.held, null);
      pl.timer = setTimeout(next, dur * 600);
      return;
    }
    const midi = saMidi() + x.oct * 12 + x.off;
    if (pl.voice) pl.voice.jumpTo(midi); // a harmonium changes key, it doesn't slide
    else pl.voice = harmoniumVoice(midi);
    const pi = padIndexFor(x.oct, x.off);
    if (pi >= 0) { showHeld(pl.held, elFor(pi, x.off)); keepPadVisible(pi, true); }
    if (hooks.onToken) hooks.onToken(x.ti);
    pl.timer = setTimeout(next, dur * 1000 * (k === seq.length ? 1.8 : 1));
  };
  next();
}
function stopPhrase() {
  const pl = phrasePlayer;
  if (!pl) return;
  phrasePlayer = null;
  clearTimeout(pl.timer);
  if (pl.voice) pl.voice.stop(false);
  showHeld(pl.held, null);
  if (pl.hooks.onEnd) pl.hooks.onEnd();
}

// ---------- Phrase panel on the main screen ----------
let phraseKey = null; // which item is playing
function renderPhrasePanel() {
  const r = currentRaga();
  $('phraseTitle').textContent = r.isThaat ? r.thaat + ' thaat' : r.name;
  document.querySelectorAll('[data-pspeed]').forEach(b => b.classList.toggle('sel', b.dataset.pspeed === (S.phraseSpeed || 'medium')));
  $('phraseList').innerHTML = ragaPhrases(r).map(([k, v], i) =>
    `<button class="phrase-item${phraseKey === i ? ' playing' : ''}" data-pi="${i}"><span class="k">${k}</span><span class="v">${phraseHTML(v)}</span><span class="play">${phraseKey === i ? '■' : '▶'}</span></button>`).join('');
  $('phraseList').querySelectorAll('.phrase-item').forEach(b => {
    b.onclick = () => {
      const i = Number(b.dataset.pi);
      if (phraseKey === i) { stopPhrase(); return; }
      const [label, str] = ragaPhrases(currentRaga())[i];
      $('phrasePanel').hidden = true;
      startNowPlaying(label, str, i);
    };
  });
}
function startNowPlaying(label, str, i) {
  phraseKey = i;
  $('npLabel').textContent = label;
  $('npTokens').innerHTML = phraseHTML(str);
  document.querySelector('.navbar').classList.add('np');
  playPhrase(str, {
    onToken: ti => {
      $('npTokens').querySelectorAll('.tok').forEach(t => t.classList.toggle('cur', Number(t.dataset.i) === ti));
    },
    onEnd: () => { phraseKey = null; document.querySelector('.navbar').classList.remove('np'); },
  });
}
$('phrasesBtn').onclick = e => {
  e.stopPropagation();
  const p = $('phrasePanel');
  if (p.hidden) { renderPhrasePanel(); p.hidden = false; } else p.hidden = true;
};
$('npStop').onclick = () => stopPhrase();
document.querySelectorAll('[data-pspeed]').forEach(b => {
  b.onclick = e => { e.stopPropagation(); S.phraseSpeed = b.dataset.pspeed; save(); renderPhrasePanel(); };
});
// tapping anywhere else closes the panel
document.addEventListener('pointerdown', e => {
  const p = $('phrasePanel');
  if (!p.hidden && !p.contains(e.target) && e.target.closest('#phrasesBtn') === null) p.hidden = true;
}, true);

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
document.querySelectorAll('[data-second]').forEach(b => { b.onclick = () => { S.second = b.dataset.second; save(); renderSettings(); }; });
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
  b.onclick = () => { S.bpm = clamp(S.bpm + Number(b.dataset.bpm), 20, 400); save(); renderSettings(); keepInStep(); };
});
$('balance').addEventListener('input', e => { S.balance = Number(e.target.value); save(); applyBalance(); });

function changedTuning() {
  save();
  renderSettings();
  Tanpura.retune();
}

// Tabla settings
// After a tempo change, put the tanpura's next pluck back on the tabla's beat grid.
function keepInStep() {
  if (!Tabla.playing || !Tanpura.playing) return;
  const b = 60 / S.bpm;
  let t = Tabla.nextTime;
  while (t < Tanpura.nextTime - 0.001) t += b;
  Tanpura.nextTime = t;
}

// Stroke check (Settings): play one bol at a time; each tap tries another recording and
// shows which one, so a stroke that sounds wrong can be named and fixed.
const CHECK_BOLS = ['Dha', 'Dhin', 'Tin', 'Ta', 'Tun', 'Ge', 'Ke'];
function checkStroke(bol) {
  unlock();
  const st = STROKES[bol];
  const used = [];
  const orig = Tabla.play.bind(Tabla);
  Tabla.play = (s, t, v) => { used.push(s.file.replace('.wav', '')); orig(s, t, v); };
  Tabla.stroke(st, ctx.currentTime + 0.02, 1, 1, true);
  Tabla.play = orig;
  $('strokeInfo').textContent = `${bol}: ${used.join(' + ') || '—'}`;
}

function renderTablaSettings() {
  $('strokeChecks').innerHTML = CHECK_BOLS.map(b => `<button data-check="${b}">${b}</button>`).join('');
  $('strokeChecks').querySelectorAll('button').forEach(b => { b.onclick = () => checkStroke(b.dataset.check); });
  $('taalChips').innerHTML = TAALS.map(t =>
    `<button data-taal="${t.name}" class="${t.name === Tabla.taal().name ? 'sel' : ''}">${t.name} <span class="muted small">${t.matras}</span></button>`).join('');
  $('taalChips').querySelectorAll('button').forEach(b => {
    b.onclick = () => { S.taal = b.dataset.taal; save(); renderTablaSettings(); updateTablaUI(); Tabla.restart(); };
  });
  $('tablaVol').value = Math.round(S.tablaVol * 100);
  $('bayanVol').value = Math.round(S.bayanVol * 100);
}

$('bayanVol').addEventListener('input', e => { S.bayanVol = Number(e.target.value) / 100; save(); });
$('tablaVol').addEventListener('input', e => {
  S.tablaVol = Number(e.target.value) / 100; save();
  if (tablaBus) tablaBus.gain.value = S.tablaVol;
});

function renderSettings() {
  renderTablaSettings();
  [...saGrid.children].forEach((b, i) => b.classList.toggle('sel', i === S.saPc));
  $('saOctLabel').textContent = NOTE_NAMES[S.saPc] + S.saOct;
  $('saHz').textContent = mtof(saMidi()).toFixed(1) + ' Hz';
  $('centsVal').textContent = (S.cents > 0 ? '+' : '') + S.cents;
  document.querySelectorAll('[data-slide]').forEach(b => b.classList.toggle('sel', b.dataset.slide === S.slide));
  document.querySelectorAll('[data-second]').forEach(b => b.classList.toggle('sel', b.dataset.second === S.second));
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
// "Add to Home Screen" prompt
// Shown every time the page is opened in a browser (as asked), never in the installed app.
// iPhone/iPad can only install via Safari's Share menu, so there we show the steps;
// browsers that support it (Android, desktop Chrome) get a real one-click Install button.
// =====================================================================
(function installPrompt() {
  const installed = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (installed) return;
  const card = $('installCard'), btn = $('installBtn'), steps = $('installSteps');
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const shareIcon = '<svg class="share-ico" width="15" height="17" viewBox="0 0 15 17" aria-label="Share"><path d="M7.5 1v10M4 4.5 7.5 1 11 4.5M3 7.5H1.5v8h12v-8H12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    steps.textContent = 'Full screen, on your home screen, and works offline.';
    btn.hidden = false;
    card.hidden = false;
  });
  btn.onclick = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    card.hidden = true;
  };
  $('installClose').onclick = () => { card.hidden = true; };
  window.addEventListener('appinstalled', () => { card.hidden = true; });
  if (isIOS) {
    steps.innerHTML = `Tap ${shareIcon} <b>Share</b> (or <b>⋯</b>), then <b>Add to Home Screen</b>. Full screen and works offline.`;
    card.hidden = false;
  }
})();

// =====================================================================
// Start
// =====================================================================
// If the main copy of the settings was wiped but the backup survived, restore it.
if (!hadSavedSettings && 'caches' in window) {
  caches.open(SETTINGS_BACKUP).then(c => c.match('settings.json')).then(r => r && r.json()).then(saved => {
    if (!saved || typeof saved !== 'object') return;
    Object.assign(S, saved);
    if (!ALL_RAGAS.has(S.raga)) S.raga = DEFAULTS.raga;
    save();
    buildPads(); renderSettings(); updateHeader(); updateTablaUI();
    if (tablaBus) tablaBus.gain.value = S.tablaVol;
    applyBalance();
  }).catch(() => {});
}

audio();
loadHarmonium();
loadTanpura();
loadTabla();
updateTablaUI();
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
