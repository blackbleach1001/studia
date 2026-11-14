#!/usr/bin/env python3
"""Podpina wygląd „pro” (pro.css, pro.js) i tryb sesji (sesja.css, sesja.js) do stron
w nowym szablonie (te, które ładują study.css i mają <main>). Idempotentne.
Starsze notatki (overlay.css) na razie zostają bez zmian — dojdą z adapterem.
Uruchamiane w tools/build_all.sh przed version_assets.py."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
n = 0
for page in list(ROOT.glob("*.html")) + list(ROOT.glob("*/*.html")):
    if "tools" in page.parts:
        continue
    t = page.read_text(encoding="utf-8")
    legacy = "overlay.css" in t
    if not legacy and "<main" not in t:
        continue
    m = re.search(r'<link[^>]*href="((?:\.\./)?)assets/%s\.css[^"]*"[^>]*>' % ("overlay" if legacy else "study"), t)
    if not m:
        continue
    pre = m.group(1)
    o = t
    if legacy:
        if "assets/sesja.js" in t:
            continue
        t = t.replace(m.group(0), m.group(0) + f'\n<link rel="stylesheet" href="{pre}assets/pro.css">\n<link rel="stylesheet" href="{pre}assets/sesja.css">\n<link rel="stylesheet" href="{pre}assets/sesja-legacy.css">', 1)
        t = t.replace("</body>", f'<script src="{pre}assets/sesja.js"></script>\n</body>', 1)
        page.write_text(t, encoding="utf-8"); n += 1
        continue
    if "assets/pro.css" not in t:
        t = t.replace(m.group(0), m.group(0) + f'\n<link rel="stylesheet" href="{pre}assets/pro.css">\n<link rel="stylesheet" href="{pre}assets/sesja.css">', 1)
    if "assets/pro.js" not in t:
        t = t.replace("</body>", f'<script src="{pre}assets/pro.js"></script>\n<script src="{pre}assets/sesja.js"></script>\n</body>', 1)
    if t != o:
        page.write_text(t, encoding="utf-8")
        n += 1
print("pro/sesja podpięte do", n, "stron")
