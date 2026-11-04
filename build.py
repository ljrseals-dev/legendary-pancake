import re, pathlib
r = pathlib.Path(__file__).parent
t = (r / "demo/template.html").read_text()
full = (t.replace("/*DSP*/", (r / "src/dsp.js").read_text()).replace("/*VOWELS*/", (r / "src/vowels.js").read_text())
        .replace("/*TRACT*/", (r / "src/tract.js").read_text()).replace("/*SONG*/", (r / "src/song.js").read_text()))
(r / "index.html").write_text(full)
a = re.sub(r"<!--DL-->.*?<!--/DL-->", "", full, flags=re.S)
a = re.sub(r"/\*DL\*/.*?/\*/DL\*/", "", a, flags=re.S)
(r / "artifact.html").write_text(a)
print(len(full), len(a), "a.download" in a)
