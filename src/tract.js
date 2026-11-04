/* Kelly-Lochbaum singer: a 44-section lossless-tube vocal tract (scattering junctions), Rosenberg glottal pulses, vibrato, optional epilarynx narrowing.
   No DOM, no Web Audio: renders Float32 samples. */
(function (g) {
  "use strict";
  const VOW = g.VOWELS || (typeof VOWELS !== "undefined" ? VOWELS : require("./vowels.js")), N = 44, BASE_LEN = 17.5, KEYS = Object.keys(VOW);
  const rng = (s) => () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; };
  const simRate = (lenCm) => 1540000 / lenCm; // one sample of delay per section per direction: section = c / fs, tract length = N c / fs, c = 35000 cm/s (88 kHz for 17.5 cm)
  /** Singer's-formant shaping, epi 0..1: the 2.5 cm just above the glottis (sections 1-6) is narrowed toward 0.6 cm^2 and the pharynx behind it (sections 7-14) widened toward 5 cm^2, in log-area steps. Measured effect and side effects are in the README. */
  function shaped(area, epi) { const a = Float64Array.from(area); if (epi > 0) { for (let i = 1; i <= 6; i++) a[i] = Math.exp((1 - epi) * Math.log(a[i]) + epi * Math.log(Math.min(a[i], 0.6))); for (let i = 7; i <= 14; i++) a[i] = Math.exp((1 - epi) * Math.log(a[i]) + epi * Math.log(Math.max(a[i], 5))); } return a; }
  /** Rosenberg glottal flow pulse, phase 0..1. */
  function pulse(ph, oq) { const tp = 0.4 * oq / 0.65, tn = 0.16 * oq / 0.65; if (ph < tp) return 0.5 * (1 - Math.cos(Math.PI * ph / tp)); if (ph < tp + tn) return Math.cos(Math.PI / 2 * (ph - tp) / tn); return 0; }
  /**
   * notes: [{t0, t1, f0, vow: [key] or [key, key] (diphthong), tie, rest}] in seconds, f0 in Hz (before transposition).
   * cfg: len (tract cm), epi (0..1), vib (cents), jit (0..1), breath (0..1), oq (0.4..0.9), seed, trace (bool)
   */
  function render(notes, cfg) {
    cfg = Object.assign({ len: BASE_LEN, epi: 0, vib: 28, jit: 0.5, breath: 0.4, oq: 0.65, seed: 1, trace: false, glide: 0.07 }, cfg || {});
    const fs = simRate(cfg.len), total = Math.max(...notes.map((n) => n.t1)) + 0.5, len = Math.ceil(total * fs), out = new Float32Array(len), r = rng(cfg.seed), tr = [];
    const area = new Float64Array(N).fill(3), ks = new Float64Array(N - 1);
    let f = new Float64Array(N), b = new Float64Array(N), nf = new Float64Array(N), nb = new Float64Array(N), lp = 0, ph = 0, jit = 0, vph = 0, ni = 0, prevAmp = 0, hz = 120, cur = null;
    const target = new Float64Array(N), logA = new Float64Array(N).fill(Math.log(3));
    const setTarget = (n, frac) => { const v = n.vow, a = VOW[v[0]].area, c = v.length > 1 ? VOW[v[v.length - 1]].area : a, s = v.length > 1 ? Math.min(1, Math.max(0, (frac - 0.55) / 0.4)) : 0, w = s * s * (3 - 2 * s); const m = new Float64Array(N); for (let i = 0; i < N; i++) m[i] = a[i] * (1 - w) + c[i] * w; const sh = shaped(m, cfg.epi); for (let i = 0; i < N; i++) target[i] = Math.log(sh[i]); };
    const coef = 1 - Math.exp(-32 / (cfg.glide * fs)), ampK = 1 - Math.exp(-1 / (0.006 * fs)), jitK = 1 - Math.exp(-1 / (0.0115 * fs)), loss = Math.pow(0.9995, 0.5), lpa = 0.5;
    let amp = 0, ampT = 0, started = false;
    for (let s = 0; s < len; s++) {
      const t = s / fs;
      while (ni < notes.length && t >= notes[ni].t1) ni++;
      const n = ni < notes.length && t >= notes[ni].t0 ? notes[ni] : null;
      if (s % 32 === 0) {
        if (n && !n.rest) { setTarget(n, (t - n.t0) / (n.t1 - n.t0)); if (!started) { for (let i = 0; i < N; i++) logA[i] = target[i]; started = true; } }
        for (let i = 0; i < N; i++) { logA[i] += (target[i] - logA[i]) * coef; area[i] = Math.exp(logA[i]); }
        for (let j = 0; j < N - 1; j++) ks[j] = (area[j] - area[j + 1]) / (area[j] + area[j + 1]);
        if (n && !n.rest) { const tt = t - n.t0, dur = n.t1 - n.t0, atk = Math.min(0.03, dur / 4), rel = Math.min(0.06, dur / 3); let e = Math.min(1, tt / atk) * Math.min(1, (n.t1 - t) / rel); if (!n.tie && tt < 0.05 && !n.legato) e *= 0.55 + 0.45 * Math.min(1, tt / 0.05); ampT = e; } else ampT = 0;
        if (cfg.trace && s % 640 === 0) tr.push({ t, area: Float64Array.from(area), f0: hz, amp: ampT });
      }
      amp += (ampT - amp) * ampK;
      // glottal source
      let u = 0;
      if (n && !n.rest) {
        const dur = n.t1 - n.t0, tt = t - n.t0, vd = dur > 0.35 ? cfg.vib * Math.min(1, Math.max(0, (tt - 0.25) / 0.3)) : 0; vph += 2 * Math.PI * 5.6 / fs;
        jit += (r() * 0.0025 * cfg.jit - jit) * jitK; hz = n.f0 * Math.pow(2, (vd * Math.sin(vph) / 1200)) * (1 + jit);
        ph += hz / fs; if (ph >= 1) ph -= 1; u = pulse(ph, cfg.oq) * amp + cfg.breath * 0.03 * r() * amp;
      }
      nf[0] = u + 0.9 * b[0];
      for (let j = 0; j < N - 1; j++) { const k = ks[j]; nf[j + 1] = (1 + k) * f[j] - k * b[j + 1]; nb[j] = k * f[j] + (1 - k) * b[j + 1]; }
      lp += lpa * (f[N - 1] - lp); nb[N - 1] = -0.9 * lp;
      out[s] = f[N - 1] + nb[N - 1];
      for (let j = 0; j < N; j++) { nf[j] *= loss; nb[j] *= loss; }
      let t1 = f; f = nf; nf = t1; t1 = b; b = nb; nb = t1;
    }
    // decimate by 2 with a 63-tap windowed-sinc low-pass (cutoff 0.45 of the new rate)
    const taps = 63, h = new Float64Array(taps), mid = (taps - 1) / 2, fc = 0.225; let hs = 0; for (let i = 0; i < taps; i++) { const x = i - mid, w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (taps - 1)); h[i] = (x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x)) * w; hs += h[i]; } for (let i = 0; i < taps; i++) h[i] /= hs;
    const dn = new Float32Array(Math.floor(len / 2)); for (let i = 0; i < dn.length; i++) { let a = 0; const c = i * 2; for (let k = 0; k < taps; k++) { const j = c + k - mid; if (j >= 0 && j < len) a += h[k] * out[j]; } dn[i] = a; }
    return { samples: dn, rate: fs / 2, simRate: fs, trace: tr, len: cfg.len };
  }
  /** Impulse response of a fixed vowel (no source model): used by tests to compare with the chain-matrix formants. */
  function impulse(areaVec, n, o) {
    o = Object.assign({ rg: 0.9, rl: 0.9, lpa: 0.5, loss: 0.99975 }, o || {});
    const ks = new Float64Array(N - 1); for (let j = 0; j < N - 1; j++) ks[j] = (areaVec[j] - areaVec[j + 1]) / (areaVec[j] + areaVec[j + 1]);
    let f = new Float64Array(N), b = new Float64Array(N), nf = new Float64Array(N), nb = new Float64Array(N), lp = 0; const out = new Float64Array(n);
    for (let s = 0; s < n; s++) { nf[0] = (s === 0 ? 1 : 0) + o.rg * b[0]; for (let j = 0; j < N - 1; j++) { const k = ks[j]; nf[j + 1] = (1 + k) * f[j] - k * b[j + 1]; nb[j] = k * f[j] + (1 - k) * b[j + 1]; } lp += o.lpa * (f[N - 1] - lp); nb[N - 1] = -o.rl * lp; out[s] = f[N - 1] + nb[N - 1]; for (let j = 0; j < N; j++) { nf[j] *= o.loss; nb[j] *= o.loss; } let t1 = f; f = nf; nf = t1; t1 = b; b = nb; nb = t1; }
    return out;
  }
  g.KLTract = { render, impulse, simRate, shaped, VOWELS: VOW, KEYS, N, BASE_LEN };
  if (typeof module !== "undefined") module.exports = g.KLTract;
})(typeof window !== "undefined" ? window : globalThis);
