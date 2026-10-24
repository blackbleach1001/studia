#!/usr/bin/env python3
"""Fiszki → powtórki i „Sprawdź tę sekcję”.

1. Nadaje każdej fiszce stały identyfikator (talia:skrót pytania).
2. Przypisuje fiszki do sekcji notatek (Rozmowa — ręcznie; pozostałe —
   dopasowanie treści, w obrębie właściwego wykładu).
3. Zapisuje <przedmiot>/cards.js i assets/cards-index.js.
4. Wstawia do stron wykładów przyciski „Sprawdź tę sekcję” i „Sprawdź cały wykład”.

Uruchom po build_units.py:  python3 tools/build_cards.py [--show]
"""
import hashlib, json, math, re, sys
from collections import Counter, defaultdict
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SHOW = "--show" in sys.argv
SUBJECTS = {s["dir"]: s for s in json.loads((ROOT / "tools" / "subjects.json").read_text(encoding="utf-8"))}

# talie: katalog, plik fiszek, nazwa, reguła wyboru wykładu dla grupy pytań („src”)
DECKS = [
    {"dir": "rozmowa", "file": "zajecia-1-fiszki.html", "units": ["zajecia-1.html"],
     "manual": {1: "s1", 2: "s1", 3: "s1", 4: "s8", 5: "s8", 6: "s9", 7: "s10", 8: "s3",
                9: "s2", 10: "s4", 11: "s5", 12: "s6", 13: "s5", 14: "s7"}},
    {"dir": "edukacja", "file": "fiszki.html", "units": ["wyklad-1.html"],
     "manual": {1: "s1", 2: "s1", 3: "s1", 4: "s1", 5: "s2", 6: "s2", 7: "s2", 8: "s2", 9: "s3", 10: "s3",
                11: "s3", 12: "s4", 13: "s4", 14: "s5", 15: "s5", 16: "s6", 17: "s6", 18: "s6", 19: "s6"}},
    {"dir": "edukacja", "file": "cwiczenia-1-fiszki.html", "units": ["cwiczenia-1.html"],
     "manual": {1: "s1", 2: "s1", 3: "s1", 4: "s2", 5: "s2", 6: "s2", 7: "s2", 8: "s2", 9: "s3", 10: "s3", 11: "s3", 12: "s3", 13: "s3", 14: "s4", 15: "s4", 16: "s4", 17: "s5", 18: "s5", 19: "s6", 20: "s7", 21: "s7", 22: "s7", 23: "s8", 24: "s8", 25: "s8", 26: "s9"}},
    {"dir": "poznawcza", "file": "fiszki.html",
     "unit_by_src": [(r"rozdział 2", "wyklad-2.html"), (r"rozdział 3", "wyklad-3.html"), (r"rozdział [45]", "wyklad-4.html"),
                     (r"ćwiczenia", "cwiczenia-1.html"), (r".*", "wyklad-1.html")]},
    {"dir": "metodologia", "file": "wyklad-3-fiszki.html", "units": ["wyklad-3.html"],
     "manual": {1: 's1', 2: 's1', 3: 's1', 4: 's2', 5: 's2', 6: 's2', 7: 's3', 8: 's3', 9: 's3', 10: 's4', 11: 's4', 12: 's5', 13: 's5', 14: 's5', 15: 's5', 16: 's5', 17: 's5', 18: 's5', 19: 's5', 20: 's6', 21: 's6', 22: 's6', 23: 's6', 24: 's7', 25: 's7', 26: 's7', 27: 's7', 28: 's7', 29: 's7', 30: 's8', 31: 's8', 32: 's9', 33: 's10', 34: 's10', 35: 's11', 36: 's11'}},
    {"dir": "metodologia", "file": "fiszki.html",
     "unit_by_src": [(r"wykład 2", "wyklad-2.html"), (r"ćwiczenia", "cwiczenia-1.html"), (r".*", "wyklad-1.html")]},
    {"dir": "kliniczna", "file": "wyklad-3-fiszki.html", "units": ["wyklad-3.html"],
     "manual": {1: 's2', 2: 's2', 3: 's2', 4: 's2', 5: 's3', 6: 's3', 7: 's3', 8: 's3', 9: 's4', 10: 's4', 11: 's1', 12: 's6', 13: 's6', 14: 's7', 15: 's7', 16: 's7', 17: 's7', 18: 's9', 19: 's1', 20: 's1', 21: 's1', 22: 's1', 23: 's3', 24: 's3', 25: 's3', 26: 's4', 27: 's4', 28: 's4', 29: 's5', 30: 's6', 31: 's6', 32: 's6', 33: 's7', 34: 's7', 35: 's7', 36: 's8'}},
    {"dir": "kliniczna", "file": "wyklad-2-dziedziny-fiszki.html", "units": ["wyklad-2-dziedziny.html"],
     "manual": {1: 's1', 2: 's1', 3: 's1', 4: 's1', 5: 's1', 6: 's1', 7: 's1', 8: 's2', 9: 's2', 10: 's2', 11: 's2', 12: 's2', 13: 's2', 14: 's2', 15: 's2', 16: 's2', 17: 's2', 18: 's3', 19: 's3', 20: 's3', 21: 's3', 22: 's3', 23: 's3', 24: 's3', 25: 's3', 26: 's4', 27: 's4', 28: 's4', 29: 's4', 30: 's4', 31: 's4', 32: 's4', 33: 's5', 34: 's5', 35: 's5', 36: 's5', 37: 's5', 38: 's5', 39: 's5', 40: 's5', 41: 's6', 42: 's6', 43: 's6', 44: 's6', 45: 's6', 46: 's6', 47: 's6', 48: 's6', 49: 's6', 50: 's6'}},
    {"dir": "kliniczna", "file": "fiszki.html",
     "unit_by_src": [(r"podstawy|pojęcie zdrowia|modele zdrowia", ["wyklad-1.html"]),
                     (r"zastosowania|Heszen, Sęk, 2007", ["wyklad-2.html"]),
                     (r".*", ["wyklad-1.html", "wyklad-2.html"])]},
]

SKIP_SECTION = re.compile(r"sprawdź się|pytania kontrolne|wymagania z sylabusa|zaliczeni|literatura do|odniesienie do projektu|ściąga", re.I)
STOP = set("""oraz jest są się nie jak ale lub czy też tak przez przy dla jego jej ich ten tym tego która które który
jako może można gdy jeśli tylko także więc albo bardzo między poprzez czyli wtedy bez nad pod od do na we ze za
osoby osoba czym jakie jaki jaka jakie wymień podaj opisz wyjaśnij czym różni różnią""".split())

def text(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()

def toks(s):
    words = re.findall(r"[a-ząćęłńóśźż]{4,}", s.lower())
    return [w[:6] for w in words if w not in STOP]

def card_id(deck, q):
    return deck + ":" + hashlib.sha1(re.sub(r"\s+", " ", q).strip().encode()).hexdigest()[:8]

def load_cards(path):
    html = path.read_text(encoding="utf-8")
    m = re.search(r'(<script[^>]*\bid="cards"[^>]*>\s*)(.*?)(\s*</script>)', html, re.S)
    return html, m, json.loads(m.group(2).replace("<\\/", "</"))

# ---------- sekcje stron wykładów ----------
def sections(soup):
    """Zwraca listę (id, tytuł, element-kontener lub None, h2, tekst)."""
    out = []
    h2s = [h for h in soup.find_all("h2") if not h.find_parent(class_=["st-hero", "st-pager"])]
    for k, h in enumerate(h2s):
        title = text(h)
        cont = None
        for anc in h.parents:
            if anc.name in ("section", "details") and anc.get("id"):
                cont = anc; break
            if anc.name in ("main", "body") or (anc.get("class") and "unit-body" in anc.get("class")):
                break
        if cont is not None:
            sid, body = cont["id"], text(cont)
        else:
            sid = h.get("id") or f"sekcja-{k + 1}"
            h["id"] = sid
            parts, sib = [], h.next_sibling
            while sib is not None and not (getattr(sib, "name", None) == "h2"):
                if getattr(sib, "get_text", None):
                    parts.append(sib.get_text(" ", strip=True))
                sib = sib.next_sibling
            body = title + " " + " ".join(parts)
        out.append({"id": sid, "title": title, "cont": cont, "h2": h, "text": body})
    return out

def tfidf(docs):
    df = Counter()
    for d in docs:
        df.update(set(d))
    n = len(docs)
    def vec(tokens):
        tf = Counter(tokens)
        v = {t: (1 + math.log(c)) * math.log((n + 1) / (df.get(t, 0) + 1)) for t, c in tf.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1
        return {t: x / norm for t, x in v.items()}
    return vec

def cos(a, b):
    return sum(x * b.get(t, 0) for t, x in a.items())

# ---------- przyciski ----------
ICON = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="14" height="13" rx="2"/>'
        '<path d="M7 4h12a2 2 0 0 1 2 2v11"/></svg>')

def pl_q(n):
    return "pytanie" if n == 1 else ("pytania" if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else "pytań")

def check_html(ids, title, unit=False):
    n = len(ids)
    head = "Sprawdź cały wykład" if unit else "Sprawdź tę sekcję"
    if unit and title.startswith("Zajęcia"):
        head = "Sprawdź całe zajęcia"
    if unit and title.startswith("Ćwiczenia"):
        head = "Sprawdź całe ćwiczenia"
    return (f'<div class="st-check{" unit" if unit else ""}"><button type="button" data-check="{",".join(ids)}" '
            f'data-title="{title}">{ICON}<span class="st-check-tx"><b>{head}</b><span>{n} {pl_q(n)}</span></span></button></div>')

def ensure_scripts(soup, names, before=None):
    have = {Path(s["src"].split("?")[0]).name for s in soup.find_all("script", src=True)}
    anchor = None
    if before:
        anchor = soup.find("script", src=re.compile(re.escape(before)))
    for src in names:
        if Path(src).name in have:
            continue
        tag = soup.new_tag("script", src=src)
        if anchor is not None:
            anchor.insert_before(tag)
        else:
            soup.body.append(tag)

# ------------------------------------------------------------------
index = []
by_dir = defaultdict(list)      # wszystkie talie przedmiotu trafiają do jednego <przedmiot>/cards.js
for deck in DECKS:
    d = deck["dir"]
    deck_name = f'{d}/{Path(deck["file"]).stem}'
    fpath = ROOT / d / deck["file"]
    html, m, cards = load_cards(fpath)
    for c in cards:
        c["id"] = card_id(deck_name, c["q"])
        c.pop("unit", None); c.pop("sec", None)

    unit_files = deck.get("units") or sorted({x for _, u in deck["unit_by_src"] for x in (u if isinstance(u, list) else [u])})
    soups = {u: BeautifulSoup((ROOT / d / u).read_text(encoding="utf-8"), "html.parser") for u in unit_files}
    for s in soups.values():
        for old in s.select(".st-check"):
            old.decompose()
    secs = {u: [x for x in sections(soups[u]) if not SKIP_SECTION.search(x["title"])] for u in unit_files}

    # przypisanie
    if "manual" in deck:
        for i, c in enumerate(cards, 1):
            c["unit"], c["sec"] = unit_files[0], deck["manual"].get(i)
    else:
        all_secs = [(u, x) for u in unit_files for x in secs[u]]
        vec = tfidf([toks(x["text"]) for _, x in all_secs])
        svec = [(u, x, vec(toks(x["text"]))) for u, x in all_secs]
        for c in cards:
            cand_units = unit_files
            if "unit_by_src" in deck:
                for pat, u in deck["unit_by_src"]:
                    if re.search(pat, c.get("src", ""), re.I):
                        cand_units = u if isinstance(u, list) else [u]; break
            qv = vec(toks(c["q"] + " " + c["q"] + " " + re.sub("<[^>]+>", " ", c["a"])))
            scored = sorted(((cos(qv, v), u, x) for u, x, v in svec if u in cand_units), key=lambda t: -t[0])
            best = scored[0] if scored else (0, cand_units[0], None)
            second = scored[1][0] if len(scored) > 1 else 0
            c["unit"] = best[1]
            # sekcja tylko przy wyraźnym dopasowaniu; inaczej pytanie trafia do „cały wykład”
            c["sec"] = best[2]["id"] if best[2] and best[0] >= 0.16 and best[0] - second >= 0.02 else None
            if SHOW:
                print(f'{best[0]:.2f} {second:.2f} {c["unit"]:16} {(best[2]["title"][:38] if best[2] else "-"):38} | {"OK " if c["sec"] else "—  "}{c["q"][:70]}')

    # przyciski w notatkach
    for u in unit_files:
        soup = soups[u]
        unit_cards = [c for c in cards if c["unit"] == u]
        if not unit_cards:
            continue
        by_sec = defaultdict(list)
        for c in unit_cards:
            if c.get("sec"):
                by_sec[c["sec"]].append(c["id"])
        for x in sections(soup):
            ids = by_sec.get(x["id"])
            if not ids:
                continue
            btn = BeautifulSoup(check_html(ids, x["title"]), "html.parser")
            if x["cont"] is not None:
                body = x["cont"].find(class_=["body", "unit-body"], recursive=False) if x["cont"].name == "details" else None
                (body or x["cont"]).append(btn)
            else:
                # sekcja = nagłówek i rodzeństwo do następnego h2
                sib, last = x["h2"].next_sibling, x["h2"]
                while sib is not None and getattr(sib, "name", None) != "h2":
                    if getattr(sib, "name", None) and "sources" not in (sib.get("class") or []):
                        last = sib
                    sib = sib.next_sibling
                last.insert_after(btn)
        unit_meta = next((x for x in SUBJECTS[d]["units"] if x["file"] == u), {"label": "", "title": ""})
        whole = BeautifulSoup(check_html([c["id"] for c in unit_cards], unit_meta["label"], unit=True), "html.parser")
        pager = soup.select_one(".st-pager")
        footer = soup.select_one("footer.sources") or soup.select_one("main > footer, .wrap > footer, .page footer")
        if pager is not None:
            pager.insert_before(whole)
        elif footer is not None:
            footer.insert_before(whole)
        else:
            (soup.select_one("main") or soup.body).append(whole)
        # linki „Fiszki · N pytań” w notatkach prowadzą do testu z tego materiału
        for a in soup.select('.fiszki-link a, a[href$="fiszki.html"]'):
            a["href"] = f"test.html#{u}"
            a.string = "Test z tego materiału"
        ensure_scripts(soup, ["../assets/srs.js", "../assets/flashcards.js", "cards.js", "../assets/check.js"], before="reader.js")
        (ROOT / d / u).write_text(str(soup), encoding="utf-8")

    # talia: identyfikatory w pliku fiszek + skrypt srs.js
    new_json = json.dumps(cards, ensure_ascii=False, indent=0).replace("</", "<\\/")
    html = html[:m.start(2)] + new_json + html[m.end(2):]
    fs = BeautifulSoup(html, "html.parser")
    ensure_scripts(fs, ["../assets/srs.js"], before="flashcards.js")
    fpath.write_text(str(fs), encoding="utf-8")

    # u, s — wykład i sekcja (powtórki prowadzą do notatek, dystraktory z tego samego wykładu)
    # k — kluczowe punkty odpowiedzi (wpisane w talii): po odsłonięciu zaznaczasz, które pamiętałaś/eś
    by_dir[d].extend({k: c[k] for k in ("id", "q", "a", "src", "k") if c.get(k)} | {"u": c["unit"], "s": c.get("sec") or ""}
                     for c in cards)
    sec_index = []
    for u in unit_files:
        unit_meta = next((x for x in SUBJECTS[d]["units"] if x["file"] == u), {"label": "", "title": ""})
        titles = {x["id"]: x["title"] for x in sections(soups[u])}
        groups = defaultdict(list)
        for c in cards:
            if c["unit"] == u:
                groups[c.get("sec") or ""].append(c["id"])
        for s, ids in groups.items():
            sec_index.append({"u": u, "s": s, "ul": unit_meta["label"],
                              "t": titles.get(s) or unit_meta.get("title") or unit_meta["label"], "ids": ids})
    index.append({"deck": deck_name, "dir": d, "href": f'{d}/{deck["file"]}', "name": SUBJECTS[d]["name"],
                  "short": SUBJECTS[d]["short"], "hsl": SUBJECTS[d]["hsl"], "ids": [c["id"] for c in cards], "secs": sec_index})
    mapped = sum(1 for c in cards if c.get("sec"))
    print(f"{deck_name}: {len(cards)} fiszek, {mapped} przypisanych do sekcji")

for d, all_cards in by_dir.items():
    (ROOT / d / "cards.js").write_text(
        "window.STUDIA_CARDS=" + json.dumps(all_cards, ensure_ascii=False) + ";\n", encoding="utf-8")
    # test z przedmiotu (zamiast osobnych stron z fiszkami na stronie przedmiotu)
    subj = SUBJECTS[d]
    h, s, l = subj["hsl"]
    units = [{"u": u["file"], "label": u["label"], "title": u["title"]} for u in subj["units"] if u["kind"] != "info"]
    (ROOT / d / "test.html").write_text(f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Test · {subj["name"]}</title>
<link rel="apple-touch-icon" href="../assets/icon-180.png">
<link rel="stylesheet" href="../assets/study.css">
<style>:root{{--st-h:{h};--st-s:{s}%;--st-l:{l}%}}</style>
</head>
<body>
<div class="page">
<header class="hero">
<h1>Test</h1>
<p class="meta">{subj["name"]} · {len(all_cards)} {pl_q(len(all_cards))}</p>
</header>
<main id="test"></main>
</div>
<script id="test-units" type="application/json">{json.dumps(units, ensure_ascii=False)}</script>
<script src="../assets/srs.js"></script>
<script src="../assets/cards-index.js"></script>
<script src="../assets/flashcards.js"></script>
<script src="cards.js"></script>
<script src="../assets/test.js"></script>
<script src="../assets/reader.js" data-home="../" data-back="./" data-back-label="{subj["short"]}" data-title="Test" data-nodock></script>
</body>
</html>
""", encoding="utf-8")

(ROOT / "assets" / "cards-index.js").write_text(
    "window.STUDIA_INDEX=" + json.dumps(index, ensure_ascii=False) + ";\n", encoding="utf-8")
