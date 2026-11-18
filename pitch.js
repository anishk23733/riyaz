'use strict';
// Pitch detection for the singing trace: the McLeod Pitch Method
// (McLeod & Wyvill, "A smarter way to find pitch", 2005). It finds the period from the
// normalised self-similarity of the waveform and picks the first strong repeat, which keeps
// it from jumping an octave up or down on voices with a weak or missing fundamental.
// Pure functions only (no DOM, no audio graph), so it can be tested on its own.
const Pitch = (() => {
  let work = new Float32Array(0), nsdf = new Float32Array(0);
  const K = 0.9; // a repeat counts if it is at least this similar as the best one

  // x: one window of samples (about 40 ms), sr: its sample rate.
  // Returns { hz, clarity (0–1, how clearly periodic), rms }. hz is 0 when nothing was found.
  function detect(input, sr, fmin = 60, fmax = 1500) {
    // Work at ~24 kHz: plenty for a voice's fundamental and 4× less work.
    const d = Math.max(1, Math.round(sr / 24000));
    const n = Math.floor(input.length / d);
    if (work.length < n) work = new Float32Array(n);
    const x = work;
    let mean = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < d; k++) s += input[i * d + k];
      x[i] = s / d;
      mean += x[i];
    }
    mean /= n;
    let e = 0;
    for (let i = 0; i < n; i++) { x[i] -= mean; e += x[i] * x[i]; }
    const rms = Math.sqrt(e / n);
    const res = { hz: 0, clarity: 0, rms };
    if (rms < 1e-5) return res;

    const fs = sr / d;
    const minLag = Math.max(2, Math.floor(fs / fmax));
    const maxLag = Math.min(Math.floor(n / 2), Math.ceil(fs / fmin));
    if (nsdf.length < maxLag + 2) nsdf = new Float32Array(maxLag + 2);

    // Normalised square difference: 2·r(τ) / m(τ), where m(τ) is the energy of both overlapping parts.
    let m = 2 * e;
    for (let tau = 0; tau <= maxLag + 1; tau++) {
      if (tau > 0) m -= x[tau - 1] * x[tau - 1] + x[n - tau] * x[n - tau];
      let r = 0;
      for (let j = 0, lim = n - tau; j < lim; j++) r += x[j] * x[j + tau];
      nsdf[tau] = m > 1e-12 ? 2 * r / m : 0;
    }

    // One candidate per positive lobe (after the lobe around lag 0).
    let tau = 1;
    while (tau <= maxLag && nsdf[tau] > 0) tau++;
    const peaks = [];
    let inLobe = false, bestTau = -1, best = -Infinity;
    for (; tau <= maxLag; tau++) {
      const v = nsdf[tau];
      if (v > 0) {
        if (!inLobe) { inLobe = true; bestTau = -1; best = -Infinity; }
        if (tau >= minLag && v > best) { best = v; bestTau = tau; }
      } else if (inLobe) {
        inLobe = false;
        if (bestTau > 0) peaks.push(bestTau);
      }
    }
    // a lobe still rising at the edge of the search isn't a real peak
    if (inLobe && bestTau > 0 && nsdf[bestTau] >= nsdf[bestTau + 1]) peaks.push(bestTau);
    if (!peaks.length) return res;

    let top = 0;
    for (const p of peaks) top = Math.max(top, nsdf[p]);
    const pick = peaks.find(p => nsdf[p] >= K * top);

    // Parabola through the peak and its neighbours: sub-sample period, so cents are accurate.
    const a = nsdf[pick - 1], b = nsdf[pick], c = nsdf[pick + 1];
    const den = a - 2 * b + c;
    const shift = den < 0 ? clampShift((a - c) / (2 * den)) : 0;
    res.hz = fs / (pick + shift);
    res.clarity = Math.min(1, b - (a - c) * shift / 4);
    return res;
  }
  const clampShift = s => Math.max(-0.5, Math.min(0.5, s));

  return { detect };
})();

if (typeof module !== 'undefined') module.exports = Pitch;
