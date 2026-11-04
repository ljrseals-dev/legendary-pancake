# Tube Singer (Daisy Bell)

A singing voice built the way Kelly and Lochbaum modelled the vocal tract at Bell Labs: a chain of 44 short tube sections with scattering junctions, excited by glottal pulses, with each vowel a tube shape (area function). The demo sings the chorus of Daisy Bell. The page shows a piano-roll score with syllables, an animated profile of the tube shape that is currently singing, and controls for tempo, transposition, vocal tract length, a singer's-formant shaping, vibrato and breath. Single vowels can be held from a key row. Everything runs in the browser; the song renders in about 2 s.

Open `index.html` (standalone, has Save WAV). `artifact.html` is the same page without the download button.

## Build and test
`python3 build.py`, then `node tests/core.test.mjs` and `NODE_PATH=$(npm root -g) node tests/browser.test.cjs` (headless Chromium through Playwright). `node tools/fit.mjs > src/vowels.js` regenerates the vowel shapes (about 20 s).

## How it works
- 44 uniform sections, one sample of delay per section per direction (so the sample rate is 1540000 / tract length in cm, 88 kHz for 17.5 cm); junction reflection k = (A1 - A2) / (A1 + A2); the glottis end reflects 0.9, the lip end -0.9 with a one-pole low-pass; output is decimated by 2 to 44 kHz.
- Source: Rosenberg glottal pulse, vibrato (5.6 Hz, ramped in on notes longer than 0.35 s), a little jitter and aspiration noise.
- Vowels: area functions fitted by a numerical search to approximate male formant targets (written from memory, Peterson and Barney style). They are **not anatomical measurements**.
- Tract length changes the simulation rate, so all resonances scale together and pitch is untouched.

## What is verified (measured)
- **Fitted vowels**: all nine have chain-matrix (lossless tube) formants within 3% of their targets (actual fit error under 1.2%); area range 0.25 to 14 cm^2.
- **Simulation geometry**: with near-lossless ends, the time-domain simulation resonates within 6% of the chain-matrix formants for all nine vowels (/i/: 270, 2280, 2977 Hz against 270, 2281, 2981).
- **Sung audio**: LPC on the rendered voice finds F1 and F2 near the targets for five vowels (for example /ɑ/ 680 and 1050 Hz against 730 and 1090; /ɛ/ 530 and 1830 against 530 and 1840).
- **Pitch**: commanded f0 recovered within 6 cents at 98, 147 and 220 Hz for tract lengths 14, 17.5 and 19 cm.
- **Tract length**: F2 of /ɑ/ at 14 cm over 19 cm is 1.333, against 1.357 expected.
- **Singer's formant shaping**: at full setting the 2.6 to 3.4 kHz share of energy rises by 6.1 dB (/ɑ/), 6.5 (/æ/), 4.8 (/ɛ/), 14.6 (/ɔ/) and 9.4 (/u/), and **falls by 9.4 dB for /i/** (its F3 already sits near 3 kHz).
- **Song**: 51 notes and syllables, no overlaps, finite audio, the tail decays; the page highlights the sung syllable and animates the tube; no page errors; no horizontal scroll at 390 px.

## Bugs found while building
The first version had the tract twice as long as intended (a section is c/fs long, not c/(2 fs)); a uniform tube resonated at 250 Hz instead of 500. Fixed, and the uniform-tube check is what found it.

## Not verified, and limits
- **Nobody has listened to this.** Whether it sounds like singing, or anything like the 1961 recording, is unknown.
- **Not a reconstruction.** I do not have the Bell Labs program or its tract data; this is a modern implementation of the published idea.
- **No consonants.** Every syllable is sung on vowels with a small dip between syllables; "Daisy" is "Ay-ee Ay-ee".
- **Melody and lyrics alignment.** The notes follow a public BASIC transcription (G major, 3/4); the syllable assignment is mine and the last lines are approximate. Check against a score before relying on it.
- **Singer's formant shaping** also lowers F1 (for /ɑ/ about 729 to 631 Hz in the tube calculation) and weakens /i/; it is a rough model of lowered-larynx singing, not a validated one.
- LPC cannot separate /ɔ/ and /u/'s close F1 and F2, so those two vowels are verified only through the tube-geometry test, not on the sung audio.
- The Bell Labs date is 1961 in some sources and 1960 in one; unresolved.

## Citations
See CREDITS.md.
