#!/usr/bin/env python3
"""Plan semestru: tools/src/plan.json → assets/plan-data.js + plan.html.

plan.json: zajęcia z planu (wydruk 24.10.2026) z literaturą, terminy zaliczeń
i „Plan nauki” z Notion (co na kiedy przeczytać lub powtórzyć).
Zajęcia, do których są notatki na stronie, dostają link (subjects.json → units).

Uruchom:  python3 tools/build_plan.py
"""
import hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUBJ = {s["dir"]: s for s in json.loads((ROOT / "tools" / "subjects.json").read_text(encoding="utf-8"))}
plan = json.loads((ROOT / "tools" / "src" / "plan.json").read_text(encoding="utf-8"))

def unit_href(s):
    """Zajęcia → plik notatek, jeśli istnieje (Wykład N / Ćwiczenia N / Zajęcia N)."""
    n = re.sub(r"\D", "", s["n"])
    labels = [f"Wykład {n}"] if s["kind"] == "W" else [f"Ćwiczenia {n}", f"Zajęcia {n}"]
    for u in SUBJ[s["subj"]]["units"]:
        if u["label"] in labels:
            return f'{s["subj"]}/{u["file"]}'
    return None

for s in plan["sessions"]:
    h = unit_href(s)
    if h:
        s["href"] = h
# stały identyfikator zadania: odhaczenie w przeglądarce przetrwa zmiany kolejności
for t in plan["tasks"]:
    t["id"] = hashlib.sha1((t["date"] + t["subj"] + t["title"]).encode()).hexdigest()[:8]
plan["meta"] = {d: {"short": s["short"], "name": s["name"], "hsl": s["hsl"]} for d, s in SUBJ.items()}

(ROOT / "assets" / "plan-data.js").write_text(
    "window.STUDIA_PLAN=" + json.dumps(plan, ensure_ascii=False) + ";\n", encoding="utf-8")

(ROOT / "plan.html").write_text("""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Plan · Studia</title>
<meta name="theme-color" content="#fffdf9">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<link rel="stylesheet" href="assets/study.css">
<link rel="stylesheet" href="assets/plan.css">
<style>:root{--st-h:28;--st-s:22%;--st-l:45%}</style>
</head>
<body>
<div class="page plan">
  <header class="hero">
    <h1>Plan</h1>
    <p class="meta">Semestr zimowy 2026/27 · grupy C1, C3, C5</p>
  </header>
  <main id="plan"><noscript>Plan wymaga JavaScriptu.</noscript></main>
</div>
<script src="assets/plan-data.js"></script>
<script src="assets/plan.js"></script>
<script src="assets/reader.js" data-home="./" data-back="./" data-back-label="Studia" data-title="Plan" data-nodock></script>
</body>
</html>
""", encoding="utf-8")
print(f'plan: {len(plan["sessions"])} zajęć, {len(plan["exams"])} zaliczeń, {len(plan["tasks"])} zadań')
