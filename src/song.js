/* Daisy Bell chorus. Pitches and rhythm follow a public BASIC transcription (G major, 3/4, quarter = 1 beat); the syllable-to-note alignment and the vowels are the author's, and the alignment of the last lines is approximate. */
(function (g) {
  "use strict";
  const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = (s) => { const m = /^([A-G])(#?)(\d)$/.exec(s); return 12 * (+m[3] + 1) + NAMES[m[1]] + (m[2] ? 1 : 0); };
  // [pitch, beats, syllable, vowels, tie] ; pitch null = rest. Vowel keys: i I E ae A V O U u (see vowels.js)
  const CHORUS = [
    [null, 0.5], ["D3", 3, "Dai", ["E", "I"]], ["B2", 3, "sy", ["i"]], ["G2", 3, "Dai", ["E", "I"]], ["D2", 3, "sy", ["i"]], [null, 1],
    ["E2", 1, "give", ["I"]], ["F#2", 1, "me", ["i"]], ["G2", 1, "your", ["O"]], ["E2", 2, "an", ["ae"]], ["G2", 1, "swer", ["E"]], ["D2", 3, "do", ["u"]], ["D2", 2, "", ["u"], 1], [null, 1],
    ["A2", 3, "I'm", ["A", "I"]], ["D3", 3, "half", ["ae"]], ["B2", 3, "cra", ["E", "I"]], ["G2", 2, "zy", ["i"]], [null, 1],
    ["E2", 1, "all", ["O"]], ["F#2", 1, "for", ["O"]], ["G2", 1, "the", ["V"]], ["A2", 2, "love", ["V"]], ["B2", 1, "of", ["V"]], ["A2", 4, "you", ["u"]], [null, 1],
    ["B2", 1, "It", ["I"]], ["C3", 1, "won't", ["O", "U"]], ["B2", 1, "be", ["i"]], ["A2", 1, "a", ["V"]], ["D3", 2, "styl", ["A", "I"]], ["B2", 1, "ish", ["I"]], ["A2", 1, "mar", ["A"]], ["G2", 4, "riage", ["I"]],
    ["A2", 1, "I", ["A", "I"]], ["B2", 2, "can't", ["ae"]], ["G2", 1, "af", ["ae"]], ["E2", 2, "ford", ["O"]], ["G2", 1, "a", ["V"]], ["E2", 1, "car", ["A"]], ["D2", 2, "riage", ["I"]], ["D2", 1, "", ["I"], 1], [null, 1],
    ["D2", 1, "But", ["V"]], ["G2", 2, "you'll", ["u"]], ["B2", 1, "look", ["U"]], ["A2", 1, "sweet", ["i"]], [null, 1],
    ["G2", 1, "up", ["V"]], ["G2", 2, "on", ["A"]], ["B2", 1, "the", ["V"]], ["A2", 1, "seat", ["i"]], [null, 1],
    ["B2", 0.5, "of", ["V"]], ["C3", 0.5, "a", ["V"]], ["D3", 1, "bi", ["A", "I"]], ["B2", 1, "cy", ["I"]], ["G2", 1, "cle", ["V"]], ["A2", 2, "built", ["I"]], ["D2", 1, "for", ["O"]], ["G2", 2, "two", ["u"]]
  ];
  /** Notes in seconds. bpm: quarter notes per minute, transpose: semitones. */
  function notes(bpm, transpose) {
    const spb = 60 / bpm, out = []; let t = 0;
    for (const e of CHORUS) { const dur = e[1] * spb; if (e[0] === null) { t += dur; continue; }
      out.push({ t0: t, t1: t + dur * (e[4] ? 1 : 0.94), f0: 440 * Math.pow(2, (midi(e[0]) + transpose - 69) / 12), vow: e[3], tie: !!e[4], syl: e[2], midi: midi(e[0]) + transpose, legato: false });
      t += dur; }
    // a tied continuation joins the previous note
    const merged = []; for (const n of out) { const p = merged[merged.length - 1]; if (n.tie && p && Math.abs(p.f0 - n.f0) < 1e-9 && Math.abs(p.t1 - n.t0) < 0.2) { p.t1 = n.t1; } else merged.push(n); }
    merged.forEach((n, i) => { const p = merged[i - 1]; if (p && n.t0 - p.t1 < 0.02) n.legato = false; });
    return merged;
  }
  g.DaisySong = { CHORUS, notes, midi };
  if (typeof module !== "undefined") module.exports = g.DaisySong;
})(typeof window !== "undefined" ? window : globalThis);
