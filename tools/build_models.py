#!/usr/bin/env python3
"""Buduje strony „Mapa modeli” z danych w tools/src/modele/*.json.
Każdy plik opisuje jeden wykład: grupy, modele (teza, schemat, badanie, powiązania)
i tabele porównawcze.  Interakcję obsługuje assets/models.js.

Uruchom z katalogu repozytorium:  python3 tools/build_models.py
"""
import html, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "src" / "modele"
SUBJECTS = json.loads((ROOT / "tools" / "subjects.json").read_text(encoding="utf-8"))

def esc(t):
    return html.escape(t, quote=True)

def table(t):
    h = f'<div class="tw"><table><caption>{esc(t["caption"])}</caption><thead><tr>'
    h += "".join(f'<th scope="col">{esc(c)}</th>' for c in t["cols"]) + "</tr></thead><tbody>"
    for r in t["rows"]:
        h += f'<tr><th scope="row">{esc(r[0])}</th>' + "".join(f"<td>{esc(c)}</td>" for c in r[1:]) + "</tr>"
    return h + "</tbody></table></div>"

def page(d, subj, prev, nxt):
    hh, ss, ll = subj["hsl"]
    data = {k: d[k] for k in ("core", "groups", "models")}
    for m in data["models"]:
        if m.get("sec", "").startswith("#"):
            m["sec"] = d["notes"] + m["sec"]
    js = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    compare = ""
    if d.get("compare"):
        compare = ('<section class="mm-compare"><h2>Zestawienia</h2>'
                   '<p class="q">Teorie, które najłatwiej pomylić, obok siebie.</p>'
                   + "".join(table(t) for t in d["compare"]) + "</section>")
    pager = '<nav class="st-pager" aria-label="Mapy modeli">'
    pager += (f'<a class="prev" href="{prev["file"]}"><span>Poprzednia mapa</span><b>{esc(prev["label"])}</b><i>{esc(prev["title"])}</i></a>'
              if prev else f'<a class="prev" href="{d["notes"]}"><span>Notatki</span><b>{esc(d["label"])}</b><i>{esc(d["title"])}</i></a>')
    pager += (f'<a class="next" href="{nxt["file"]}"><span>Następna mapa</span><b>{esc(nxt["label"])}</b><i>{esc(nxt["title"])}</i></a>'
              if nxt else '<span></span>')
    pager += "</nav>"
    return f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Mapa modeli · {esc(d["label"])} · {esc(subj["name"])}</title>
<link rel="apple-touch-icon" href="../assets/icon-180.png">
<link rel="stylesheet" href="../assets/study.css">
<link rel="stylesheet" href="../assets/models.css">
<style>:root{{--st-h:{hh};--st-s:{ss}%;--st-l:{ll}%}} .page{{--sh:{hh};--ss:{ss}%;--sl:{ll}%}}</style>
</head>
<body>
<div class="page mm-page">
<header class="st-hero">
  <p class="st-eyebrow">Mapa modeli · {esc(d["label"])} · {esc(d["src"])}</p>
  <h1>{esc(d["title"])}</h1>
  <p class="st-meta">{esc(d["meta"])}</p>
</header>
<div id="mm"></div>
<section class="mm-time"><h2>Oś czasu</h2><p class="q">Kolejność powstawania koncepcji. Wybierz pozycję, żeby otworzyć model.</p><ol class="mm-tl" id="mm-time-list"></ol></section>
{compare}
{pager}
</div>
<script id="models" type="application/json">{js}</script>
<script src="../assets/models.js"></script>
<script src="../assets/reader.js" data-home="../" data-back="./" data-back-label="{esc(subj["short"])}" data-title="Mapa modeli · {esc(d["label"])}" data-nodock></script>
</body>
</html>
"""

def main():
    docs = [json.loads(f.read_text(encoding="utf-8")) for f in sorted(SRC.glob("*.json"))]
    for subj in SUBJECTS:
        order = [u["key"] for u in subj["units"]]
        mine = sorted([d for d in docs if d["dir"] == subj["dir"]], key=lambda d: order.index(d["unit"]))
        for i, d in enumerate(mine):
            prev = mine[i - 1] if i > 0 else None
            nxt = mine[i + 1] if i < len(mine) - 1 else None
            out = ROOT / subj["dir"] / d["file"]
            out.write_text(page(d, subj, prev, nxt), encoding="utf-8")
            print("mapa:", out.relative_to(ROOT), len(d["models"]), "modeli")

if __name__ == "__main__":
    main()
