'use strict';
/* global $, S, NOTE_NAMES, clamp, audio, unlock, Pitch, Sing, Tanpura, Tabla, changedTuning, saMidi, mtof */

// =====================================================================
// Hum to find Sa (Settings → Your Sa): hum a comfortable note steadily for a couple of
// seconds; the app names it (note, octave and cents) and sets it as Sa with one tap.
// =====================================================================

// Cents above A4 (440 Hz). Sa candidates and everything here work in these units.
const centsA4 = hz => 1200 * Math.log2(hz / 440);
const median = xs => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };

// Name of a pitch in cents above A4: nearest note, octave, cents off it.
function noteOf(a) {
  const midi = 69 + a / 100, m = Math.round(midi);
  return { midi: m, pc: ((m % 12) + 12) % 12, oct: Math.floor(m / 12) - 1, dev: Math.round((midi - m) * 100), name: NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1) };
}

// The estimator (pure: no DOM, no audio, so it can be tested on its own).
// Feed it voiced frames; it keeps the current steady stretch and drops glitches.
// A breath in the middle is fine as long as you come back to the same note.
const HUM_NEED = 2.2;   // s of steady humming needed
const HUM_JUMP = 70;    // cents away from the stretch's median = a different note
const HUM_JUMP_FOR = 0.15; // s on the new note before the stretch restarts there
function HumEst() {
  let run = [], away = [], last3 = [], lastT = null, voiced = 0;
  return {
    push(t, hz) {
      if (!(hz > 0)) return;
      let a = centsA4(hz);
      last3.push(a); if (last3.length > 3) last3.shift();
      if (last3.length === 3) a = median(last3);
      const dt = lastT == null ? 0 : Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      if (run.length >= 8) {
        const m = median(run.slice(-80).map(x => x.a));
        if (Math.abs(a - m) > HUM_JUMP) {
          if (away.length && t - away[away.length - 1].t > 0.06) away = []; // only an unbroken stretch counts
          away.push({ t, a, dt });
          if (away[away.length - 1].t - away[0].t >= HUM_JUMP_FOR) {
            // moved to another note: start over from there
            run = away; away = []; voiced = run.reduce((s, x) => s + x.dt, 0);
          }
          return;
        }
        away = [];
      }
      run.push({ t, a, dt });
      voiced += dt;
    },
    gap() { last3 = []; lastT = null; away = []; },
    state() {
      const as = run.map(x => x.a), a = as.length ? median(as) : NaN;
      const s = [...as].sort((x, y) => x - y);
      const spread = s.length > 4 ? (s[Math.floor(s.length * 0.75)] - s[Math.floor(s.length * 0.25)]) / 2 : 0;
      return { progress: Math.min(1, voiced / HUM_NEED), done: voiced >= HUM_NEED, a, spread, frames: run.length };
    },
    reset() { run = []; away = []; last3 = []; lastT = null; voiced = 0; },
  };
}

// Sa options in the app: C–B, octaves 2–4, fine tune ±50 cents.
function saFromCents(a) {
  const n = noteOf(a);
  const oct = clamp(n.oct, 2, 4);
  return { pc: n.pc, oct, dev: n.dev, moved: oct - n.oct, name: NOTE_NAMES[n.pc] + oct, heard: n.name };
}

// Set Sa (and redraw / retune everything that depends on it).
function setSa(pc, oct, cents) {
  S.saPc = pc; S.saOct = oct; S.cents = clamp(Math.round(cents), -50, 50);
  changedTuning();
}

// Shared microphone opening, same as Sing: raw sound (no echo cancelling, noise suppression
// or auto gain, which all bend the pitch), the iPhone record session, the same messages.
async function openMicStream(say) {
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) {
    say(window.isSecureContext ? "This browser can't use the microphone." : 'The microphone only works when the app is opened over https.');
    return null;
  }
  unlock();
  try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch {}
  say('Asking for the microphone…');
  try {
    return await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
  } catch (err) {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const name = err && err.name;
    say(name === 'NotAllowedError' || name === 'SecurityError'
      ? 'Microphone is blocked. Allow it for this site (iPhone: Settings → Apps → Safari → Microphone), then try again.'
      : name === 'NotFoundError' ? 'No microphone found.' : "Couldn't open the microphone.");
    return null;
  }
}

const Hum = {
  on: false, stream: null, src: null, an: null, sink: null, data: null, raf: 0, est: null,
  floor: 0.003, lastAnalysis: 0, result: null, resume: null,

  async open() {
    if (this.on) return;
    this.on = true;
    this.result = null;
    this.est = HumEst();
    // Quiet the app while you hum: the tanpura and tabla would leak into the mic,
    // and the Sing trace would compete for the microphone.
    this.resume = {
      sing: typeof Sing !== 'undefined' && Sing.listening,
      tanpura: Tanpura.playing,
      tabla: typeof Tabla !== 'undefined' && Tabla.playing,
    };
    if (this.resume.sing) Sing.mute();
    if (this.resume.tanpura) Tanpura.stop();
    if (this.resume.tabla) Tabla.stop();
    this.ui();
    const stream = await openMicStream(t => this.say(t));
    if (!stream) return;
    if (!this.on) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;
    const c = audio();
    const d = Math.max(1, Math.round(c.sampleRate / 24000));
    this.src = c.createMediaStreamSource(stream);
    this.an = c.createAnalyser();
    this.an.fftSize = 1 << Math.round(Math.log2(1024 * d));
    this.an.smoothingTimeConstant = 0;
    this.sink = c.createGain(); this.sink.gain.value = 0;
    this.src.connect(this.an).connect(this.sink).connect(c.destination);
    this.data = new Float32Array(this.an.fftSize);
    this.say('Hum or sing “aa” on the note you want as Sa, steadily, for a few seconds.');
    this.raf = requestAnimationFrame(() => this.frame());
  },

  stopMic() {
    cancelAnimationFrame(this.raf);
    for (const n of [this.src, this.an, this.sink]) { try { n && n.disconnect(); } catch {} }
    this.src = this.an = this.sink = null;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  },

  close() {
    if (!this.on) return;
    this.on = false;
    this.stopMic();
    this.ui();
    const r = this.resume || {};
    this.resume = null;
    if (r.tanpura && !Tanpura.playing) Tanpura.start();
    if (r.tabla && !Tabla.playing) Tabla.start();
    if (r.sing && Sing.on && !Sing.listening) Sing.listen();
  },

  again() { this.close(); this.open(); },

  frame() {
    if (!this.on || !this.an) return;
    this.raf = requestAnimationFrame(() => this.frame());
    const now = performance.now();
    if (now - this.lastAnalysis < 14) return;
    this.lastAnalysis = now;
    const c = this.an.context;
    if (c.state !== 'running') return;
    this.an.getFloatTimeDomainData(this.data);
    const p = Pitch.detect(this.data, c.sampleRate, 60, 1000);
    this.floor = Math.max(0.0003, p.rms < this.floor ? this.floor * 0.6 + p.rms * 0.4 : this.floor * 1.0004);
    const voiced = p.hz > 0 && p.clarity >= 0.85 && p.rms >= Math.max(0.0015, this.floor * 2.2);
    if (voiced) this.est.push(c.currentTime, p.hz); else this.est.gap();
    const st = this.est.state();
    $('humBar').style.width = Math.round(st.progress * 100) + '%';
    if (voiced) this.showNote(centsA4(p.hz), true);
    else $('humLive').classList.add('idle');
    if (st.done) this.finish(st);
  },

  showNote(a, live) {
    const n = noteOf(a);
    $('humLive').classList.toggle('idle', false);
    $('humNote').textContent = n.name;
    $('humCents').textContent = (n.dev > 0 ? '+' : n.dev < 0 ? '−' : '±') + Math.abs(n.dev) + '¢';
    $('humHz').textContent = (440 * Math.pow(2, a / 1200)).toFixed(1) + ' Hz';
    if (live) $('humNeedle').style.left = (50 + clamp(n.dev, -50, 50)) + '%';
  },

  finish(st) {
    this.stopMic();
    const sa = saFromCents(st.a);
    this.result = sa;
    this.showNote(st.a, false);
    $('humNeedle').style.left = (50 + clamp(sa.dev, -50, 50)) + '%';
    $('humBar').style.width = '100%';
    const wobble = st.spread > 25 ? ' Your note wavered a bit, so try again if it sounds off.' : '';
    const octNote = sa.moved > 0 ? ` That's below the app's lowest Sa, so it's set an octave up (${sa.name}).`
      : sa.moved < 0 ? ` That's above the app's highest Sa, so it's set an octave down (${sa.name}).` : '';
    this.say(`You hummed ${sa.heard}, ${Math.abs(sa.dev)}¢ ${sa.dev >= 0 ? 'sharp' : 'flat'}.${octNote}${wobble}`);
    const set = $('humSet'), exact = $('humSetExact');
    set.hidden = false;
    set.textContent = `Set Sa to ${sa.name}`;
    exact.hidden = Math.abs(sa.dev) < 3;
    exact.textContent = `${sa.name} ${sa.dev > 0 ? '+' : '−'}${Math.abs(sa.dev)}¢ exactly`;
    $('humAgain').hidden = false;
  },

  say(text) { const el = $('humMsg'); if (el) el.textContent = text; },

  ui() {
    $('humBox').hidden = !this.on;
    $('saGrid').hidden = this.on;
    $('humBtn').setAttribute('aria-pressed', String(this.on));
    if (this.on && !this.result) {
      $('humSet').hidden = $('humSetExact').hidden = $('humAgain').hidden = true;
      $('humBar').style.width = '0%';
      $('humNote').textContent = '–'; $('humCents').textContent = ''; $('humHz').textContent = '';
      $('humNeedle').style.left = '50%';
      $('humLive').classList.add('idle');
    }
  },
};

if (typeof document !== 'undefined' && document.getElementById('humBtn')) {
  $('humBtn').onclick = () => (Hum.on ? Hum.close() : Hum.open());
  $('humCancel').onclick = () => Hum.close();
  $('humAgain').onclick = () => Hum.again();
  $('humSet').onclick = () => { const r = Hum.result; if (r) { setSa(r.pc, r.oct, 0); Hum.close(); } };
  $('humSetExact').onclick = () => { const r = Hum.result; if (r) { setSa(r.pc, r.oct, r.dev); Hum.close(); } };
  // Leaving Settings stops listening.
  document.querySelectorAll('#settings [data-close]').forEach(b => b.addEventListener('click', () => Hum.close()));
}

if (typeof module !== 'undefined') module.exports = { HumEst, noteOf, saFromCents, centsA4, median };
