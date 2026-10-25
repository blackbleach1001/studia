#!/usr/bin/env python3
"""Plan semestru: tools/src/plan_zajec.html (plan zajęć i literatura) → assets/plan-data.js + plan.html.

Jedyne źródło to plik planu: daty, sale, tematy, literatura do każdych zajęć,
zasady zaliczenia. Terminy kolokwiów i prac są wyciągane z opisów zajęć.
Zajęcia, do których są notatki na stronie, dostają link (subjects.json → units).

Uruchom:  python3 tools/build_plan.py
"""
import hashlib, json, re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SUBJ = {s["dir"]: s for s in json.loads((ROOT / "tools" / "subjects.json").read_text(encoding="utf-8"))}
SRC = BeautifulSoup((ROOT / "tools" / "src" / "plan_zajec.html").read_text(encoding="utf-8"), "html.parser")
DIRS = {"pozn": "poznawcza", "ppio": "praca", "edu": "edukacja", "klin": "kliniczna", "met": "metodologia", "roz": "rozmowa"}
TERM = re.compile(r"kolokwium|termin|losowanie", re.I)

def text(el):
    return el.get_text(" ", strip=True) if el else ""

plan = {"subjects": {}, "sessions": [], "exams": []}
for sec in SRC.select("section.sub"):
    d = DIRS[sec["id"]]
    subj = {"name": text(sec.h2), "meta": text(sec.select_one(".meta")),
            "pass": text(sec.select_one(".box")).replace("Zaliczenie:", "").strip(), "parts": []}
    for card in sec.select(".card"):
        kind = "W" if text(card.h3) == "Wykłady" else "C"
        rows = card.select(".dates li")
        lits = [{"h": text(h4), "items": [text(li) for li in h4.find_next_sibling("ul").select("li")]}
                for h4 in card.select(".lit h4")]
        # literatura po kolei do zajęć; nadmiarowa (lub wspólna dla wszystkich zajęć) — osobno
        per = lits[:len(rows)] if len(lits) >= len(rows) else []
        subj["parts"].append({"kind": kind, "who": text(card.select_one(".who")), "general": lits[len(per):]})
        for i, li in enumerate(rows):
            m = re.match(r"(\d\d)\.(\d\d)\.(\d{4})", text(li.select_one(".d")))
            date = f"{m[3]}-{m[2]}-{m[1]}"
            tm, place = [x.strip() for x in text(li.select_one(".r")).split("·")]
            start, end = tm.split("–")
            parts = [x.strip() for x in text(li.select_one(".t")).split(" · ")]
            topic = " · ".join([parts[0]] + [x for x in parts[1:] if not TERM.search(x)])
            s = {"subj": d, "kind": kind, "n": text(li.select_one(".n")), "date": date, "start": start, "end": end,
                 "place": place, "topic": topic, "lit": per[i]["items"] if per else []}
            if not per and lits:                      # jedna lista na wszystkie zajęcia (kliniczna, ćwiczenia)
                s["lit"], s["litAll"] = lits[0]["items"], True
            plan["sessions"].append(s)
            for x in parts[1:]:
                if TERM.search(x):
                    plan["exams"].append({"date": date, "subj": d, "text": x[0].upper() + x[1:]})
    plan["subjects"][d] = subj
# Rozmowa: Twoja grupa C2 (mgr Popa) ma inne terminy niż grupa C1 z pliku planu — terminy z PDF planu zajęć.
# Grupa C1 zostaje w zakładce Przedmioty jako zwinięta, wyszarzona opcja; resztę strony budują zajęcia z Popą.
popa = json.loads((ROOT / "tools" / "src" / "rozmowa_popa.json").read_text(encoding="utf-8"))
c1 = [s for s in plan["sessions"] if s["subj"] == "rozmowa"]
for s in c1:
    s["grp"], s["alt"] = "c1", True
# u Popy 5 zajęć: lektura 6. tematu (informacje zwrotne) dołączona do ostatnich zajęć 20.12
for i, x in enumerate(popa["sessions"]):
    src = c1[i] if i < len(c1) else {"topic": "", "lit": []}
    lit = src["lit"] + (c1[x["lit_extra"] - 1]["lit"] if x.get("lit_extra") else [])
    plan["sessions"].append({"subj": "rozmowa", "kind": "C", "n": str(i + 1), "grp": "popa", "date": x["date"],
                             "start": x["start"], "end": x["end"], "place": x["place"],
                             "topic": x.get("topic") or src["topic"], "lit": lit})
    if x.get("exam"):
        plan["exams"].append({"date": x["date"], "subj": "rozmowa", "text": x["exam"], "grp": "popa"})
for e in popa.get("exams", []):
    plan["exams"].append({"date": e["date"], "subj": "rozmowa", "text": e["text"], "grp": "popa"})
roz = plan["subjects"]["rozmowa"]
roz["pass"] = popa.get("pass", roz["pass"])
roz["parts"][0]["grp"] = "c1"
roz["parts"][0]["who"] = "Grupa C1 z planu zajęć: " + roz["parts"][0]["who"]
roz["parts"].insert(0, {"kind": "C", "grp": "popa", "who": popa["who"], "note": popa["note"], "general": []})
plan["exams"].sort(key=lambda e: e["date"])
plan["sessions"].sort(key=lambda s: (s["date"], s["start"]))
plan["exams"].sort(key=lambda e: e["date"])
plan["source"] = text(SRC.footer)
plan["intro"] = " ".join(text(p) for p in SRC.header.select("p"))

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
# stały identyfikator zajęć: „przeczytane” w przeglądarce przetrwa zmiany planu
for s in plan["sessions"]:
    s["id"] = hashlib.sha1((s["subj"] + s["kind"] + s["n"] + ("" if s.get("grp", "c1") == "c1" else s["grp"])).encode()).hexdigest()[:8]
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
    <p class="meta">Semestr zimowy 2026/27 · Twoje grupy: C2 (Rozmowa), C3, C5</p>
  </header>
  <main id="plan"><noscript>Plan wymaga JavaScriptu.</noscript></main>
</div>
<script src="assets/plan-data.js"></script>
<script src="assets/plan.js"></script>
<script src="assets/reader.js" data-home="./" data-back="./" data-back-label="Studia" data-title="Plan" data-nodock></script>
</body>
</html>
""", encoding="utf-8")
print(f'plan: {len(plan["sessions"])} zajęć, {len(plan["exams"])} terminów')
