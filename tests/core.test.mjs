import assert from "node:assert";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url), D = req("../src/dsp.js"), T = req("../src/tract.js"), S = req("../src/song.js"), V = req("../src/vowels.js");
const { formants } = await import("../tools/fit.mjs");

// 1. fitted vowels: plausible areas, chain-matrix formants within 3% of the targets
for (const k of T.KEYS) { const a = V[k].area; assert.equal(a.length, 44); assert(Math.min(...a) > 0.2 && Math.max(...a) < 16, k + " area range " + [Math.min(...a), Math.max(...a)]);
  const f = formants(Float64Array.from(a)); for (let i = 0; i < 3; i++) assert(Math.abs(f[i] / V[k].target[i] - 1) < 0.03, `${k} F${i + 1} ${f[i]} vs ${V[k].target[i]}`); }
console.log("vowel areas ok");

// 2. the time-domain scattering simulation, run with near-lossless ends so resonances are sharp, resonates where the chain-matrix says (6% allowed)
const spec = (x, n) => { const re = new Float64Array(n), im = new Float64Array(n); re.set(x.subarray(0, n)); D.fft(re, im, false); const m = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]); return m; };
for (const k of T.KEYS) { const area = Float64Array.from(V[k].area), n = 65536, m = spec(T.impulse(area, n, { rg: 0.995, rl: 0.995, lpa: 0.9, loss: 0.99999 }), n), fs = 88000, hz = (i) => i * fs / n, ref = formants(area), got = [];
  const sm = new Float64Array(m.length); for (let i = 3; i < m.length - 3; i++) { let s = 0; for (let j = -3; j <= 3; j++) s += m[i + j]; sm[i] = s / 7; }
  for (let q = 0; q < 3; q++) { let bi = 0, bv = 0; for (let i = Math.floor(ref[q] * 0.9 * n / fs); i <= Math.ceil(ref[q] * 1.1 * n / fs); i++) if (sm[i] > bv) { bv = sm[i]; bi = i; } got.push(hz(bi)); }
  for (let q = 0; q < 3; q++) assert(Math.abs(got[q] / ref[q] - 1) < 0.06, `${k} sim F${q + 1} ${got[q].toFixed(0)} vs tube ${ref[q].toFixed(0)}`);
  if (k === "A" || k === "i") console.log(`${k}: tube ${ref.slice(0, 3).map((x) => x.toFixed(0))}  simulation ${got.map((x) => x.toFixed(0))}`); }

// helpers for sung material
const hold = (v, f0, dur) => [{ t0: 0.05, t1: dur, f0, vow: [v], tie: false, legato: true }];
const seg = (r) => { const a = Math.floor(r.rate * 0.5), b = Math.floor(r.rate * 1.2); return r.samples.subarray(a, b); };
const decim = (x, rate, m) => { const y = new Float64Array(Math.floor(x.length / m)); for (let i = 0; i < y.length; i++) { let s = 0; const w = 3 * m; let ws = 0; for (let k = -w; k <= w; k++) { const j = i * m + k; if (j < 0 || j >= x.length) continue; const win = 0.5 + 0.5 * Math.cos(Math.PI * k / (w + 1)), sc = k === 0 ? 1 / m : Math.sin(Math.PI * k / m) / (Math.PI * k) * 1; s += x[j] * sc * win; ws += sc * win; } y[i] = s / (ws || 1); } return { x: y, rate: rate / m }; };
const lpcFormants = (x0, rate0, order0) => { const m = Math.round(rate0 / 11000), d = decim(x0, rate0, m), x = d.x, rate = d.rate, order = 14; const n = x.length, w = Float64Array.from(x, (v, i) => v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)))), r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) { let s = 0; for (let i = 0; i + k < n; i++) s += w[i] * w[i + k]; r[k] = s; } r[0] *= 1.0001;
  const a = new Float64Array(order + 1); a[0] = 1; let e = r[0]; for (let i = 1; i <= order; i++) { let acc = r[i]; for (let j = 1; j < i; j++) acc += a[j] * r[i - j]; const k = -acc / e, t = a.slice(); for (let j = 1; j < i; j++) a[j] = t[j] + k * t[i - j]; a[i] = k; e *= 1 - k * k; }
  const env = (f) => { let re = 0, im = 0; for (let k = 0; k <= order; k++) { re += a[k] * Math.cos(2 * Math.PI * f * k / rate); im -= a[k] * Math.sin(2 * Math.PI * f * k / rate); } return 1 / Math.hypot(re, im); };
  const pk = []; let pv = 0, cv = env(150), nv; for (let f = 160; f < 4000; f += 10) { nv = env(f); if (cv > pv && cv > nv) pk.push(f - 10); pv = cv; cv = nv; } return pk; };
const near = (pk, t) => pk.reduce((b, f) => (Math.abs(f - t) < Math.abs(b - t) ? f : b), 1e9);

// 3. sung vowels have the intended formants (LPC on the rendered audio, 12% allowed because LPC is biased by the harmonics)
for (const k of ["i", "I", "E", "ae", "A"]) { const r = T.render(hold(k, 110, 1.4), { vib: 0, jit: 0, breath: 0 }), pk = lpcFormants(seg(r), r.rate, 22);
  for (let q = 0; q < 2; q++) { const got = near(pk, V[k].target[q]), tol = q === 0 ? 0.18 : 0.12; if (q === 0 && V[k].target[0] < 500) continue; // F1 below 500 Hz sits between harmonics of a 110 Hz voice; LPC cannot place it (the impulse test covers it)
    assert(Math.abs(got / V[k].target[q] - 1) < tol, `sung ${k} F${q + 1}: ${got} vs ${V[k].target[q]} (peaks ${pk})`); }
  console.log(`sung ${k}: LPC peaks ${pk.slice(0, 4)}  targets ${V[k].target}`); }
console.log("sung vowel formants ok");

// 4. pitch: commanded f0 recovered within 6 cents, and the tract-length trick leaves pitch alone
const f0of = (x, rate, f0) => { let best = 0, bl = 0; const lo = Math.floor(rate / (f0 * 1.06)), hi = Math.ceil(rate / (f0 / 1.06)), n = x.length - hi - 1, rr = (l) => { let s = 0, a = 0, b = 0; for (let i = 0; i < n; i++) { s += x[i] * x[i + l]; a += x[i] * x[i]; b += x[i + l] * x[i + l]; } return s / Math.sqrt(a * b + 1e-30); };
  const v = []; for (let l = lo; l <= hi; l++) v.push(rr(l)); for (let i = 1; i < v.length - 1; i++) if (v[i] > v[best || 1] || !best) { best = i; } bl = best + lo; const y0 = v[best - 1], y1 = v[best], y2 = v[best + 1], d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2); return rate / (bl + d); };
for (const f0 of [98, 147, 220]) for (const len of [14, 17.5, 19]) { const r = T.render(hold("A", f0, 1.4), { vib: 0, jit: 0, breath: 0, len }), got = f0of(seg(r), r.rate, f0), c = 1200 * Math.log2(got / f0); assert(Math.abs(c) < 6, `f0 ${f0} len ${len}: ${c.toFixed(1)} cents`); }
console.log("pitch ok");
// 5. tract length scales formants inversely
{ const F2 = (len) => { const r = T.render(hold("A", 110, 1.4), { vib: 0, jit: 0, breath: 0, len }); return near(lpcFormants(seg(r), r.rate, 22), 1090 * 17.5 / len); }, a = F2(14), b = F2(19); console.log("tract 14 cm F2", a, "19 cm F2", b, "ratio", (a / b).toFixed(3), "want", (19 / 14).toFixed(3)); assert(Math.abs(a / b / (19 / 14) - 1) < 0.1); }
// 6. singer's formant shaping: the share of energy in 2.6-3.4 kHz rises for most vowels (and falls for /i/, whose F3 already sits near 3 kHz)
{ const share = (x, rate) => { const n = 16384, re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < n; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))); D.fft(re, im, false); const E = (lo, hi) => { let e = 0; for (let i = Math.floor(lo * n / rate); i < Math.floor(hi * n / rate); i++) e += re[i] * re[i] + im[i] * im[i]; return e; }; return 10 * Math.log10(E(2600, 3400) / E(100, 8000)); };
  const lift = {}; for (const k of ["A", "ae", "E", "O", "u", "i"]) { const at = (epi) => { const r = T.render(hold(k, 147, 1.6), { vib: 0, jit: 0, breath: 0, epi }); return share(r.samples.subarray(Math.floor(r.rate * 0.6)), r.rate); }; lift[k] = at(1) - at(0); }
  console.log("2.6-3.4 kHz energy share change with epi = 1 (dB):", JSON.stringify(Object.fromEntries(Object.entries(lift).map(([k, v]) => [k, +v.toFixed(1)]))));
  const mean = (["A", "ae", "E", "O", "u"].reduce((s, k) => s + lift[k], 0)) / 5; assert(mean > 4, "mean lift " + mean); for (const k of ["A", "ae", "E", "O", "u"]) assert(lift[k] > 1.5, "lift " + k + " " + lift[k]); assert(lift.i < 0, "/i/ weakens"); }
// 7. the song: note count, pitches, durations, finite audio
{ const n = S.notes(132, 12); const sy = n.filter((x) => x.syl).length; console.log("notes", n.length, "syllables", sy, "last end", n[n.length - 1].t1.toFixed(1), "s");
  assert.equal(n.length, 51); assert(Math.abs(n[0].f0 - 293.66) < 0.1, "first note D4 " + n[0].f0); assert(Math.abs(n[1].f0 - 246.94) < 0.1);
  for (let i = 1; i < n.length; i++) assert(n[i].t0 >= n[i - 1].t1 - 1e-9, "no overlap " + i);
  const r = T.render(n, {}); assert(r.samples.every(Number.isFinite)); assert(r.samples.some((v) => Math.abs(v) > 0.01));
  // every note region carries energy, every rest region is quieter than the quietest note
  const rms = (a, b) => { let s = 0, c = 0; for (let i = Math.floor(a * r.rate); i < Math.floor(b * r.rate) && i < r.samples.length; i++) { s += r.samples[i] ** 2; c++; } return Math.sqrt(s / Math.max(1, c)); };
  let minNote = 1e9; for (const x of n) minNote = Math.min(minNote, rms(x.t0 + (x.t1 - x.t0) * 0.3, x.t0 + (x.t1 - x.t0) * 0.7)); const tail = rms(n[n.length - 1].t1 + 0.2, n[n.length - 1].t1 + 0.45); console.log("quietest note rms", minNote.toFixed(4), "tail rms", tail.toExponential(1)); assert(minNote > 20 * tail, "notes sound, tail decays"); }
console.log("kelly lochbaum core tests ok");
