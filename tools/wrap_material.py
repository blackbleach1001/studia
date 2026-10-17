#!/usr/bin/env python3
"""Dodaje starszy materiał HTML do strony.

- podpina nakładkę (Atkinson, 65 znaków, lewe wyrównanie) i pasek czytania,
- wyjmuje pytania sprawdzające (<details class="q">) do osobnej strony z fiszkami,
- w notatkach zostawia w ich miejscu przycisk do fiszek.

Użycie: wrap_material.py WEJŚCIE.html WYJŚCIE.html "Przedmiot" H S L
"""
import json, re, sys
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString

src, out, subject, h, s, l = sys.argv[1:7]
out = Path(out)
soup = BeautifulSoup(Path(src).read_text(encoding="utf-8"), "html.parser")
title = (soup.title.string if soup.title else out.stem).strip()

def text(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()

# ---------- pytania → fiszki ----------
cards, containers = [], {}
CHECK = re.compile(r"sprawdź się|pytania kontrolne|pytania sprawdzające|samosprawdzian", re.I)
def is_check(q):
    # tylko pytania z sekcji typu „Sprawdź się” / „Pytania kontrolne”;
    # ćwiczenia wplecione w treść zostają w notatkach
    h2 = q.find_previous("h2")
    return bool(h2 and CHECK.search(text(h2)))
for q in [x for x in soup.select("details.q") if is_check(x)]:
    summ = q.find("summary")
    ans = q.find(class_=["ans", "a"]) or q
    for n in summ.select(".n"):
        n.decompose()
    head = None
    for prev in q.find_all_previous(["h3", "h2"]):
        head = text(prev)
        break
    a_html = "".join(str(c) for c in ans.contents).strip()
    if not re.search(r"<(p|ul|ol|div|table)\b", a_html):
        a_html = "<p>" + a_html + "</p>"
    cards.append({"q": text(summ), "a": a_html, "src": head or ""})
    cont = q.find_parent(["section", "details"]) or q.parent
    containers.setdefault(id(cont), [cont, q])
    q["data-remove"] = "1"

fiszki_name = out.stem + "-fiszki.html"
for cont, first in containers.values():
    n = len([x for x in cont.select('details.q[data-remove]')])
    box = soup.new_tag("p", attrs={"class": "fiszki-link"})
    box.append(NavigableString("Pytania sprawdzające "))
    a = soup.new_tag("a", href=fiszki_name)
    a.string = "Fiszki"
    box.append(a)
    first.insert_before(box)
for q in soup.select("details.q[data-remove]"):
    q.decompose()
# zdania typu „kliknij, aby zobaczyć odpowiedź” tracą sens
for p in [x for cont, _ in containers.values() for x in cont.find_all("p")]:
    if p.decomposed: continue
    t = text(p).lower()
    if ("rozwiń" in t or "kliknij" in t or "zobaczyć odpowied" in t) and len(t) < 220 and "fiszki-link" not in (p.get("class") or []):
        p.decompose()

# ---------- nakładka i pasek ----------
head_el = soup.head
head_el.append(soup.new_tag("meta", attrs={"name": "robots", "content": "noindex, nofollow"}))
head_el.append(soup.new_tag("link", rel="apple-touch-icon", href="../assets/icon-180.png"))
head_el.append(soup.new_tag("link", rel="stylesheet", href="../assets/overlay.css"))
st = soup.new_tag("style"); st.string = f":root{{--st-h:{h};--st-s:{s}%;--st-l:{l}%}}"
head_el.append(st)
if not soup.find("meta", attrs={"name": "viewport"}):
    head_el.insert(0, soup.new_tag("meta", attrs={"name": "viewport", "content": "width=device-width, initial-scale=1"}))
sc = soup.new_tag("script", src="../assets/reader.js"); sc["data-home"] = "../"
soup.body.append(sc)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(str(soup), encoding="utf-8")

# ---------- strona z fiszkami ----------
if cards:
    page = f"""<!doctype html>
<html lang="pl" class="st-themed">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Fiszki · {title}</title>
<link rel="apple-touch-icon" href="../assets/icon-180.png">
<link rel="stylesheet" href="../assets/study.css">
<style>:root{{--st-h:{h};--st-s:{s}%;--st-l:{l}%}}</style>
</head>
<body>
<div class="page">
<header class="hero">
  <p class="eyebrow">{subject}</p>
  <h1>Fiszki</h1>
  <p class="meta">{title} · {len(cards)} pytań</p>
</header>
<main id="deck"></main>
</div>
<script type="application/json" id="cards">
{json.dumps(cards, ensure_ascii=False, indent=0).replace("</", "<\\/")}
</script>
<script src="../assets/flashcards.js"></script>
<script src="../assets/reader.js" data-nofocus data-home="../" data-back="{out.name}" data-back-label="Notatki"></script>
</body>
</html>
"""
    (out.parent / fiszki_name).write_text(page, encoding="utf-8")
print(out, "fiszki:", len(cards), "sekcje z pytaniami:", len(containers))
