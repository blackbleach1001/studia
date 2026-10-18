#!/usr/bin/env python3
"""Indeks wyszukiwania dla strony głównej: jedna pozycja na sekcję (h2) każdej części przedmiotu.
Zapisuje assets/search-index.js (window.STUDIA_SEARCH). Uruchom po build_cards.py."""
import json, re, sys
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
SUBJECTS = json.loads((ROOT / "tools" / "subjects.json").read_text(encoding="utf-8"))

DROP = "script, style, nav, .st-check, .st-pager, .st-hero, header.hero, footer, .sim-link, .dock, .toc, .switch"

def clean(s):
    return re.sub(r"\s+", " ", s).strip()

def sections(soup):
    """Sekcje strony: nagłówek h2 i treść do następnego h2 (lub kontener section/details z id)."""
    out = []
    main = soup.select_one("main") or soup.select_one(".wrap") or soup.body
    h2s = [h for h in main.find_all("h2")]
    for k, h in enumerate(h2s):
        title = clean(h.get_text(" "))
        cont = None
        for anc in h.parents:
            if anc.name in ("section", "details") and anc.get("id"):
                cont = anc; break
            if anc is main:
                break
        if cont is not None:
            sid, body = cont["id"], clean(cont.get_text(" "))
            if body.startswith(title):
                body = body[len(title):].strip()
        else:
            sid = h.get("id")
            if not sid:
                sid = h["id"] = f"sekcja-{k + 1}"   # kotwica dla wyników wyszukiwania
            parts, sib = [], h.next_sibling
            while sib is not None and getattr(sib, "name", None) != "h2":
                if getattr(sib, "get_text", None):
                    parts.append(sib.get_text(" "))
                sib = sib.next_sibling
            body = clean(" ".join(parts))
            if not body:                    # h2 opakowany (np. div.section-title) — treść całego bloku
                top = h
                while top.parent is not None and top.parent is not main:
                    top = top.parent
                if top is not h and len(top.find_all("h2")) == 1:
                    body = clean(top.get_text(" "))
                    if body.startswith(title):
                        body = body[len(title):].strip()
        if title and body:
            out.append({"id": sid, "t": title, "x": body})
    return out

entries = []
for subj in SUBJECTS:
    for u in subj["units"]:
        p = ROOT / subj["dir"] / u["file"]
        if not p.exists():
            continue
        page = BeautifulSoup(p.read_text(encoding="utf-8"), "html.parser")
        before = str(page)
        sections(page)                      # nadaje brakujące id nagłówkom h2
        if str(page) != before:
            p.write_text(str(page), encoding="utf-8")
        soup = BeautifulSoup(str(page), "html.parser")
        for el in soup.select(DROP):
            el.decompose()
        for s in sections(soup):
            entries.append({"d": subj["dir"], "u": u["label"], "h": f'{subj["dir"]}/{u["file"]}#{s["id"]}',
                            "t": s["t"], "x": s["x"]})

out = ROOT / "assets" / "search-index.js"
out.write_text("window.STUDIA_SEARCH=" + json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"wyszukiwarka: {len(entries)} sekcji, {out.stat().st_size // 1024} KB")
