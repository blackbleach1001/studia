#!/usr/bin/env python3
"""Dopisuje do adresów plików w assets/ znacznik wersji (?v=…) liczony z ich treści.
Dzięki temu Safari po każdej zmianie pobiera nowe style i skrypty zamiast
używać starych z pamięci podręcznej.  Uruchom po każdej zmianie:
    python3 tools/version_assets.py
"""
import hashlib, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets"

def h(p):
    return hashlib.sha1(p.read_bytes()).hexdigest()[:8]

def setv(text, name, ver):
    # name lub name?v=xxxx  →  name?v=ver
    return re.sub(r'(?<![\w-])(%s)(\?v=[0-9a-f]+)?(?=["\')])' % re.escape(name), r"\1?v=" + ver, text)

# 1) reader.css jest importowany w study.css i overlay.css
rv = h(A / "reader.css")
for css in ["study.css", "overlay.css"]:
    p = A / css
    p.write_text(setv(p.read_text(encoding="utf-8"), "reader.css", rv), encoding="utf-8")

# 2) pozostałe pliki — po aktualizacji importów
vers = {n: h(A / n) for n in ["study.css", "overlay.css", "reader.css", "reader.js", "flashcards.js", "srs.js", "check.js", "today.js", "test.js", "cards-index.js", "sim.css", "sim.js", "models.css", "models.js", "home.js", "search-index.js"]}

for page in list(ROOT.glob("*.html")) + list(ROOT.glob("*/*.html")):
    if "tools" in page.parts:
        continue
    t = page.read_text(encoding="utf-8")
    n = t
    for name, v in vers.items():
        n = setv(n, "assets/" + name, v)
    cj = page.parent / "cards.js"
    if cj.exists():
        n = setv(n, "cards.js", h(cj))
    if n != t:
        page.write_text(n, encoding="utf-8")
print(vers)
