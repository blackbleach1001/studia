#!/usr/bin/env python3
"""Bazy pytań egzaminacyjnych → <przedmiot>/baza.html.

Dane: tools/src/baza/<przedmiot>.json — pytania z baz grupy, z odpowiedziami
sprawdzonymi i krótkim wyjaśnieniem (pola opisane w assets/baza.js).
Uruchom:  python3 tools/build_baza.py
"""
import html, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUBJ = {s["dir"]: s for s in json.loads((ROOT / "tools" / "subjects.json").read_text(encoding="utf-8"))}

def plq(n):
    return "pytanie" if n == 1 else ("pytania" if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else "pytań")

counts = {}
for src in sorted((ROOT / "tools" / "src" / "baza").glob("*.json")):
    d = src.stem
    data = json.loads(src.read_text(encoding="utf-8"))
    data["dir"] = d
    subj = SUBJ[d]
    h, s, l = subj["hsl"]
    n = len(data["items"])
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    page = f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>{html.escape(data["title"])} · {html.escape(subj["name"])}</title>
<link rel="apple-touch-icon" href="../assets/icon-180.png">
<link rel="stylesheet" href="../assets/study.css">
<style>:root{{--st-h:{h};--st-s:{s}%;--st-l:{l}%}}</style>
</head>
<body>
<div class="page">
<header class="hero">
<h1>{html.escape(data["title"])}</h1>
<p class="meta">{html.escape(data["sub"])} · {n} {plq(n)}</p>
</header>
<main id="baza"></main>
</div>
<script id="baza-data" type="application/json">{blob}</script>
<script src="../assets/baza.js"></script>
<script src="../assets/reader.js" data-home="../" data-back="./" data-back-label="{html.escape(subj["short"])}" data-title="{html.escape(data["title"].split(":")[0])}" data-nodock></script>
</body>
</html>
"""
    (ROOT / d / "baza.html").write_text(page, encoding="utf-8")
    counts[d] = n
    print(f"{d}/baza.html: {n} {plq(n)}")

# liczba pytań w bazach dla strony głównej (postęp: localStorage studia-baza-v1)
(ROOT / "assets" / "baza-index.js").write_text("window.STUDIA_BAZA_N=" + json.dumps(counts) + ";\n", encoding="utf-8")
