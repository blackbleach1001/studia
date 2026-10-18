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
    {"dir": "poznawcza", "file": "fiszki.html",
     "unit_by_src": [(r"rozdział 2", "wyklad-2.html"), (r"rozdział 3", "wyklad-3.html"), (r"rozdział [45]", "wyklad-4.html"),
                     (r"ćwiczenia", "cwiczenia-1.html"), (r".*", "wyklad-1.html")]},
    {"dir": "metodologia", "file": "fiszki.html",
     "unit_by_src": [(r"wykład 2", "wyklad-2.html"), (r"ćwiczenia", "cwiczenia-1.html"), (r".*", "wyklad-1.html")]},
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
        ensure_scripts(soup, ["../assets/srs.js", "../assets/flashcards.js", "cards.js", "../assets/check.js"], before="reader.js")
        (ROOT / d / u).write_text(str(soup), encoding="utf-8")

    # talia: identyfikatory w pliku fiszek + skrypt srs.js
    new_json = json.dumps(cards, ensure_ascii=False, indent=0).replace("</", "<\\/")
    html = html[:m.start(2)] + new_json + html[m.end(2):]
    fs = BeautifulSoup(html, "html.parser")
    ensure_scripts(fs, ["../assets/srs.js"], before="flashcards.js")
    fpath.write_text(str(fs), encoding="utf-8")

    (ROOT / d / "cards.js").write_text(
        "window.STUDIA_CARDS=" + json.dumps([{k: c[k] for k in ("id", "q", "a", "src")} for c in cards], ensure_ascii=False) + ";\n",
        encoding="utf-8")
    index.append({"deck": deck_name, "dir": d, "href": f'{d}/{deck["file"]}', "name": SUBJECTS[d]["name"],
                  "short": SUBJECTS[d]["short"], "hsl": SUBJECTS[d]["hsl"], "ids": [c["id"] for c in cards]})
    mapped = sum(1 for c in cards if c.get("sec"))
    print(f"{deck_name}: {len(cards)} fiszek, {mapped} przypisanych do sekcji")

(ROOT / "assets" / "cards-index.js").write_text(
    "window.STUDIA_INDEX=" + json.dumps(index, ensure_ascii=False) + ";\n", encoding="utf-8")
