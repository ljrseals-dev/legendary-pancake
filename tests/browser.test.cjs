const { chromium } = require("playwright"), http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const server = http.createServer((q, r) => { r.setHeader("content-type", "text/html; charset=utf-8"); r.end(fs.readFileSync(path.join(__dirname, "..", "index.html"))); });
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r)); const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] }), p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); await p.goto(`http://127.0.0.1:${server.address().port}/`); await p.waitForFunction(() => window.__kl);
  const R = await p.evaluate(() => { const { renderSong, cfg } = window.__kl, res = renderSong(cfg()), x = res.r.samples; let m = 0, bad = 0, e = 0; for (let i = 0; i < x.length; i++) { m = Math.max(m, Math.abs(x[i])); if (!isFinite(x[i])) bad++; e += x[i] * x[i]; }
    const again = (window.__kl.S.key = "", renderSong(cfg())).r.samples; let same = true; for (let i = 0; i < x.length; i += 997) if (again[i] !== x[i]) same = false;
    return { ms: res.ms, secs: x.length / res.r.rate, rate: res.r.rate, peak: m, bad, rms: Math.sqrt(e / x.length), notes: res.notes.length, trace: res.r.trace.length, same, keys: document.querySelectorAll("#keys button").length, spans: document.querySelectorAll("#lyr span").length }; });
  console.log(JSON.stringify(R, (k, v) => typeof v === "number" ? +v.toPrecision(4) : v));
  assert.equal(R.bad, 0); assert(Math.abs(R.peak - 0.8) < 1e-3); assert(R.rms > 0.02); assert.equal(R.keys, 9); assert.equal(R.notes, 51); assert(R.same, "repeat renders identical"); assert(R.secs > 40 && R.secs < 60);
  await p.click("#sing"); await p.waitForFunction(() => document.getElementById("status").textContent === "singing", null, { timeout: 90000 }); await p.waitForTimeout(2500);
  const px = await p.evaluate(() => { const cnt = (id) => { const c = document.getElementById(id), g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1]) n++; return n; }; return { roll: cnt("roll"), tract: cnt("tract"), on: document.querySelectorAll("#lyr span.on").length, over: document.documentElement.scrollWidth > innerWidth + 1, dl: !!document.getElementById("dl"), vow: document.getElementById("hdVow").textContent }; });
  console.log(JSON.stringify(px)); assert(px.roll > 1000 && px.tract > 500, "canvases drawn"); assert(px.on === 1, "one syllable highlighted: " + px.on); assert(!px.over, "no horizontal scroll at 390 px");
  await p.click("#stop"); await p.click("#keys button:nth-child(5)"); await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("holding"), null, { timeout: 20000 });
  assert.deepEqual(errs, []); console.log("tube singer browser tests ok; save button:", px.dl); await b.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
