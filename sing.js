'use strict';
/* global $, S, ctx, audio, unlock, saMidi, mtof, info, currentRaga, LETTERS, SWARA_NAME, KIND, swaraText, clamp, Pitch, stage, layout */

// =====================================================================
// Sing: listens through the microphone and draws your voice's pitch as a line over the
// raga's swaras, so you can see meend, andolan and how steadily you hold a note. Everything
// sung in the session is kept: drag the trace to look back, and the notes you held are written
// out as sargam (on the trace, and as a transcript along the top) — sing a song to find its notes.
// =====================================================================
const SING_SECONDS = 8;   // time across the screen
const KEEP_POINTS = 65000; // history kept (~15 minutes of singing)
const HOLD_TOL = 45;      // cents: within this of a note you're on it
const HOLD_EXIT = 60;     // cents: and you stay on it until you move this far away
const REST_AFTER = 0.12;  // s on one note before it counts as a sung note (not just passing through)
const SHOW_HOLD = 0.5;    // s before a hold's numbers are shown
const GAP = 0.09;         // s without pitch that breaks the line
const PHRASE_GAP = 0.6;   // s between notes that starts a new phrase in the transcript
const SILENCE_KEEP = 0.8; // without tabla, a longer silence is shortened to this: the trace only moves while you sing
const TRACE = { pass: 'rgba(236, 234, 228, .55)', raga: '#f2a33a', off: '#ff6b5e' };

const Sing = {
  on: false, listening: false,
  stream: null, src: null, an: null, sink: null, ctxRef: null, data: null, winSec: 0.043, tOff: 0, vOff: 0, lastVoiced: null,
  pts: [], notes: [], ref: null, phrases: [], notesVer: 0, shownVer: -1, beats: [], raw: [], hold: null, lastHold: null,
  floor: 0.003, level: 0, center: 600, target: 600, lastT: -1, lastFrame: 0, lastAnalysis: 0,
  heard: false, raf: 0, w: 0, h: 0, msgText: '',
  view: null, // null = live; { t, center } while looking back
  geo: null,  // last drawn layout (for dragging)

  canvas: $('singCanvas'),

  toggle() { this.on ? this.close() : this.open(); },

  async open() {
    this.on = true;
    this.view = null;
    this.ui();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.frame());
    await this.listen();
  },

  close() {
    this.on = false;
    if (typeof Finder !== 'undefined') Finder.close();
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
    this.raw = [];
    this.hold = null;
    if (!this.pts.length) this.heard = false;
    this.message('');
  },

  mute() {
    this.endHold();
    this.listening = false;
    this.detach();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.setSession('playback');
  },

  // iPhone: recording needs the play-and-record audio session (iOS 17+ lets us choose it).
  setSession(type) { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch {} },

  // The session's clock: the audio clock, carried on smoothly if the audio engine is rebuilt.
  now() { const c = this.ctxRef || ctx; return c ? c.currentTime + this.tOff : 0; },

  // Trace time: the session clock with long silences taken out (unless the tabla is playing,
  // when real time matters for seeing the beats).
  liveT() {
    const real = this.now() - this.winSec / 2;
    const tabla = typeof Tabla !== 'undefined' && Tabla.playing;
    if (tabla || this.lastVoiced == null) return real - this.vOff;
    return Math.min(real, this.lastVoiced + SILENCE_KEEP) - this.vOff;
  },

  // Connect the microphone to the analyser (again, if the audio engine was rebuilt).
  attach() {
    const c = audio();
    if (this.ctxRef && this.ctxRef !== c) this.tOff = this.now() - c.currentTime;
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
  },
  detach() {
    for (const n of [this.src, this.an, this.sink]) { try { n && n.disconnect(); } catch {} }
    this.src = this.an = this.sink = null;
  },

  clear() {
    this.pts = [];
    this.notes = [];
    this.raw = [];
    this.hold = null;
    this.lastHold = null;
    this.notesVer++;
    this.view = null;
    this.heard = false;
    this.lastVoiced = null;
  },

  // Tabla tells us when each matra sounds, to mark the beats under the trace.
  beat(t, sam, first) {
    if (!this.on || ctx !== this.ctxRef) return;
    this.beats.push({ t: t + this.tOff - this.vOff, sam, first });
    if (this.beats.length > 6000) this.beats.splice(0, 1000);
  },

  // ---------- listening ----------
  frame() {
    if (!this.on) return;
    this.raf = requestAnimationFrame(() => this.frame());
    if (this.listening) {
      if (ctx !== this.ctxRef) this.attach();
      const now = performance.now();
      if (now - this.lastAnalysis >= 14) { this.lastAnalysis = now; this.analyse(); }
    }
    this.draw();
    this.renderNotes();
  },

  analyse() {
    const c = this.ctxRef;
    if (!c || c.state !== 'running') return;
    const t = this.now() - this.winSec / 2; // the middle of the window just heard
    if (t <= this.lastT) return; // the audio clock hasn't moved
    this.lastT = t;
    this.an.getFloatTimeDomainData(this.data);
    const p = Pitch.detect(this.data, c.sampleRate);

    // Room level: drops straight to quiet moments, creeps up slowly (so a long note isn't lost).
    this.floor = Math.max(0.0003, p.rms < this.floor ? this.floor * 0.6 + p.rms * 0.4 : this.floor * 1.0004);
    this.level = p.rms;
    const voiced = p.hz > 0 && p.clarity >= 0.8 && p.rms >= Math.max(0.0015, this.floor * 2.2);
    if (!voiced) { this.raw = []; this.silence(t - this.vOff); return; }
    // back from a long silence: take it out of the trace's time
    const tabla = typeof Tabla !== 'undefined' && Tabla.playing;
    if (this.lastVoiced != null && !tabla && t - this.lastVoiced > SILENCE_KEEP) this.vOff += t - this.lastVoiced - SILENCE_KEEP;
    this.lastVoiced = t;

    // Cents above your Sa, with a 3-frame median to drop single-frame glitches.
    const cents = 1200 * Math.log2(p.hz / mtof(saMidi()));
    this.raw.push(cents);
    if (this.raw.length > 3) this.raw.shift();
    const c3 = this.raw.length === 3 ? [...this.raw].sort((a, b) => a - b)[1] : cents;
    this.addPoint(t - this.vOff, c3, c3 + this.saRef());
  },

  inRaga(n) { return !info || info.all.includes(((n % 12) + 12) % 12); },

  // Your Sa in cents above A4. Each point also keeps its pitch in these absolute units (a),
  // so "Which raga?" can try other Sas, and changing Sa moves the trace with it.
  saRef() { return 1200 * Math.log2(mtof(saMidi()) / 440); },
  saChanged() {
    const ref = this.saRef();
    if (this.ref == null) { this.ref = ref; return; }
    const d = ref - this.ref;
    this.ref = ref;
    if (!d) return;
    for (const p of this.pts) p.c -= d;
    const k = Math.round(d / 100);
    for (const n of this.notes) { n.note -= k; n.kind = this.inRaga(n.note) ? 'raga' : 'off'; }
    this.hold = null; this.raw = []; this.lastHold = null;
    this.center -= d; this.target -= d;
    this.notesVer++;
  },

  addPoint(t, c, a) {
    if (this.ref == null) this.ref = this.saRef();
    let h = this.hold;
    if (h && (t - h.lastT > GAP || Math.abs(c - h.note * 100) > HOLD_EXIT)) { this.endHold(); h = null; }
    const n = Math.round(c / 100);
    if (!h && Math.abs(c - n * 100) <= HOLD_TOL) {
      h = this.hold = { note: n, start: t, lastT: t, rest: false, kind: 'pass', sum: 0, sum2: 0, k: 0, entry: null };
    }
    const pt = { t, c, a, kind: 'pass' };
    this.pts.push(pt);
    if (h) {
      h.lastT = t;
      if (t - h.start >= REST_AFTER) {
        if (!h.rest) {
          // it's a sung note after all: colour the start of it too, and write it down
          h.rest = true;
          h.kind = this.inRaga(h.note) ? 'raga' : 'off';
          for (let i = this.pts.length - 1; i >= 0 && this.pts[i].t >= h.start; i--) this.pts[i].kind = h.kind;
          h.entry = { note: h.note, start: h.start, end: t, kind: h.kind };
          this.notes.push(h.entry);
          this.notesVer++;
        }
        pt.kind = h.kind;
        h.entry.end = t;
        const dv = c - h.note * 100;
        h.sum += dv; h.sum2 += dv * dv; h.k++;
      }
    }
    if (!this.heard) { this.heard = true; this.message(''); }
    if (this.pts.length > KEEP_POINTS) {
      this.pts.splice(0, 5000);
      const t0 = this.pts[0].t;
      const drop = this.notes.findIndex(x => x.end >= t0);
      if (drop > 0) { this.notes.splice(0, drop); this.notesVer++; }
    }
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

  // ---------- looking back ----------
  live() { this.view = null; this.ui(); },
  review(t, center) {
    const tLive = this.liveT();
    const first = this.pts.length ? this.pts[0].t : tLive;
    this.view = { t: clamp(t, Math.min(tLive, first + SING_SECONDS * 0.4), tLive), center };
    this.ui();
  },
  // Jump to a phrase from the transcript.
  showPhrase(ph) {
    const span = this.geo ? this.geo.span : 1400;
    const lo = Math.min(...ph.notes.map(n => n.note)) * 100, hi = Math.max(...ph.notes.map(n => n.note)) * 100;
    const len = ph.end - ph.start;
    this.review(len < SING_SECONDS * 0.8 ? ph.end + (SING_SECONDS - len) / 2 : ph.start + SING_SECONDS * 0.9,
      hi - lo < span * 0.8 ? (lo + hi) / 2 : lo + span * 0.35);
  },

  // ---------- display ----------
  ui() {
    $('singBtn').setAttribute('aria-pressed', String(this.on));
    $('singView').hidden = !this.on;
    stage.hidden = this.on;
    document.querySelector('.navbar').classList.toggle('sing', this.on);
    $('singLive').hidden = !this.view;
    if (!this.on && info) layout();
  },

  message(text) { this.msgText = text; },

  noteLabel(n) {
    const off = ((n % 12) + 12) % 12;
    return swaraText(LETTERS[off], Math.floor(n / 12));
  },

  // The transcript along the top: every note you held, phrase by phrase.
  renderNotes() {
    if (this.shownVer === this.notesVer) return;
    this.shownVer = this.notesVer;
    const ph = [];
    for (const n of this.notes) {
      const cur = ph[ph.length - 1];
      if (cur && n.start - cur.end <= PHRASE_GAP) { cur.notes.push(n); cur.end = n.end; } else ph.push({ start: n.start, end: n.end, notes: [n] });
    }
    // the last note's end keeps moving while it's held: read it live from the note itself
    this.phrases = ph;
    const el = $('singNotes');
    el.innerHTML = ph.length
      ? ph.map((p, i) => `<button class="sn-ph" data-ph="${i}">${p.notes.map(n => `<span${n.kind === 'off' ? ' class="off"' : ''}>${this.noteLabel(n.note)}</span>`).join(' ')}</button>`).join('')
      : '<span class="sn-empty">The notes you sing will be written here</span>';
    $('singClear').hidden = !ph.length;
    if (!this.view) el.scrollLeft = el.scrollWidth;
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
    const tLive = this.liveT();
    const tNow = this.view ? this.view.t : tLive;
    const last = this.pts[this.pts.length - 1];
    const live = this.listening && last && tLive - last.t < 0.15 ? last : null;

    // Follow the voice up and down, keeping it away from the edges (or wherever you've dragged to).
    const span = clamp(H / 17, 12, 26) * 100;
    if (live) {
      const m = span * 0.2;
      if (live.c > this.target + span / 2 - m) this.target = live.c - span / 2 + m;
      else if (live.c < this.target - span / 2 + m) this.target = live.c + span / 2 - m;
    }
    this.target = clamp(this.target, -2400, 3600);
    const fNow = performance.now(), dt = Math.min(0.1, (fNow - (this.lastFrame || fNow)) / 1000);
    this.lastFrame = fNow;
    if (this.view) this.center = this.view.center;
    else this.center += (this.target - this.center) * Math.min(1, dt * 5);
    const yOf = cents => H / 2 - (cents - this.center) / span * H;
    const xOf = t => nowX - (tNow - t) * pps;
    this.geo = { pps, span, H, nowX };

    // Swara lines: the raga's notes; Sa in saffron; faint hairlines for notes outside the raga.
    const r = currentRaga(), restNote = !this.view && this.hold && this.hold.rest ? this.hold.note : null;
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
      g.beginPath(); g.moveTo(gutter, y); g.lineTo(nowX, y); g.stroke();
      if (!inR && !on) continue;
      g.fillStyle = on ? (this.hold.kind === 'off' ? TRACE.off : TRACE.raga) : isSa ? TRACE.raga : 'rgba(236, 234, 228, .6)';
      g.fillText(this.noteLabel(n), gutter - 8, y);
    }

    // Tabla matras: sam strongest, the start of each vibhag a little stronger.
    const lat = this.ctxRef ? (this.ctxRef.outputLatency || 0) : 0;
    const tabla = typeof Tabla !== 'undefined' && Tabla.playing;
    if (!tabla) while (this.beats.length && this.beats[this.beats.length - 1].t + lat > tLive) this.beats.pop();
    for (const b of this.beats) {
      const x = xOf(b.t + lat);
      if (x < gutter || x > nowX) continue;
      g.strokeStyle = b.sam ? 'rgba(242, 163, 58, .35)' : b.first ? 'rgba(236, 234, 228, .14)' : 'rgba(236, 234, 228, .06)';
      g.lineWidth = b.sam ? 2 : 1;
      g.beginPath(); g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, H); g.stroke();
    }

    // now line (live) / edge of what you're looking at
    g.strokeStyle = this.view ? 'rgba(236, 234, 228, .05)' : 'rgba(236, 234, 228, .1)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(nowX + 0.5, 0); g.lineTo(nowX + 0.5, H); g.stroke();

    // The trace: grey while moving, saffron on a raga note, red on a note outside the raga.
    const tFrom = tNow - SING_SECONDS - 0.2;
    let lo = 0, hi = this.pts.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.pts[mid].t < tFrom) lo = mid + 1; else hi = mid; }
    g.save();
    g.beginPath(); g.rect(gutter, 0, nowX - gutter + 6, H); g.clip();
    g.lineWidth = 3; g.lineJoin = 'round'; g.lineCap = 'round';
    let prev = lo > 0 ? { p: this.pts[lo - 1], x: xOf(this.pts[lo - 1].t), y: yOf(this.pts[lo - 1].c) } : null, color = null;
    const flush = () => { if (color) g.stroke(); };
    for (let i = lo; i < this.pts.length; i++) {
      const p = this.pts[i];
      if (p.t > tNow + 0.2) break;
      const x = xOf(p.t), y = yOf(p.c);
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

    // The sung notes, written over the trace where each one starts.
    g.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    let lastX = -1e9, lastY = 0;
    for (const n of this.notes) {
      if (n.end < tFrom) continue;
      if (n.start > tNow) break;
      const x = Math.max(gutter + 2, xOf(n.start)), y = yOf(n.note * 100) - 7;
      if (x - lastX < 16 && Math.abs(y - lastY) < 14) continue;
      g.fillStyle = n.kind === 'off' ? TRACE.off : 'rgba(236, 234, 228, .85)';
      g.fillText(this.noteLabel(n.note), x, y);
      lastX = x; lastY = y;
    }
    g.restore();

    if (live && !this.view) {
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
      $('srNeedle').style.left = '50%';
    }

    // Bottom bar: level, then a hint, an error, or how the last held note went.
    $('singLevel').style.width = clamp((20 * Math.log10(Math.max(this.level, 1e-5)) + 60) / 50 * 100, 0, 100) + '%';
    let msg = this.msgText;
    if (!msg && this.view) msg = 'Looking back · drag to move through what you sang · Live to return';
    else if (!msg && this.listening && !this.heard) msg = 'Sing “aa” on Sa. Earphones keep the tanpura out of the mic.';
    else if (!msg && this.lastHold) {
      const L = this.lastHold, m = Math.round(L.mean);
      msg = `Last held ${this.noteLabel(L.note)} ${L.dur.toFixed(1)} s · sat ${m > 0 ? '+' : m < 0 ? '−' : ''}${Math.abs(m)}¢ · wavered ±${Math.round(L.sd)}¢` + (L.inRaga ? '' : ' · not in the raga');
    }
    set('singMsg', msg);
  },
};

$('singBtn').onclick = () => Sing.toggle();
$('singLive').onclick = () => Sing.live();
$('singClear').onclick = () => Sing.clear();
$('singNotes').addEventListener('click', e => {
  const b = e.target.closest('[data-ph]');
  const ph = b && Sing.phrases[Number(b.dataset.ph)];
  if (ph) Sing.showPhrase(ph);
});

// Drag the trace to look back through what you sang (sideways = time, up/down = pitch);
// a tap stops it where it is, or goes back to live.
(() => {
  const area = $('singStage');
  let drag = null;
  area.addEventListener('pointerdown', e => {
    if (!Sing.geo) return;
    area.setPointerCapture(e.pointerId);
    const tLive = Sing.liveT();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, t: Sing.view ? Sing.view.t : tLive, center: Sing.center };
  });
  area.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    const { pps, span, H } = Sing.geo;
    Sing.review(drag.t - dx / pps, drag.center + dy / H * span);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) { if (Sing.view) Sing.live(); else if (Sing.pts.length) Sing.review(drag.t, drag.center); }
    drag = null;
  };
  area.addEventListener('pointerup', end);
  area.addEventListener('pointercancel', end);
})();

// Coming back to the app: the phone may have stopped the microphone meanwhile.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !Sing.on || !Sing.listening) return;
  const live = Sing.stream && Sing.stream.getAudioTracks().some(t => t.readyState === 'live');
  if (!live) { Sing.mute(); Sing.listen(); }
});
