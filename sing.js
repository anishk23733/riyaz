'use strict';
/* global $, S, ctx, audio, unlock, saMidi, mtof, info, currentRaga, LETTERS, SWARA_NAME, KIND, swaraText, clamp, Pitch, stage, layout */

// =====================================================================
// Sing: listens through the microphone and draws your voice's pitch as a line over the
// raga's swaras, so you can see meend, andolan and how steadily you hold a note.
// =====================================================================
const SING_SECONDS = 8;   // history on screen
const HOLD_TOL = 45;      // cents: within this of a note you're on it
const HOLD_EXIT = 60;     // cents: and you stay on it until you move this far away
const REST_AFTER = 0.15;  // s on one note before it counts as resting there (not just passing)
const SHOW_HOLD = 0.5;    // s before a hold's numbers are shown
const GAP = 0.09;         // s without pitch that breaks the line
const TRACE = { pass: 'rgba(236, 234, 228, .55)', raga: '#f2a33a', off: '#ff6b5e' };

const Sing = {
  on: false, listening: false, frozen: false,
  stream: null, src: null, an: null, sink: null, ctxRef: null, data: null, winSec: 0.043,
  pts: [], beats: [], raw: [], hold: null, lastHold: null,
  floor: 0.003, level: 0, center: 600, target: 600, lastT: -1, lastFrame: 0, lastAnalysis: 0,
  heard: false, raf: 0, w: 0, h: 0, msgText: '',

  canvas: $('singCanvas'),

  toggle() { this.on ? this.close() : this.open(); },

  async open() {
    this.on = true;
    this.frozen = false;
    this.ui();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.frame());
    await this.listen();
  },

  close() {
    this.on = false;
    this.mute();
    cancelAnimationFrame(this.raf);
    this.ui();
  },

  async listen() {
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) {
      this.message(window.isSecureContext ? "This browser can't use the microphone." : 'The microphone only works when the app is opened over https.');
      return;
    }
    unlock();
    this.setSession('play-and-record');
    this.message('Asking for the microphone…');
    let stream;
    try {
      // Raw sound: echo cancelling, noise suppression and auto gain all bend the pitch.
      stream = await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (err) {
      this.setSession('playback');
      const name = err && err.name;
      this.message(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone is blocked. Allow it for this site (iPhone: Settings → Apps → Safari → Microphone), then tap Sing again.'
        : name === 'NotFoundError' ? 'No microphone found.' : "Couldn't open the microphone.");
      return;
    }
    if (!this.on) { stream.getTracks().forEach(t => t.stop()); this.setSession('playback'); return; }
    this.stream = stream;
    this.attach();
    this.listening = true;
    this.reset();
  },

  mute() {
    this.listening = false;
    this.detach();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.setSession('playback');
  },

  // iPhone: recording needs the play-and-record audio session (iOS 17+ lets us choose it).
  setSession(type) { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch {} },

  // Connect the microphone to the analyser (again, if the audio engine was rebuilt).
  attach() {
    const c = audio();
    this.detach();
    this.ctxRef = c;
    const d = Math.max(1, Math.round(c.sampleRate / 24000));
    this.src = c.createMediaStreamSource(this.stream);
    this.an = c.createAnalyser();
    this.an.fftSize = 1 << Math.round(Math.log2(1024 * d)); // ≈ 43 ms window
    this.an.smoothingTimeConstant = 0;
    this.sink = c.createGain();
    this.sink.gain.value = 0; // silent: Safari only runs nodes that lead to the speakers
    this.src.connect(this.an).connect(this.sink).connect(c.destination);
    this.data = new Float32Array(this.an.fftSize);
    this.winSec = this.an.fftSize / c.sampleRate;
    this.lastT = -1;
  },
  detach() {
    for (const n of [this.src, this.an, this.sink]) { try { n && n.disconnect(); } catch {} }
    this.src = this.an = this.sink = null;
  },

  reset() {
    this.pts = [];
    this.raw = [];
    this.hold = null;
    this.heard = false;
    this.message('');
  },

  // Tabla tells us when each matra sounds, to mark the beats under the trace.
  beat(t, sam, first) {
    if (!this.on) return;
    this.beats.push({ t, sam, first });
  },

  // ---------- listening ----------
  frame() {
    if (!this.on) return;
    this.raf = requestAnimationFrame(() => this.frame());
    if (this.listening && !this.frozen) {
      if (ctx !== this.ctxRef) this.attach();
      const now = performance.now();
      if (now - this.lastAnalysis >= 14) { this.lastAnalysis = now; this.analyse(); }
    }
    this.draw();
  },

  analyse() {
    const c = this.ctxRef;
    if (!c || c.state !== 'running') return;
    const t = c.currentTime - this.winSec / 2; // the middle of the window just heard
    if (t <= this.lastT) return; // the audio clock hasn't moved
    this.lastT = t;
    this.an.getFloatTimeDomainData(this.data);
    const p = Pitch.detect(this.data, c.sampleRate);

    // Room level: drops straight to quiet moments, creeps up slowly (so a long note isn't lost).
    this.floor = Math.max(0.0003, p.rms < this.floor ? this.floor * 0.6 + p.rms * 0.4 : this.floor * 1.0004);
    this.level = p.rms;
    const voiced = p.hz > 0 && p.clarity >= 0.8 && p.rms >= Math.max(0.0015, this.floor * 2.2);
    if (!voiced) { this.raw = []; this.silence(t); return; }

    // Cents above your Sa, with a 3-frame median to drop single-frame glitches.
    const cents = 1200 * Math.log2(p.hz / mtof(saMidi()));
    this.raw.push(cents);
    if (this.raw.length > 3) this.raw.shift();
    const c3 = this.raw.length === 3 ? [...this.raw].sort((a, b) => a - b)[1] : cents;
    this.addPoint(t, c3);
  },

  inRaga(n) { return !info || info.all.includes(((n % 12) + 12) % 12); },

  addPoint(t, c) {
    let h = this.hold;
    if (h && (t - h.lastT > GAP || Math.abs(c - h.note * 100) > HOLD_EXIT)) { this.endHold(); h = null; }
    const n = Math.round(c / 100);
    if (!h && Math.abs(c - n * 100) <= HOLD_TOL) {
      h = this.hold = { note: n, start: t, lastT: t, rest: false, kind: 'pass', sum: 0, sum2: 0, k: 0 };
    }
    const pt = { t, c, kind: 'pass' };
    this.pts.push(pt);
    if (h) {
      h.lastT = t;
      if (t - h.start >= REST_AFTER) {
        if (!h.rest) {
          // it's a resting note after all: colour the start of it too
          h.rest = true;
          h.kind = this.inRaga(h.note) ? 'raga' : 'off';
          for (let i = this.pts.length - 1; i >= 0 && this.pts[i].t >= h.start; i--) this.pts[i].kind = h.kind;
        }
        pt.kind = h.kind;
        const dv = c - h.note * 100;
        h.sum += dv; h.sum2 += dv * dv; h.k++;
      }
    }
    if (!this.heard) { this.heard = true; this.message(''); }
    const cut = t - SING_SECONDS - 1;
    while (this.pts.length && this.pts[0].t < cut) this.pts.shift();
  },

  silence(t) {
    if (this.hold && t - this.hold.lastT > GAP) this.endHold();
  },

  holdStats(h) {
    const mean = h.k ? h.sum / h.k : 0;
    const sd = h.k > 1 ? Math.sqrt(Math.max(0, h.sum2 / h.k - mean * mean)) : 0;
    return { note: h.note, dur: h.lastT - h.start, mean, sd, inRaga: h.kind !== 'off' };
  },
  endHold() {
    const h = this.hold;
    this.hold = null;
    if (h && h.rest && h.lastT - h.start >= SHOW_HOLD) this.lastHold = this.holdStats(h);
  },

  // ---------- display ----------
  ui() {
    $('singBtn').setAttribute('aria-pressed', String(this.on));
    $('singView').hidden = !this.on;
    stage.hidden = this.on;
    document.querySelector('.navbar').classList.toggle('sing', this.on);
    if (!this.on && info) layout();
    if (this.on) this.message('');
  },

  message(text) { this.msgText = text; },

  noteLabel(n) {
    const off = ((n % 12) + 12) % 12;
    return swaraText(LETTERS[off], Math.floor(n / 12));
  },

  draw() {
    const cv = this.canvas, dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (W !== this.w || H !== this.h) {
      this.w = W; this.h = H;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const gutter = 36, colW = clamp(W * 0.2, 120, 190), nowX = W - colW;
    $('singRead').style.width = colW + 'px';
    const pps = (nowX - gutter) / SING_SECONDS;
    const c = this.ctxRef || ctx;
    if (!this.frozen) this.tNow = c ? c.currentTime - this.winSec / 2 : 0;
    const tNow = this.tNow;
    const last = this.pts[this.pts.length - 1];
    const live = last && tNow - last.t < 0.15 && !this.frozen ? last : null;

    // Follow the voice up and down, keeping it away from the edges.
    const span = clamp(H / 17, 12, 26) * 100;
    if (live) {
      const m = span * 0.2;
      if (live.c > this.target + span / 2 - m) this.target = live.c - span / 2 + m;
      else if (live.c < this.target - span / 2 + m) this.target = live.c + span / 2 - m;
    }
    this.target = clamp(this.target, -2400, 3600);
    const fNow = performance.now(), dt = Math.min(0.1, (fNow - (this.lastFrame || fNow)) / 1000);
    this.lastFrame = fNow;
    this.center += (this.target - this.center) * Math.min(1, dt * 5);
    const yOf = cents => H / 2 - (cents - this.center) / span * H;

    // Swara lines: the raga's notes; Sa in saffron; faint hairlines for notes outside the raga.
    const r = currentRaga(), restNote = this.hold && this.hold.rest ? this.hold.note : null;
    g.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (let n = Math.ceil((this.center - span / 2) / 100); n <= Math.floor((this.center + span / 2) / 100); n++) {
      const off = ((n % 12) + 12) % 12, y = Math.round(yOf(n * 100)) + 0.5;
      const isSa = off === 0, inR = this.inRaga(n), on = n === restNote;
      const letter = LETTERS[off];
      if (on) {
        g.strokeStyle = this.hold.kind === 'off' ? 'rgba(255, 107, 94, .6)' : 'rgba(242, 163, 58, .7)'; g.lineWidth = 2;
      } else if (!inR) {
        g.strokeStyle = 'rgba(236, 234, 228, .05)'; g.lineWidth = 1;
      } else if (isSa) {
        g.strokeStyle = 'rgba(242, 163, 58, .5)'; g.lineWidth = 1.5;
      } else {
        const strong = !r.isFree && !r.isThaat && (r.vadi === letter || r.samvadi === letter);
        g.strokeStyle = `rgba(236, 234, 228, ${strong ? 0.22 : 0.13})`; g.lineWidth = 1;
      }
      if (!inR && !on) {
        g.beginPath(); g.moveTo(gutter, y); g.lineTo(nowX, y); g.stroke();
        continue;
      }
      g.beginPath(); g.moveTo(gutter, y); g.lineTo(nowX, y); g.stroke();
      g.fillStyle = on ? (this.hold.kind === 'off' ? TRACE.off : TRACE.raga) : isSa ? TRACE.raga : 'rgba(236, 234, 228, .6)';
      g.fillText(this.noteLabel(n), gutter - 8, y);
    }

    // Tabla matras: sam strongest, the start of each vibhag a little stronger.
    const lat = c ? (c.outputLatency || 0) : 0;
    if (!this.frozen) {
      const tabla = typeof Tabla !== 'undefined' && Tabla.playing;
      this.beats = this.beats.filter(b => b.t + lat > tNow - SING_SECONDS - 1 && (tabla || b.t + lat <= tNow));
    }
    for (const b of this.beats) {
      const x = nowX - (tNow - (b.t + lat)) * pps;
      if (x < gutter || x > nowX) continue;
      g.strokeStyle = b.sam ? 'rgba(242, 163, 58, .35)' : b.first ? 'rgba(236, 234, 228, .14)' : 'rgba(236, 234, 228, .06)';
      g.lineWidth = b.sam ? 2 : 1;
      g.beginPath(); g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, H); g.stroke();
    }

    // now line
    g.strokeStyle = 'rgba(236, 234, 228, .1)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(nowX + 0.5, 0); g.lineTo(nowX + 0.5, H); g.stroke();

    // The trace: grey while moving, saffron resting on a raga note, red resting outside the raga.
    g.save();
    g.beginPath(); g.rect(gutter, 0, nowX - gutter + 6, H); g.clip();
    g.lineWidth = 3; g.lineJoin = 'round'; g.lineCap = 'round';
    let prev = null, color = null;
    const flush = () => { if (color) g.stroke(); };
    for (const p of this.pts) {
      const x = nowX - (tNow - p.t) * pps, y = yOf(p.c);
      if (x < gutter - 10) { prev = { p, x, y }; continue; }
      const col = TRACE[p.kind];
      if (prev && p.t - prev.p.t <= GAP) {
        if (col !== color) { flush(); g.beginPath(); g.strokeStyle = color = col; g.moveTo(prev.x, prev.y); }
        g.lineTo(x, y);
      } else {
        flush(); color = null;
        // a lone point still shows as a dot
        g.fillStyle = col; g.beginPath(); g.arc(x, y, 1.5, 0, 7); g.fill();
      }
      prev = { p, x, y };
    }
    flush();
    g.restore();
    if (live) {
      const y = yOf(live.c), col = TRACE[live.kind];
      g.fillStyle = col;
      g.beginPath(); g.arc(nowX, y, 5.5, 0, 7); g.fill();
      g.globalAlpha = 0.25;
      g.beginPath(); g.arc(nowX, y, 11, 0, 7); g.fill();
      g.globalAlpha = 1;
    }

    this.readout(live);
  },

  // The column to the right of the trace: what you're singing now, and how a held note went.
  readout(live) {
    const set = (id, v) => { const el = $(id); if (el.textContent !== v) el.textContent = v; };
    const read = $('singRead');
    if (live) {
      const n = Math.round(live.c / 100), off = ((n % 12) + 12) % 12, dev = Math.round(live.c - n * 100);
      const inR = this.inRaga(n);
      read.classList.toggle('off', !inR && !!this.hold && this.hold.rest);
      read.classList.remove('idle');
      set('srSw', this.noteLabel(n));
      set('srName', inR ? `${KIND[off]} ${SWARA_NAME[off]}`.trim() : `not in ${currentRaga().isFree ? 'raga' : currentRaga().name}`);
      set('srCents', (dev > 0 ? '+' : dev < 0 ? '−' : '') + Math.abs(dev) + '¢');
      $('srNeedle').style.left = (50 + clamp(dev, -50, 50)) + '%';
      const h = this.hold;
      if (h && h.rest && h.lastT - h.start >= SHOW_HOLD) {
        const st = this.holdStats(h);
        set('srHold', `${st.dur.toFixed(1)} s · ±${Math.round(st.sd)}¢`);
      } else set('srHold', '');
    } else {
      read.classList.add('idle');
      read.classList.remove('off');
      if (!this.frozen) $('srNeedle').style.left = '50%';
    }

    // Bottom bar: level, then a hint, an error, or how the last held note went.
    $('singLevel').style.width = clamp((20 * Math.log10(Math.max(this.level, 1e-5)) + 60) / 50 * 100, 0, 100) + '%';
    let msg = this.msgText;
    if (!msg && this.frozen) msg = 'Paused · tap the trace to go on';
    else if (!msg && this.listening && !this.heard) msg = 'Sing “aa” on Sa. Earphones keep the tanpura out of the mic.';
    else if (!msg && this.lastHold) {
      const L = this.lastHold, m = Math.round(L.mean);
      msg = `Last held ${this.noteLabel(L.note)} ${L.dur.toFixed(1)} s · sat ${m > 0 ? '+' : m < 0 ? '−' : ''}${Math.abs(m)}¢ · wavered ±${Math.round(L.sd)}¢` + (L.inRaga ? '' : ' · not in the raga');
    }
    set('singMsg', msg);
  },
};

$('singBtn').onclick = () => Sing.toggle();
// Tap the trace to pause it and look at what you just sang.
$('singView').addEventListener('pointerdown', () => {
  if (!Sing.listening) return;
  Sing.frozen = !Sing.frozen;
  if (!Sing.frozen) { Sing.hold = null; Sing.raw = []; }
});
// Coming back to the app: the phone may have stopped the microphone meanwhile.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !Sing.on || !Sing.listening) return;
  const live = Sing.stream && Sing.stream.getAudioTracks().some(t => t.readyState === 'live');
  if (!live) { Sing.mute(); Sing.listen(); }
});
