#!/usr/bin/env python3
"""Dzieli pełne notatki przedmiotu (tools/src/*.html) na osobne strony
wykładów i ćwiczeń, dodaje nagłówek części i przejścia poprzednia/następna,
a dla każdego przedmiotu buduje stronę przedmiotu (index.html).

Uruchom z katalogu repozytorium:  python3 tools/build_units.py
"""
import copy, html, json, re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "src"

def load(name):
    return BeautifulSoup((SRC / f"{name}.html").read_text(encoding="utf-8"), "html.parser")

def esc(t):
    return html.escape(t, quote=True)

# ------------------------------------------------------------------
# wspólne: nagłówek części, przejścia, pasek czytania
# ------------------------------------------------------------------
def finish(soup, subj, unit, units, container):
    """Wstaw nagłówek części na początku kontenera, przejścia na końcu,
    podepnij nakładkę i pasek czytania z powrotem do strony przedmiotu."""
    # nagłówek części
    hero = BeautifulSoup(
        f'<header class="st-hero"><h1>{esc(unit["title"])}</h1>'
        + (f'<p class="st-meta">{esc(unit["sub"])}</p>' if unit.get("sub") else "")
        + (f'<p class="st-meta st-src">{esc(unit["src"])}</p>' if unit.get("src") else "")
        + "</header>", "html.parser")
    container.insert(0, hero)
    if unit.get("sim"):
        link = BeautifulSoup(
            f'<a class="sim-link" href="{unit["sim"]}"><span class="ic">{ICONS["sim"]}</span>'
            f'<span><b>Zobacz to w symulacjach</b><span class="s">Kliknij i obserwuj, jak zmieniają się dane</span></span></a>',
            "html.parser")
        container.insert(1, link)
    if unit.get("models"):
        link = BeautifulSoup(
            f'<a class="sim-link" href="{unit["models"]}"><span class="ic">{ICONS["models"]}</span>'
            f'<span><b>Mapa modeli i teorii</b><span class="s">Wszystkie koncepcje z wykładu i powiązania między nimi</span></span></a>',
            "html.parser")
        container.insert(2 if unit.get("sim") else 1, link)
    # przejścia
    seq = [u for u in units if u["kind"] != "info"]
    i = seq.index(unit) if unit in seq else None
    prev = seq[i - 1] if i is not None and i > 0 else None
    nxt = seq[i + 1] if i is not None and i < len(seq) - 1 else None
    pager = '<nav class="st-pager" aria-label="Części przedmiotu">'
    pager += (f'<a class="prev" href="{prev["file"]}"><span>Poprzednia</span><b>{esc(prev["label"])}</b><i>{esc(prev["title"])}</i></a>'
              if prev else '<span></span>')
    pager += (f'<a class="next" href="{nxt["file"]}"><span>Następna</span><b>{esc(nxt["label"])}</b><i>{esc(nxt["title"])}</i></a>'
              if nxt else '<span></span>')
    pager += "</nav>"
    if prev or nxt:
        container.append(BeautifulSoup(pager, "html.parser"))
    # tytuł karty
    if soup.title:
        soup.title.string = f'{unit["label"]} · {subj["name"]}'
    # pasek czytania: wstecz do przedmiotu
    for s in soup.find_all("script", src=re.compile(r"reader\.js$")):
        s.decompose()
    sc = soup.new_tag("script", src="../assets/reader.js")
    sc["data-home"] = "../"
    sc["data-back"] = "./"
    sc["data-back-label"] = subj["short"]
    sc["data-title"] = unit["label"] if unit["kind"] != "info" else "Informacje"
    soup.body.append(sc)
    # przycisk fiszek wskazuje nową stronę fiszek
    for a in soup.select(".fiszki-link a"):
        a["href"] = "fiszki.html"
    return soup

def write(subj, unit, soup):
    out = ROOT / subj["dir"] / unit["file"]
    out.write_text(str(soup), encoding="utf-8")

def drop(*els):
    for e in els:
        if e is not None:
            e.decompose()

# ------------------------------------------------------------------
# Psychologia poznawcza
# ------------------------------------------------------------------
def build_poznawcza(subj):
    units = subj["units"]
    for u in units:
        soup = load("poznawcza")
        drop(soup.select_one(".page > nav.toc"), soup.select_one("header.masthead"), soup.select_one("div.tabs"))
        # bez spisu treści strona ma jedną kolumnę (inaczej treść trafia do wąskiej kolumny spisu)
        fix = soup.new_tag("style")
        fix.string = ".page{grid-template-columns:minmax(0,1fr);max-width:50rem}"
        soup.head.append(fix)
        main = soup.select_one("main")
        sylabus = soup.find(id="sylabus")
        for hint in soup.select(".panel-hint"):
            hint.decompose()
        if u["key"] == "zaliczenie":
            for p in soup.select(".panel"):
                p.decompose()
            if sylabus.name == "section":
                for d in sylabus.find_all("details"):
                    d["open"] = ""
        else:
            sylabus.decompose()
            for p in soup.select(".panel"):
                if p.find(id=u["key"]) is None:
                    p.decompose()
                else:
                    if p.has_attr("hidden"):
                        del p["hidden"]
            for d in soup.select("details.unit"):
                if d.get("id") != u["key"]:
                    d.decompose()
            d = soup.find(id=u["key"])
            body = d.select_one(".unit-body")
            body["id"] = u["key"]
            d.replace_with(body)
        write(subj, u, finish(soup, subj, u, units, main))

# ------------------------------------------------------------------
# Podstawy metodologii i statystyki
# ------------------------------------------------------------------
def build_metodologia(subj):
    units = subj["units"]
    for u in units:
        if u.get("hand"):
            continue          # strona pisana ręcznie (np. wyklad-3.html)
        soup = load("metodologia")
        wrap = soup.select_one("div.wrap")
        drop(soup.select_one("div.switch"))
        for c in wrap.find_all(recursive=False):
            if c.name == "h1" or set(c.get("class") or []) & {"kicker", "sub", "dots"}:
                c.decompose()
        keep = set()
        first_part = wrap.find(id="wyklad")
        cw = wrap.select_one("div.cw-zone")
        w2 = wrap.find(id="wyklad2")
        footer = wrap.find("footer", recursive=False)
        order = list(wrap.find_all(recursive=False))
        def between(a, b):
            ia = order.index(a); ib = order.index(b) if b is not None else len(order)
            return order[ia:ib]
        if u["key"] == "zaliczenie":
            keep = {wrap.find(id="s0")}
            wrap.find(id="s0")["open"] = ""
        elif u["key"] == "wyklad-1":
            keep = set(between(first_part, cw)) - {wrap.find(id="s0")}
        elif u["key"] == "cwiczenia-1":
            keep = {cw}
        elif u["key"] == "wyklad-2":
            keep = set(between(w2, footer))
        keep.add(footer)
        for c in order:
            if c not in keep:
                c.decompose()
        for part in wrap.select("div.part[id]"):
            part.decompose()      # nagłówek „Część …” zastępuje nagłówek strony
        for t in wrap.select("nav.toc"):
            t.decompose()
        write(subj, u, finish(soup, subj, u, units, wrap))

# ------------------------------------------------------------------
# Psychologia kliniczna i zdrowia
# ------------------------------------------------------------------
def build_kliniczna(subj):
    units = subj["units"]
    for u in units:
        if u.get("hand"):
            continue
        soup = load("kliniczna")
        drop(soup.select_one("header.banner"), soup.select_one("body > nav.toc"))
        main = soup.select_one("main")
        order = list(main.find_all(recursive=False))
        div = main.select_one(".wyklad-divider")
        i = order.index(div)
        keep = order[:i] if u["key"] == "wyklad-1" else order[i + 1:]
        intro = main.find(id="wprowadzenie")
        if intro is not None:
            # wstęp opisywał wspólny plik obu wykładów — zostaje zakres i literatura
            drop(intro.find("div", class_="eyebrow"), intro.find("div", class_="pending"))
            if intro.find("h2"):
                intro.find("h2").string = "Zakres wykładu i literatura"
        for c in order:
            if c not in keep:
                c.decompose()
        write(subj, u, finish(soup, subj, u, units, main))

# ------------------------------------------------------------------
# Psychologia pracy i organizacji
# ------------------------------------------------------------------
def build_praca(subj):
    units = subj["units"]
    for u in units:
        if u.get("hand"):
            continue          # strona pisana ręcznie (wyklad-3.html)
        soup = load("praca")
        drop(soup.select_one("header.banner"))
        wrap = soup.select_one("div.wrap")
        order = list(wrap.find_all(recursive=False))
        divs = [c for c in order if "wyklad-divider" in (c.get("class") or [])]
        footer = wrap.find("footer", recursive=False)
        if u["key"] == "zaliczenie":
            keep = [wrap.select_one(".sylabus-card")]
        elif u["key"] == "wyklad-1":
            keep = order[order.index(divs[0]) + 1: order.index(divs[1])]
        else:
            keep = order[order.index(divs[1]) + 1:]
        keep = [k for k in keep if not ("sub" in (k.get("class") or []))]
        if footer is not None and footer not in keep:
            keep.append(footer)
        for c in order:
            if c not in keep:
                c.decompose()
        write(subj, u, finish(soup, subj, u, units, wrap))

# ------------------------------------------------------------------
# strona przedmiotu
# ------------------------------------------------------------------
ICONS = {
    "notes": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/></svg>',
    "cards": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11"/></svg>',
    "quiz": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
    "sim": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V4M4 20h16"/><path d="M7 15l4-5 3 3 5-7"/><circle cx="19" cy="6" r="1.2" fill="currentColor"/></svg>',
    "models": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.3 7l7.3.1M7.2 8.2l3.7 7.6M16.9 9.3l-3.7 6.6"/></svg>',
    "cal": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    "info": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
}

def row(href, kind, title, sub, alt=False):
    return (f'<li><a class="row" href="{href}"><span class="ic{" alt" if alt else ""}">{ICONS[kind]}</span>'
            f'<span class="tx"><span class="t">{esc(title)}</span>'
            + (f'<span class="s">{esc(sub)}</span>' if sub else "")
            + "</span></a></li>")

def hub(subj):
    groups = []
    for kind, label in [("wyk", "Wykłady"), ("cw", "Ćwiczenia"), ("zaj", "Zajęcia")]:
        us = [u for u in subj["units"] if u["kind"] == kind]
        if us:
            groups.append((label, "".join(row(u["file"], "notes", f'{u["label"]} · {u["title"]}', u.get("sub_short") or u.get("src", "")) for u in us)))
    sims = subj.get("sims", [])
    if sims:
        groups.append(("Symulacje", "".join(row(m["href"], "sim", f'{m["label"]} · Symulacje', m.get("title", "")) for m in sims)))
    mods = subj.get("models", [])
    if mods:
        groups.append(("Modele", "".join(row(m["href"], "models", f'{m["label"]} · Mapa modeli', m.get("title", "")) for m in mods)))
    extra = subj.get("practice", [])
    if any(p["kind"] == "cards" for p in extra):
        # talie fiszek zastępuje jeden test (tools/build_cards.py tworzy test.html)
        extra = [{"kind": "quiz", "title": "Test", "sub": "Wybierz wykład, wynik na koniec", "href": "test.html"}] + \
                [p for p in extra if p["kind"] != "cards"]
    if extra:
        groups.append(("Powtórka", "".join(row(p["href"], p["kind"], p["title"], p.get("sub", ""), alt=True) for p in extra)))
    info = [u for u in subj["units"] if u["kind"] == "info"]
    groups.append(("Informacje", row(f'../plan.html?p={subj["dir"]}#przedmioty', "cal", "Plan i literatura", "Terminy zajęć, lektury, zaliczenie", alt=True)
                   + "".join(row(u["file"], "info", u["title"], u.get("sub_short", ""), alt=True) for u in info)))
    if not groups:
        groups.append(("Materiały", '<li><span class="row empty">Brak materiałów</span></li>'))
    body = "".join(f'<section class="group"><h2>{esc(g)}</h2><ul class="ios-list">{rows}</ul></section>' for g, rows in groups)
    h, s, l = subj["hsl"]
    page = f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>{esc(subj["name"])}</title>
<link rel="apple-touch-icon" href="../assets/icon-180.png">
<link rel="stylesheet" href="../assets/study.css">
<style>:root{{--st-h:{h};--st-s:{s}%;--st-l:{l}%}} .page{{--sh:{h};--ss:{s}%;--sl:{l}%}}</style>
</head>
<body>
<div class="page hub">
  <header class="hero">
    <h1>{esc(subj["name"])}</h1>
    {f'<p class="meta">{esc(subj["meta"])}</p>' if subj.get("meta") else ""}
  </header>
  <main>{body}</main>
</div>
<script src="../assets/reader.js" data-home="../" data-nodock data-title="{esc(subj["short"])}"></script>
</body>
</html>
"""
    (ROOT / subj["dir"] / "index.html").write_text(page, encoding="utf-8")

def redirect(path, to):
    (ROOT / path).write_text(
        f'<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
        f'<meta http-equiv="refresh" content="0; url={to}"><link rel="canonical" href="{to}"><title>Przeniesiono</title></head>'
        f'<body><a href="{to}">{to}</a></body></html>', encoding="utf-8")

def build_index(subjects):
    book = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>'
    def rng(word_one, word_many, n):
        return f"{word_one} 1" if n == 1 else f"{word_many} 1–{n}"
    rows = []
    for subj in subjects:
        h, s_, l = subj["hsl"]
        n = lambda k: len([u for u in subj["units"] if u["kind"] == k and not u.get("extra")])
        parts = []
        if n("wyk"): parts.append(rng("Wykład", "Wykłady", n("wyk")))
        if n("cw"): parts.append(rng("Ćwiczenia", "Ćwiczenia", n("cw")))
        if n("zaj"): parts.append(rng("Zajęcia", "Zajęcia", n("zaj")))
        style = f'style="--sh:{h};--ss:{s_}%;--sl:{l}%"'
        if subj["units"]:
            rows.append(f'<li {style}><a class="row" href="{subj["dir"]}/"><span class="ic">{book}</span>'
                        f'<span class="tx"><span class="t">{esc(subj["name"])}</span><span class="s">{esc(" · ".join(dict.fromkeys(parts)))}</span></span></a></li>')
        else:
            rows.append(f'<li {style}><span class="row empty"><span class="ic alt">{book}</span>'
                        f'<span class="tx"><span class="t">{esc(subj["name"])}</span><span class="s">Brak materiałów</span></span></span></li>')
    page = f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Studia</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Studia">
<meta name="theme-color" content="#fffdf9">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<link rel="icon" href="assets/icon-180.png">
<link rel="stylesheet" href="assets/study.css">
<style>
:root{{--st-h:28;--st-s:22%;--st-l:45%}}
.page{{padding-top:max(28px,env(safe-area-inset-top))}}
.hero{{border:0;padding:20px 4px 4px}}
.hero h1{{font-size:2.5rem}}
.row.empty .t{{color:var(--ink-mute)}}
</style>
</head>
<body>
<div class="page hub">
  <header class="hero">
    <h1>Studia</h1>
    <p class="meta">Psychologia SWPS · Semestr 3</p>
    <form class="search" role="search" onsubmit="return false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
      <input type="search" id="q" placeholder="Szukaj w notatkach" aria-label="Szukaj w notatkach" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search">
    </form>
  </header>
  <main>
    <section class="group results" id="results" hidden><h2 id="results-h">Wyniki</h2><ul class="ios-list" id="results-list"></ul></section>
    <section class="group plan-home"><h2>Plan</h2><ul class="ios-list"><li style="--sh:28;--ss:22%;--sl:45%"><a class="row" href="plan.html" id="plan-row"><span class="ic">{ICONS["cal"]}</span><span class="tx"><span class="t">Plan semestru</span><span class="s">Zajęcia, lektury i terminy zaliczeń</span></span></a></li></ul></section>
    <section class="group"><h2>Przedmioty</h2><ul class="ios-list">{"".join(rows)}</ul></section>
  </main>
</div>
<script>window.STUDIA_SUBJECTS={json.dumps({s["dir"]: {"short": s["short"], "hsl": s["hsl"]} for s in subjects}, ensure_ascii=False)};</script>
<script src="assets/home.js" data-index="assets/search-index.js"></script>
<script src="assets/plan-data.js"></script>
<script src="assets/plan.js"></script>
</body>
</html>
"""
    (ROOT / "index.html").write_text(page, encoding="utf-8")

def fix_crosslinks(subj):
    """Odsyłacze #id prowadzące do innej części przedmiotu → plik.html#id."""
    files = [u["file"] for u in subj["units"]]
    pages = {f: (ROOT / subj["dir"] / f).read_text(encoding="utf-8") for f in files if (ROOT / subj["dir"] / f).exists()}
    owner = {}
    for f, t in pages.items():
        for i in re.findall(r'id="([^"]+)"', t):
            owner.setdefault(i, f)
    for f, t in pages.items():
        own = set(re.findall(r'id="([^"]+)"', t))
        def sub(m):
            target = m.group(1)
            if target in own or target not in owner:
                return m.group(0)
            return f'href="{owner[target]}#{target}"'
        n = re.sub(r'href="#([^"]+)"', sub, t)
        if n != t:
            (ROOT / subj["dir"] / f).write_text(n, encoding="utf-8")

# ------------------------------------------------------------------
SUBJECTS = json.loads((ROOT / "tools" / "subjects.json").read_text(encoding="utf-8"))
# mapy modeli (tools/src/modele/*.json) — link w części i grupa „Modele” na stronie przedmiotu
for _f in sorted((SRC / "modele").glob("*.json")):
    _d = json.loads(_f.read_text(encoding="utf-8"))
    for _s in SUBJECTS:
        if _s["dir"] != _d["dir"]:
            continue
        for _u in _s["units"]:
            if _u["key"] == _d["unit"]:
                _u["models"] = _d["file"]
for _s in SUBJECTS:
    _m = [{"label": u["label"], "title": u["title"], "href": u["models"]} for u in _s["units"] if u.get("models")]
    if _m:
        _s["models"] = _m
BUILDERS = {"poznawcza": build_poznawcza, "metodologia": build_metodologia,
            "kliniczna": build_kliniczna, "praca": build_praca}

if __name__ == "__main__":
    for subj in SUBJECTS:
        if subj["dir"] in BUILDERS:
            BUILDERS[subj["dir"]](subj)
            fix_crosslinks(subj)
        if subj["units"]:
            hub(subj)
        for old, new in subj.get("redirects", {}).items():
            redirect(f'{subj["dir"]}/{old}', new)
        print(subj["dir"], [u["file"] for u in subj["units"]])
    build_index(SUBJECTS)

