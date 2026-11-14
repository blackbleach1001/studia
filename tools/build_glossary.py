#!/usr/bin/env python3
"""Pojęcia na start: kilka kluczowych pojęć z krótką definicją na początku
strony wykładu (zasada wstępnego przygotowania, Mayer).

Dane: tools/src/pojecia.json  {"przedmiot/plik.html": [["pojęcie", "definicja"], ...]}
Blok trafia za nagłówek części (i linki do symulacji/map). Uruchamianie wielokrotne
podmienia blok, nie dubluje go.

Uruchom po build_cards.py:  python3 tools/build_glossary.py
"""
import html, json
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "tools" / "src" / "pojecia.json").read_text(encoding="utf-8"))

def block(items):
    rows = "".join(f"<div><dt>{html.escape(t)}</dt><dd>{html.escape(d)}</dd></div>" for t, d in items)
    return (f'<section class="st-prime" aria-label="Pojęcia na start">'
            f'<p class="st-prime-h" role="heading" aria-level="2">Pojęcia na start</p><dl>{rows}</dl></section>')

for key, items in DATA.items():
    if key.startswith("_"):
        continue
    path = ROOT / key
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    for old in soup.select(".st-prime"):
        old.decompose()
    new = BeautifulSoup(block(items), "html.parser")
    hero = soup.select_one(".st-hero")
    if hero is not None:                      # strony budowane z notatek przedmiotu
        anchor = hero
        sib = hero.find_next_sibling()
        while sib is not None and "sim-link" in (sib.get("class") or []):
            anchor, sib = sib, sib.find_next_sibling()
        anchor.insert_after(new)
    else:                                     # strony pisane ręcznie: nagłówek header.hero, treść w <main>
        main = soup.select_one("main")
        if main is None:
            raise SystemExit(f"{key}: brak <main>")
        main.insert(0, new)
    path.write_text(str(soup), encoding="utf-8")
    print(f"{key}: {len(items)} pojęć")
