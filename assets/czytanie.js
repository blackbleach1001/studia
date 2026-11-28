/* =========================================================
   Studia — czytanie: typografia, zakreślenia i notatki.
   Wzór: Medium / Substack (spokojna kolumna tekstu, dużo światła)
   i Readwise Reader (zaznacz → zakreśl kolorem → dopisz notatkę →
   przeglądaj i eksportuj zakreślenia).

   • Wygląd: krój, rozmiar, interlinia, szerokość kolumny (localStorage: studia-czytanie).
   • Zakreślenia: zaznacz tekst → kolor / notatka / kopiuj. Kliknij zakreślenie, by zmienić.
     Skróty: H – zakreśl, N – zakreśl z notatką. Zapis per strona (localStorage: studia-hl:<ścieżka>),
     zakotwiczone cytatem i kontekstem, więc przetrwają zmiany układu i tryb sesji.
   • Pasek postępu i czas czytania.
   Ładowany po reader.js, pro.js i sesja.js.
   ========================================================= */
(function () {
  "use strict";
  var page = document.querySelector(".page");
  var root = document.querySelector("main") || document.querySelector(".wrap");
  if (!root || (page && (page.classList.contains("hub") || page.classList.contains("plan")))) return;
  if (/(fiszki|test|trening|baza|makieta|sesja|zakreslenia)\.html$/.test(location.pathname)) return;   // narzędzia, nie teksty do czytania

  var script = document.currentScript;
  var RS = document.querySelector('script[src*="reader.js"]');
  var HOME = (RS && RS.dataset.home) || "../";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  var coarse = matchMedia("(pointer: coarse)").matches;
  var html = document.documentElement;
  root.classList.add("rd-root");

  /* =========================================================
     1. Wygląd tekstu
     ========================================================= */
  var RK = "studia-czytanie";
  var DEF = { font: "atk", size: 0, lh: "std", w: "std" };
  var R = Object.assign({}, DEF, load(RK, {}));
  var FONTS = {
    atk: { name: "Atkinson", label: "Czytelny", css: '"Atkinson Hyperlegible",system-ui,sans-serif' },
    lit: { name: "Literata", label: "Szeryfowy", css: 'Literata,"Iowan Old Style",Charter,Georgia,serif',
           href: "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400&display=swap" },
    sys: { name: "Systemowy", label: "Systemowy", css: 'system-ui,-apple-system,"Segoe UI",sans-serif' }
  };
  var SIZES = [-2, -1, 0, 1, 2, 3, 4];             // kroki po 6%
  var LH = { tight: 1.55, std: 1.72, loose: 1.9 };
  var W = { narrow: 58, std: 66, wide: 76 };
  function applyLook() {
    var f = FONTS[R.font] || FONTS.atk;
    if (f.href && !document.querySelector('link[data-rd-font="' + R.font + '"]')) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = f.href; l.setAttribute("data-rd-font", R.font); document.head.appendChild(l);
    }
    html.style.setProperty("--rd-font", f.css);
    html.style.setProperty("--rd-scale", (1 + 0.06 * R.size).toFixed(3));
    html.style.setProperty("--rd-lh", LH[R.lh] || LH.std);
    html.style.setProperty("--rd-ch", W[R.w] || W.std);
    html.classList.add("rd");
  }
  applyLook();

  /* =========================================================
     2. Czas czytania i postęp
     ========================================================= */
  var words = (root.textContent.match(/\S+/g) || []).length;
  var minutes = Math.max(1, Math.round(words / 190));
  var hero = document.querySelector("header.hero, header.st-hero, .hero");
  if (hero && words > 300 && !hero.querySelector(".rd-time")) {
    var tm = document.createElement("p"); tm.className = "rd-time";
    tm.textContent = "ok. " + minutes + " min czytania";
    var after = hero.querySelector(".meta:last-of-type") || hero.querySelector("h1");
    if (after && after.parentNode === hero) after.insertAdjacentElement("afterend", tm); else hero.appendChild(tm);
  }
  var bar = document.createElement("div"); bar.className = "rd-progress"; bar.setAttribute("aria-hidden", "true");
  var nav = document.querySelector(".st-nav");
  (nav || document.body).appendChild(bar);
  if (!nav) bar.classList.add("is-top");
  function progress() {
    if (html.classList.contains("ss")) { bar.style.transform = "scaleX(0)"; return; }
    var r = root.getBoundingClientRect(), vh = innerHeight;
    var total = r.height - vh * 0.6, done = Math.min(Math.max(-r.top + vh * 0.25, 0), Math.max(total, 1));
    bar.style.transform = "scaleX(" + (total > 0 ? done / total : 0).toFixed(4) + ")";
  }
  addEventListener("scroll", function () { requestAnimationFrame(progress); }, { passive: true });
  addEventListener("resize", progress); progress();

  /* =========================================================
     3. Zakreślenia — model i kotwiczenie cytatem
     ========================================================= */
  var HLON = words >= 200;                                   // zakreślenia tylko na stronach z tekstem
  var PATH = location.pathname.replace(/index\.html$/, "");
  var HK = "studia-hl:" + PATH;
  var COLORS = [["y", "Żółty"], ["g", "Zielony"], ["b", "Niebieski"], ["p", "Różowy"]];
  var h1 = document.querySelector("h1");
  var TITLE = (h1 ? h1.textContent : document.title).replace(/\s+/g, " ").trim();
  var DB = load(HK, null) || { t: TITLE, u: PATH, items: [] };
  DB.t = TITLE; DB.u = PATH;
  function save() {
    if (!DB.items.length) { try { localStorage.removeItem(HK); } catch (e) {} return; }
    DB.at = Date.now();
    if (!store(HK, DB)) toast("Nie udało się zapisać (brak miejsca w przeglądarce)");
  }
  var SKIP = ".hl-ui, .dock, .st-nav, .st-sheet, .rd-progress, .rd-time, .ss-kind, .ss-num, .ss-done, .ss-nav, .ss-bar, script, style, button, input, textarea, select, noscript";
  function textNodes() {
    var out = [], pos = 0;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { var p = n.parentElement; return p && !p.closest(SKIP) ? 1 : 2; }
    });
    for (var n = w.nextNode(); n; n = w.nextNode()) { out.push({ n: n, s: pos }); pos += n.data.length; }
    out.total = pos;
    out.text = out.map(function (x) { return x.n.data; }).join("");
    return out;
  }
  function pointOffset(node, off, nodes) {
    if (node.nodeType === 3) for (var i = 0; i < nodes.length; i++) if (nodes[i].n === node) return nodes[i].s + off;
    var r = document.createRange();
    try { r.setStart(node, node.nodeType === 3 ? Math.min(off, node.length) : off); } catch (e) { return -1; }
    r.collapse(true);
    for (var k = 0; k < nodes.length; k++) if (r.comparePoint(nodes[k].n, 0) >= 0) return nodes[k].s;
    return nodes.total;
  }
  function rangeToSpan(range) {
    var nodes = textNodes();
    var s = pointOffset(range.startContainer, range.startOffset, nodes), e = pointOffset(range.endContainer, range.endOffset, nodes);
    if (s < 0 || e <= s) return null;
    var T = nodes.text;
    while (s < e && /\s/.test(T[s])) s++;                      // bez białych znaków na brzegach
    while (e > s && /\s/.test(T[e - 1])) e--;
    if (e - s < 2) return null;
    return { s: s, e: e, x: T.slice(s, e), p: T.slice(Math.max(0, s - 40), s), q: T.slice(e, e + 40) };
  }
  function common(a, b, fromEnd) {
    var n = 0, la = a.length, lb = b.length;
    while (n < la && n < lb && (fromEnd ? a[la - 1 - n] === b[lb - 1 - n] : a[n] === b[n])) n++;
    return n;
  }
  function locate(it, T) {
    var best = -1, bestScore = -1, i = T.indexOf(it.x);
    while (i !== -1) {
      var sc = common(T.slice(Math.max(0, i - it.p.length), i), it.p, true) + common(T.slice(i + it.x.length, i + it.x.length + it.q.length), it.q, false);
      sc = sc * 1000 - Math.min(999, Math.abs(i - (it.o || 0)) / 50);
      if (sc > bestScore) { bestScore = sc; best = i; }
      i = T.indexOf(it.x, i + 1);
    }
    return best;
  }
  function wrap(it, s, e, nodes) {
    var marks = [];
    nodes.forEach(function (x) {
      var len = x.n.data.length, a = Math.max(s, x.s), b = Math.min(e, x.s + len);
      if (a >= b) return;
      var n = x.n;
      if (b - x.s < len) n.splitText(b - x.s);
      if (a - x.s > 0) n = n.splitText(a - x.s);
      if (!/\S/.test(n.data)) return;                          // np. odstępy między komórkami tabeli
      var m = document.createElement("mark");
      m.className = "hl"; m.setAttribute("data-hl", it.id); m.setAttribute("data-c", it.c);
      n.parentNode.insertBefore(m, n); m.appendChild(n); marks.push(m);
    });
    decorate(it, marks);
    return marks;
  }
  function marksOf(id) { return root.querySelectorAll('mark.hl[data-hl="' + id + '"]'); }
  function decorate(it, marks) {
    marks = marks || marksOf(it.id);
    Array.prototype.forEach.call(marks, function (m, i) {
      m.setAttribute("data-c", it.c);
      m.classList.toggle("has-note", !!it.n);
      m.classList.toggle("hl-end", i === marks.length - 1);
      m.title = it.n ? "Notatka: " + it.n : "";
    });
  }
  function unwrap(id) {
    Array.prototype.forEach.call(marksOf(id), function (m) {
      var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize();
    });
  }
  function sectionOf(el) {
    var hs = root.querySelectorAll("h2, h3"), best = null;
    for (var i = 0; i < hs.length; i++) if (hs[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = hs[i];
    if (!best) return "";
    var c = best.cloneNode(true); c.querySelectorAll(".tag, .src, .num, .n").forEach(function (x) { x.remove(); });
    return c.textContent.replace(/\s+/g, " ").trim();
  }
  function renderAll() {
    var nodes = textNodes(), orphans = 0;
    DB.items.sort(function (a, b) { return (a.o || 0) - (b.o || 0); });
    DB.items.forEach(function (it) {
      if (marksOf(it.id).length) return;
      var i = locate(it, nodes.text);
      it.lost = i < 0;
      if (i < 0) { orphans++; return; }
      it.o = i;
      wrap(it, i, i + it.x.length, nodes);
      nodes = textNodes();
    });
    return orphans;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function create(range, color) {
    var sp = rangeToSpan(range);
    if (!sp) return null;
    var it = { id: uid(), c: color || "y", x: sp.x, p: sp.p, q: sp.q, o: sp.s, n: "", d: Date.now() };
    var marks = wrap(it, sp.s, sp.e, textNodes());
    if (!marks.length) return null;
    it.h = sectionOf(marks[0]);
    DB.items.push(it); DB.items.sort(function (a, b) { return (a.o || 0) - (b.o || 0); });
    save(); refreshDock();
    return it;
  }
  function find(id) { for (var i = 0; i < DB.items.length; i++) if (DB.items[i].id === id) return DB.items[i]; return null; }
  function remove(id) {
    unwrap(id); DB.items = DB.items.filter(function (x) { return x.id !== id; }); save(); refreshDock();
  }

  /* =========================================================
     4. Pasek nad zaznaczeniem
     ========================================================= */
  var ICON = {
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    hl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l-5 5v4h4l5-5"/><path d="M9 11l6-6 4 4-6 6z"/><path d="M14 20h6"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    aa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19l5-14 5 14M5 14h6"/><path d="M15 12.5a3 3 0 0 1 6 0V19M21 15.5c-3.5-.6-6 .2-6 2a1.8 1.8 0 0 0 3.2 1.1"/></svg>'
  };
  var tb = document.createElement("div");
  tb.className = "hl-ui hl-tb"; tb.hidden = true; tb.setAttribute("role", "toolbar"); tb.setAttribute("aria-label", "Zakreślanie");
  document.body.appendChild(tb);
  var cur = null;        // { range } dla nowego lub { id } dla istniejącego
  function tbHTML(edit) {
    var it = edit && find(edit);
    return COLORS.map(function (c) {
      return '<button type="button" class="hl-dot" data-c="' + c[0] + '" data-act="color" aria-label="' + c[1] + '"' + (it && it.c === c[0] ? ' aria-pressed="true"' : "") + "></button>";
    }).join("") + '<span class="hl-sep"></span>' +
      '<button type="button" data-act="note" aria-label="Notatka">' + ICON.note + "<span>" + (it && it.n ? "Notatka" : "Notatka") + "</span></button>" +
      (it ? '<button type="button" data-act="del" aria-label="Usuń zakreślenie">' + ICON.del + "</button>"
          : '<button type="button" data-act="copy" aria-label="Kopiuj tekst">' + ICON.copy + "</button>" +
            '<button type="button" data-act="img" aria-label="Kopiuj jako obraz">' + ICON.img + "</button>");
  }
  function place(rect) {
    tb.hidden = false; html.classList.add("hl-open");
    if (coarse) { tb.style.left = tb.style.top = ""; return; }   // dotyk: pasek przyklejony na dole (CSS), z dala od menu Apple
    var w = tb.offsetWidth, h = tb.offsetHeight, vw = document.documentElement.clientWidth;
    var x = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), vw - w - 8);
    var below = coarse || rect.top < h + 70;                  // na telefonie pod zaznaczeniem (nad nim jest menu systemu)
    var y = below ? rect.bottom + 12 : rect.top - h - 10;
    if (y + h > innerHeight - 8) y = Math.max(8, rect.top - h - 10);
    tb.style.left = x + "px"; tb.style.top = y + "px";
  }
  function showFor(range) {
    cur = { range: range.cloneRange() };
    tb.innerHTML = tbHTML(null); tb.classList.remove("is-edit");
    var r = range.getBoundingClientRect(); if (!coarse && !r.width && !r.height) return hide();
    place(r);
  }
  function showEdit(id, anchor) {
    cur = { id: id };
    tb.innerHTML = tbHTML(id); tb.classList.add("is-edit");
    var ms = marksOf(id); if (!ms.length) return hide();
    var a = ms[0].getBoundingClientRect(), b = ms[ms.length - 1].getBoundingClientRect();
    place(anchor || { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), width: Math.abs(Math.max(a.right, b.right) - Math.min(a.left, b.left)), top: a.top, bottom: b.bottom });
  }
  function hide() { tb.hidden = true; cur = null; html.classList.remove("hl-open"); }
  tb.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // nie gubić zaznaczenia
  tb.addEventListener("mousedown", function (e) { e.preventDefault(); });
  tb.addEventListener("click", function (e) {
    e.stopPropagation();                                     // przycisk zaraz zniknie z DOM; nie zamykać paska
    var b = e.target.closest("button"); if (!b || !cur) return;
    var act = b.getAttribute("data-act"), it;
    if (cur.range) {
      if (act === "copy") { copy(cur.range.toString().trim(), null, rangeHTML(cur.range)); clearSel(); hide(); return; }
      if (act === "img") { var rg = cur.range; copyImage(function () { return renderRange(rg); }, "Skopiowano jako obraz"); clearSel(); hide(); return; }
      it = create(cur.range, act === "color" ? b.getAttribute("data-c") : "y");
      clearSel();
      if (!it) { hide(); toast("Tego fragmentu nie da się zakreślić"); return; }
      if (act === "note") { hide(); editNote(it.id); return; }
      showEdit(it.id);
      return;
    }
    it = find(cur.id); if (!it) return hide();
    if (act === "color") { it.c = b.getAttribute("data-c"); decorate(it); save(); showEdit(it.id); }
    else if (act === "note") { hide(); editNote(it.id); }
    else if (act === "del") { remove(it.id); hide(); toast("Usunięto zakreślenie"); }
  });
  function clearSel() { var s = getSelection(); if (s) s.removeAllRanges(); }
  function selRange() {
    var s = getSelection();
    if (!s || !s.rangeCount || s.isCollapsed) return null;
    var r = s.getRangeAt(0), c = r.commonAncestorContainer;
    if (!root.contains(c.nodeType === 1 ? c : c.parentNode)) return null;
    var el = c.nodeType === 1 ? c : c.parentElement;
    if (el.closest("input, textarea, [contenteditable], .hl-ui, .st-sheet")) return null;
    if (r.toString().trim().length < 2) return null;
    return r;
  }
  var selT = 0;
  function onSel() {
    if (!HLON) return;
    clearTimeout(selT);
    selT = setTimeout(function () {
      var r = selRange();
      if (r) showFor(r);
      else if (cur && cur.range) hide();
    }, coarse ? 220 : 120);
  }
  document.addEventListener("selectionchange", onSel);
  document.addEventListener("mouseup", onSel);
  document.addEventListener("keyup", function (e) { if (e.shiftKey || e.key === "Shift") onSel(); });
  document.addEventListener("click", function (e) {
    if (e.target.closest(".hl-ui")) return;
    var m = e.target.closest("mark.hl");
    var s = getSelection();
    if (m && root.contains(m) && (!s || s.isCollapsed)) { showEdit(m.getAttribute("data-hl")); return; }
    if (cur && cur.id) hide();
  });
  addEventListener("scroll", function () {
    if (tb.hidden || !cur || coarse) return;
    if (cur.range) { var r = cur.range.getBoundingClientRect(); place(r); }
    else showEdit(cur.id);
  }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !tb.hidden) { hide(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    var k = (e.key || "").toLowerCase();
    if (!HLON || (k !== "h" && k !== "n")) return;
    var r = selRange(); if (!r) return;
    e.preventDefault();
    var it = create(r, "y"); clearSel(); hide();
    if (it && k === "n") editNote(it.id); else if (it) toast("Zakreślono");
  });

  /* =========================================================
     5. Arkusze: notatka, lista zakreśleń, wygląd
     ========================================================= */
  function sheetEl(id, title, body, wide) {
    var s = document.createElement("div");
    s.className = "st-sheet hl-ui rd-sheet" + (wide ? " is-wide" : ""); s.hidden = true;
    s.innerHTML = '<div class="st-scrim" data-close></div>' +
      '<section class="st-panel" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
      '<div class="st-grab" aria-hidden="true"></div>' +
      '<header><h2 id="' + id + '">' + title + '</h2><button type="button" data-close>Zamknij</button></header>' +
      '<div class="rd-body">' + body + "</div></section>";
    document.body.appendChild(s);
    s.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeSheet(s); });
    if (window.StudiaSheet) window.StudiaSheet(s, function () { closeSheet(s); });
    return s;
  }
  var lastFocus = null, openS = null;
  function openSheet(s, focusSel) {
    lastFocus = document.activeElement; openS = s;
    s.hidden = false; document.body.classList.add("st-locked");
    var f = (focusSel && s.querySelector(focusSel)) || s.querySelector("header button");
    if (f) f.focus({ preventScroll: true });
  }
  function closeSheet(s) {
    s.hidden = true; openS = null; document.body.classList.remove("st-locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openS) closeSheet(openS); });

  /* --- notatka --- */
  var noteS = sheetEl("rd-note-t", "Notatka",
    '<blockquote class="rd-quote"></blockquote>' +
    '<textarea class="rd-ta" rows="5" placeholder="Twoja myśl, pytanie, skojarzenie, przykład…" aria-label="Treść notatki"></textarea>' +
    '<div class="rd-actions"><button type="button" class="rd-btn ghost" data-act="del-note">Usuń notatkę</button><button type="button" class="rd-btn" data-act="save-note">Zapisz</button></div>');
  var noteId = null;
  function editNote(id) {
    var it = find(id); if (!it) return;
    noteId = id;
    noteS.querySelector(".rd-quote").textContent = it.x;
    noteS.querySelector(".rd-quote").setAttribute("data-c", it.c);
    var ta = noteS.querySelector(".rd-ta"); ta.value = it.n || "";
    noteS.querySelector('[data-act="del-note"]').hidden = !it.n;
    openSheet(noteS, ".rd-ta");
  }
  noteS.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var it = find(noteId); if (!it) return closeSheet(noteS);
    it.n = b.getAttribute("data-act") === "del-note" ? "" : noteS.querySelector(".rd-ta").value.trim();
    decorate(it); save(); closeSheet(noteS);
    if (listS && !listS.hidden) fillList();
  });
  noteS.querySelector(".rd-ta").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) noteS.querySelector('[data-act="save-note"]').click();
  });

  /* --- lista zakreśleń --- */
  var listS = sheetEl("rd-list-t", "Zakreślenia",
    '<div class="rd-filter" role="group" aria-label="Filtr koloru"></div>' +
    '<ol class="rd-list"></ol>' +
    '<p class="rd-empty" hidden>Zaznacz fragment tekstu, a pojawi się pasek z kolorami. Na komputerze: zaznacz i naciśnij <kbd>H</kbd> (zakreśl) albo <kbd>N</kbd> (zakreśl z notatką).</p>' +
    '<div class="rd-actions rd-export"><button type="button" class="rd-btn ghost" data-act="md-copy">Kopiuj jako Markdown</button><button type="button" class="rd-btn ghost" data-act="md-file">Pobierz .md</button>' +
    '<a class="rd-btn ghost" href="' + HOME + 'zakreslenia.html">Wszystkie zakreślenia →</a></div>', true);
  var filt = "";
  function fillList() {
    var f = listS.querySelector(".rd-filter"), ol = listS.querySelector(".rd-list");
    var counts = {}; DB.items.forEach(function (it) { counts[it.c] = (counts[it.c] || 0) + 1; });
    f.innerHTML = '<button type="button" data-f="" aria-pressed="' + (!filt) + '">Wszystkie <b>' + DB.items.length + "</b></button>" +
      COLORS.filter(function (c) { return counts[c[0]]; }).map(function (c) {
        return '<button type="button" data-f="' + c[0] + '" aria-pressed="' + (filt === c[0]) + '"><i class="hl-sw" data-c="' + c[0] + '"></i>' + counts[c[0]] + "</button>";
      }).join("") +
      (DB.items.some(function (x) { return x.n; }) ? '<button type="button" data-f="n" aria-pressed="' + (filt === "n") + '">' + ICON.note + "z notatką</button>" : "");
    var items = DB.items.filter(function (it) { return !filt || (filt === "n" ? !!it.n : it.c === filt); });
    var lastH = null;
    ol.innerHTML = items.map(function (it) {
      var head = it.h && it.h !== lastH ? '<li class="rd-h">' + esc(it.h) + "</li>" : ""; lastH = it.h;
      return head + '<li class="rd-item" data-c="' + it.c + '"><button type="button" class="rd-go" data-id="' + it.id + '">' +
        '<span class="rd-x">' + esc(it.x) + "</span>" +
        (it.n ? '<span class="rd-n">' + ICON.note + esc(it.n) + "</span>" : "") +
        (it.lost ? '<span class="rd-lost">Nie znaleziono w obecnej wersji tekstu</span>' : "") +
        '</button><button type="button" class="rd-mini" data-note="' + it.id + '" aria-label="' + (it.n ? "Edytuj notatkę" : "Dodaj notatkę") + '">' + ICON.note + "</button></li>";
    }).join("");
    listS.querySelector(".rd-empty").hidden = DB.items.length > 0;
    listS.querySelector(".rd-export").hidden = !DB.items.length;
  }
  listS.addEventListener("click", function (e) {
    var b = e.target.closest("button, a"); if (!b) return;
    if (b.hasAttribute("data-f")) { filt = b.getAttribute("data-f"); fillList(); return; }
    if (b.hasAttribute("data-note")) { closeSheet(listS); editNote(b.getAttribute("data-note")); return; }
    if (b.classList.contains("rd-go")) { closeSheet(listS); jump(b.getAttribute("data-id")); return; }
    var act = b.getAttribute("data-act");
    if (act === "md-copy") copy(markdown(), "Skopiowano zakreślenia (Markdown)");
    if (act === "md-file") download(markdown(), slug(TITLE) + "-zakreslenia.md");
  });
  function jump(id) {
    var ms = marksOf(id); if (!ms.length) return;
    var m = ms[0];
    if (window.StudiaSession && m.closest(".ss-screen")) window.StudiaSession.go(m);
    for (var d = m.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
    setTimeout(function () {
      m.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      Array.prototype.forEach.call(ms, function (x) { x.classList.remove("is-flash"); void x.offsetWidth; x.classList.add("is-flash"); });
    }, 60);
  }
  function markdown() {
    var out = ["# " + TITLE, "", "Źródło: " + location.href.split("#")[0], ""], lastH = null;
    DB.items.forEach(function (it) {
      if (it.h && it.h !== lastH) { out.push("## " + it.h, ""); lastH = it.h; }
      out.push("> " + it.x.replace(/\s*\n\s*/g, " "));
      if (it.n) out.push("", "**Notatka:** " + it.n);
      out.push("");
    });
    return out.join("\n");
  }
  function slug(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "notatki"; }

  /* --- wygląd --- */
  var lookS = sheetEl("rd-look-t", "Wygląd tekstu",
    '<div class="rd-set"><span class="rd-lbl">Krój</span><div class="rd-seg" data-k="font">' +
      Object.keys(FONTS).map(function (k) { return '<button type="button" data-v="' + k + '" style="font-family:' + esc(FONTS[k].css) + '">' + FONTS[k].label + "</button>"; }).join("") + "</div></div>" +
    '<div class="rd-set"><span class="rd-lbl">Rozmiar</span><div class="rd-step"><button type="button" data-size="-1" aria-label="Mniejszy tekst">A</button><output class="rd-size"></output><button type="button" data-size="1" aria-label="Większy tekst">A</button></div></div>' +
    '<div class="rd-set"><span class="rd-lbl">Odstęp między wierszami</span><div class="rd-seg" data-k="lh"><button type="button" data-v="tight">Zwarty</button><button type="button" data-v="std">Zwykły</button><button type="button" data-v="loose">Luźny</button></div></div>' +
    '<div class="rd-set"><span class="rd-lbl">Szerokość kolumny</span><div class="rd-seg" data-k="w"><button type="button" data-v="narrow">Wąska</button><button type="button" data-v="std">Zwykła</button><button type="button" data-v="wide">Szeroka</button></div></div>' +
    '<p class="rd-sample">Spostrzeganie to proces tworzenia reprezentacji przedmiotu na podstawie informacji ze zmysłów i, w pewnych przypadkach, z pamięci.</p>' +
    '<div class="rd-set"><span class="rd-lbl">Tryby nauki</span><div class="rd-modes">' +
      '<button type="button" data-mode="scan"><b>Skanowanie</b><span>wyraźne tylko nagłówki, pogrubienia i zakreślenia</span></button>' +
      '<button type="button" data-mode="blur"><b>Ukryj klucze</b><span>rozmyte pogrubienia – dotknij, by odsłonić</span></button>' +
      '<button type="button" data-mode="grid"><b>Listy w dwóch kolumnach</b><span>krótkie listy obok siebie (szerszy ekran)</span></button>' +
    '</div></div>' +
    '<div class="rd-actions"><button type="button" class="rd-btn ghost" data-act="reset">Przywróć domyślne</button></div>');
  function fillLook() {
    lookS.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", String(!!MODES[b.getAttribute("data-mode")]())); });
    lookS.querySelectorAll(".rd-seg").forEach(function (g) {
      var k = g.getAttribute("data-k");
      g.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(R[k] === b.getAttribute("data-v"))); });
    });
    lookS.querySelector(".rd-size").textContent = Math.round((1 + 0.06 * R.size) * 100) + "%";
    lookS.querySelector('[data-size="-1"]').disabled = R.size <= SIZES[0];
    lookS.querySelector('[data-size="1"]').disabled = R.size >= SIZES[SIZES.length - 1];
  }
  lookS.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-mode")) { TOGGLE[b.getAttribute("data-mode")](); fillLook(); return; }
    var g = b.closest(".rd-seg");
    if (g) R[g.getAttribute("data-k")] = b.getAttribute("data-v");
    else if (b.hasAttribute("data-size")) R.size = Math.min(SIZES[SIZES.length - 1], Math.max(SIZES[0], R.size + +b.getAttribute("data-size")));
    else if (b.getAttribute("data-act") === "reset") R = Object.assign({}, DEF);
    else return;
    store(RK, R); applyLook(); fillLook(); progress();
  });

  /* =========================================================
     6. Przyciski w pasku narzędzi
     ========================================================= */
  /* --- tryb „Ukryj klucze” --- */
  var BK = "studia-klucze", BLUR = !!load(BK, false);
  var KEYSEL = "strong, b, mark.hl, .st-prime dt";
  var NOBLUR = "h1, h2, h3, h4, summary, figcaption, th, button, a, .hl-ui, .st-check, .must-tag, .st-prime-h, .tldr .lbl";
  function setBlur(v) {
    BLUR = v; store(BK, v);
    html.classList.toggle("rd-blur", v);
    if (!v) Array.prototype.forEach.call(root.querySelectorAll(".is-shown"), function (e) { e.classList.remove("is-shown"); });
  }
  function hiddenKey(t) {
    if (!BLUR || !t.closest) return null;
    var k = t.closest(KEYSEL);
    if (!k || !root.contains(k) || k.closest(NOBLUR)) return null;
    for (var p = k; p && p !== root; p = p.parentElement) if (p.matches && p.matches(KEYSEL) && !p.classList.contains("is-shown")) k = p;   // najszerszy rozmyty
    return k.classList.contains("is-shown") ? null : k;
  }
  document.addEventListener("click", function (e) {           // faza przechwytywania: odsłonięcie ma pierwszeństwo przed paskiem zakreśleń i słownikiem
    var k = hiddenKey(e.target); if (!k) return;
    var s = getSelection(); if (s && !s.isCollapsed) return;
    e.preventDefault(); e.stopPropagation();
    k.classList.add("is-shown");
    Array.prototype.forEach.call(k.querySelectorAll(KEYSEL), function (x) { x.classList.add("is-shown"); });
  }, true);
  if (BLUR) html.classList.add("rd-blur");

  /* --- tryby nauki: skanowanie, listy w dwóch kolumnach, przygaszanie znanych sekcji --- */
  var SK = "studia-skan", SCAN = !!load(SK, false);
  var GK = "studia-2kol", GRID = load(GK, true) !== false;
  function setScan(v) { SCAN = v; store(SK, v); html.classList.toggle("rd-scan", v); if (!v) Array.prototype.forEach.call(root.querySelectorAll(".rd-lit"), function (e) { e.classList.remove("rd-lit"); }); }
  function setGrid(v) { GRID = v; store(GK, v); html.classList.toggle("rd-2col", v); }
  var MODES = { scan: function () { return SCAN; }, blur: function () { return BLUR; }, grid: function () { return GRID; } };
  var TOGGLE = {
    scan: function () { setScan(!SCAN); toast(SCAN ? "Skanowanie: dotknij akapitu, by go rozjaśnić" : "Skanowanie wyłączone"); syncDock(); },
    blur: function () { setBlur(!BLUR); syncDock(); },
    grid: function () { setGrid(!GRID); }
  };
  function syncDock() {
    Array.prototype.forEach.call(document.querySelectorAll(".rd-dock-blur"), function (k) { k.setAttribute("aria-pressed", String(BLUR)); });
    Array.prototype.forEach.call(document.querySelectorAll(".rd-dock-scan"), function (k) { k.setAttribute("aria-pressed", String(SCAN)); });
  }
  if (SCAN) html.classList.add("rd-scan");
  if (GRID) html.classList.add("rd-2col");
  // skanowanie: dotknięcie akapitu rozjaśnia go (na myszy wystarcza najechanie)
  var LIT = "p, li, dd, td, blockquote, .def, figure";
  root.addEventListener("click", function (e) {
    if (!SCAN) return;
    var s = getSelection(); if (s && !s.isCollapsed) return;
    var b = e.target.closest && e.target.closest(LIT); if (!b || !root.contains(b)) return;
    b.classList.add("rd-lit");
  });
  // listy: krótkie punkty (bez zagnieżdżeń) dostają układ w dwóch kolumnach
  Array.prototype.forEach.call(root.querySelectorAll("ul"), function (ul) {
    if (ul.closest(".sch, .st-prime, nav, .hl-ui, .st-sheet, table, .cards, .must")) return;
    var li = ul.children; if (li.length < 3) return;
    var total = 0, mx = 0;
    for (var i = 0; i < li.length; i++) {
      if (li[i].tagName !== "LI" || li[i].querySelector("ul, ol, table, figure")) return;
      var n = li[i].textContent.length; total += n; if (n > mx) mx = n;
    }
    if (total / li.length <= 320 && mx <= 600) ul.classList.add("rd-grid2");   // kafelki obok siebie; bardzo długie punkty zostają w jednej kolumnie
  });
  // kotwice: akapity z przykładem
  Array.prototype.forEach.call(root.querySelectorAll("p, li"), function (el) {
    if (/^\s*(Przykład|Przykłady|Np\.|Na przykład)\b/.test(el.textContent)) el.classList.add("rd-ex");
  });
  // znane sekcje: cichy przełącznik przy nagłówku, bez liczników
  var ZK = "studia-znane:" + location.pathname, ZNANE = load(ZK, []);
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  function sectionOf2(h) {
    var box = h.closest("section.chapter, section.block");
    if (box && box.querySelector("h2") === h) return [box];
    var els = [], n = h.nextElementSibling;
    while (n && n.tagName !== "H2" && !n.classList.contains("sch-part") && n.tagName !== "FOOTER") { els.push(n); n = n.nextElementSibling; }
    return els;
  }
  Array.prototype.forEach.call(root.querySelectorAll("h2"), function (h) {
    if (h.closest(".st-sheet, .hl-ui")) return;
    var id = h.id || (h.closest("section") && h.closest("section").id) || h.textContent.trim().slice(0, 40);
    var b = document.createElement("button"); b.type = "button"; b.className = "rd-known-btn hl-ui"; b.innerHTML = EYE;
    function apply(on) {
      b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Oznaczone jako znane – pokaż normalnie" : "Znam tę sekcję – przygaś");
      h.classList.toggle("rd-known", on);
      sectionOf2(h).forEach(function (e) { e.classList.toggle("rd-known", on); });
    }
    b.onclick = function (e) {
      e.stopPropagation();
      var on = ZNANE.indexOf(id) < 0;
      if (on) ZNANE.push(id); else ZNANE = ZNANE.filter(function (x) { return x !== id; });
      store(ZK, ZNANE); apply(on);
    };
    h.appendChild(b); apply(ZNANE.indexOf(id) >= 0);
  });

  var dockHL = null;
  function dockButtons(withHL) {
    var bar = document.querySelector(".dock-bar");
    if (!bar) {                                              // strona bez paska: pływające przyciski
      bar = document.createElement("nav"); bar.className = "dock-bar rd-float hl-ui"; bar.setAttribute("aria-label", "Czytanie");
      var d = document.createElement("div"); d.className = "dock rd-dock"; d.appendChild(bar); document.body.appendChild(d);
    }
    if (withHL) {
      dockHL = document.createElement("button"); dockHL.type = "button"; dockHL.className = "rd-dock-hl";
      dockHL.innerHTML = ICON.hl + "<span>Zakreślenia</span>";
      dockHL.onclick = function () { fillList(); openSheet(listS); };
      bar.appendChild(dockHL);
    }
    if (withHL) {                                            // „Ukryj klucze”: rozmyte pogrubienia i zakreślenia (aktywne przypominanie)
      var k = document.createElement("button"); k.type = "button"; k.className = "rd-dock-blur";
      k.innerHTML = ICON.eye + "<span>Ukryj klucze</span>";
      k.setAttribute("aria-pressed", String(BLUR));
      k.onclick = function () { setBlur(!BLUR); syncDock(); toast(BLUR ? "Klucze ukryte – dotknij, by odsłonić" : "Klucze widoczne"); };
      bar.appendChild(k);
    }
    var sc = document.createElement("button"); sc.type = "button"; sc.className = "rd-dock-scan";
    sc.innerHTML = ICON.scan + "<span>Skanowanie</span>"; sc.setAttribute("aria-pressed", String(SCAN));
    sc.onclick = function () { TOGGLE.scan(); };
    bar.appendChild(sc);
    var a = document.createElement("button"); a.type = "button"; a.innerHTML = ICON.aa + "<span>Wygląd</span>";
    a.onclick = function () { fillLook(); openSheet(lookS); };
    bar.appendChild(a);
  }
  function refreshDock() {
    if (!dockHL) return;
    var n = DB.items.length, b = dockHL.querySelector("b");
    if (!b) { b = document.createElement("b"); b.className = "rd-count"; dockHL.appendChild(b); }
    b.textContent = n || ""; b.hidden = !n;
  }

  /* --- drobne --- */
  var toastEl = null, toastT = 0;
  function toast(t) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "hl-ui rd-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = t; toastEl.classList.add("on"); clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 1800);
  }
  function copy(t, msg, h) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = t; ta.className = "hl-ui"; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove();
    }
    if (h && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([h], { type: "text/html" }), "text/plain": new Blob([t], { type: "text/plain" })
      })]).catch(function () { if (navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(fallback); else fallback(); });
    } else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(fallback); else fallback();
    toast(msg || "Skopiowano");
  }
  function rangeHTML(r) {
    var d = document.createElement("div"); d.appendChild(r.cloneContents());
    d.querySelectorAll(".hl-ui, script, style").forEach(function (x) { x.remove(); });
    return d.innerHTML;
  }

  /* =========================================================
     5. Kopiowanie jako obraz (do GoodNotes itp.)
        Zaznaczony fragment lub schemat → PNG (schowek; w razie czego arkusz udostępniania / pobranie).
        Fragment jest renderowany z zachowaniem formatowania i zakreśleń, na jasnym tle.
     ========================================================= */
  var KEEP = null;
  function inlineStyles(src, dst) {
    var cs = getComputedStyle(src), out = "";
    for (var i = 0; i < cs.length; i++) {
      var n = cs[i];
      if (n === "visibility" || n === "left" || n === "top" || n === "right" || n === "bottom" || n === "inset" || /^(transition|animation|cursor|pointer-events|will-change|-webkit-tap|user-select|-webkit-user|caret|scroll|overscroll|touch-action|view-transition|container|anchor|position-)/.test(n)) continue;
      var v = cs.getPropertyValue(n);
      if ((n === "overflow-x" || n === "overflow-y" || n === "overflow") && /auto|scroll/.test(v)) v = "visible";
      out += n + ":" + v + ";";
    }
    dst.setAttribute("style", out);
    for (var a = dst.attributes.length - 1; a >= 0; a--) {
      var an = dst.attributes[a].name;
      if (an === "class" || an === "id" || an.indexOf("data-") === 0 || an === "aria-label" || an === "hidden") dst.removeAttribute(an);
    }
  }
  function cloneWithStyles(srcRoot, dstRoot) {
    inlineStyles(srcRoot, dstRoot);
    var sk = srcRoot.children, dk = dstRoot.children;
    for (var i = 0; i < sk.length && i < dk.length; i++) cloneWithStyles(sk[i], dk[i]);
  }
  function bodyBg() {
    var c = getComputedStyle(document.body).backgroundColor;
    return /rgba\(.*,\s*0\)|transparent/.test(c) ? "#ffffff" : c;
  }
  function renderNode(host, width) {
    // host: element już w DOM (poza ekranem), z prawdziwym kaskadowaniem stylów
    host.querySelectorAll(".hl-ui, script, style, summary .ic, .st-check, .st-prime, button, details > summary").forEach(function (x) {
      if (x.matches("details > summary")) return;
      x.remove();
    });
    host.querySelectorAll("details").forEach(function (d) { d.setAttribute("open", ""); });
    // faktyczna szerokość treści: elementy z przewijaniem (tabele) mogą wystawać poza kolumnę
    var hr = host.getBoundingClientRect(), need = width;
    host.querySelectorAll("*").forEach(function (x) {
      var r = x.getBoundingClientRect(); if (!r.width || !r.height) return;
      var pos = getComputedStyle(x).position; if (pos === "absolute" || pos === "fixed") return;
      var over = x.scrollWidth > x.clientWidth + 1 ? x.scrollWidth - x.clientWidth : 0;
      need = Math.max(need, Math.ceil(r.right - hr.left + over) + 14);
    });
    var copyEl = host.cloneNode(true);
    cloneWithStyles(host, copyEl);
    var W = Math.min(need, 2400);
    copyEl.style.cssText += ";position:static;left:0;top:0;margin:0;width:" + W + "px;box-sizing:border-box;padding:14px;background:" + bodyBg() + ";";
    var h = Math.ceil(host.getBoundingClientRect().height);
    var scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
    if (h * scale > 16000) scale = 16000 / h;
    var ser = new XMLSerializer().serializeToString(copyEl);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + h + '"><foreignObject x="0" y="0" width="100%" height="100%">' +
      (/^<\w+[^>]*xmlns=/.test(ser) ? ser : ser.replace(/^<(\w+)/, '<$1 xmlns="http://www.w3.org/1999/xhtml"')) + "</foreignObject></svg>";
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement("canvas"); cv.width = Math.round(W * scale); cv.height = Math.round(h * scale);
        var cx = cv.getContext("2d"); cx.fillStyle = bodyBg(); cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) { b ? res(b) : rej(new Error("toBlob")); }, "image/png");
      };
      img.onerror = function () { rej(new Error("img")); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }
  function offscreen(build, width) {
    var wrap = document.createElement("div");
    wrap.className = "hl-ui hl-off"; wrap.style.cssText = "position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none;box-sizing:border-box;padding:14px;width:" + Math.ceil(width) + "px";
    root.appendChild(wrap);
    var host = build(wrap);
    return { host: host, done: function () { wrap.remove(); } };
  }
  function renderRange(range) {
    var w = Math.min(Math.max(range.getBoundingClientRect().width, 280), root.getBoundingClientRect().width || 700) + 28;
    var anc = range.commonAncestorContainer; if (anc.nodeType !== 1) anc = anc.parentNode;
    var o = offscreen(function (wrap) {
      // odtwarzamy łańcuch przodków (klasy), żeby działały selektory typu ".sec .body p"
      var chain = []; for (var a = anc; a && a !== root && a !== document.body; a = a.parentNode) chain.unshift(a);
      var parent = wrap;
      chain.forEach(function (a) { var c = a.cloneNode(false); c.removeAttribute("id"); c.removeAttribute("hidden"); c.style.cssText = "";
        if (c.tagName === "DETAILS") { c.setAttribute("open", ""); var sm = document.createElement("summary"); sm.style.cssText = "display:none"; c.appendChild(sm); }
        parent.appendChild(c); parent = c; });
      var box = document.createElement("div"); box.appendChild(range.cloneContents());
      parent.appendChild(box);
      return wrap;
    }, w);
    // ramka: przodkowie bez marginesów/ramek, żeby obraz był tylko treścią
    var p = renderNode(o.host, Math.ceil(w));
    return p.then(function (b) { o.done(); return b; }, function (e) { o.done(); throw e; });
  }
  function renderElement(el) {
    var w = Math.ceil(el.getBoundingClientRect().width) + 28;
    var o = offscreen(function (wrap) { var c = el.cloneNode(true); wrap.appendChild(c); return wrap; }, w);
    var p = renderNode(o.host, w);
    return p.then(function (b) { o.done(); return b; }, function (e) { o.done(); throw e; });
  }
  // Safari wymaga wywołania clipboard.write synchronicznie w geście — dlatego przekazujemy obietnicę blobu
  function copyImage(make, msg) {
    var p = make();
    var ok = false;
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      try {
        navigator.clipboard.write([new ClipboardItem({ "image/png": p })]).then(function () { toast(msg || "Skopiowano obraz"); },
          function () { fallbackImage(p); });
        ok = true;
      } catch (e) { ok = false; }
    }
    if (!ok) fallbackImage(p);
  }
  function fallbackImage(p) {
    p.then(function (b) {
      var f = new File([b], "notatka.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        return navigator.share({ files: [f] }).catch(function () {});
      }
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "notatka.png";
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      toast("Pobrano obraz (schowek niedostępny)");
    }, function () { toast("Nie udało się zrobić obrazu"); });
  }
  // przycisk na schematach
  function figButtons() {
    root.querySelectorAll("figure.fig, .diagram").forEach(function (f) {
      if (f.querySelector(":scope > .fig-copy") || !f.querySelector("svg")) return;
      var b = document.createElement("button");
      b.type = "button"; b.className = "hl-ui fig-copy"; b.setAttribute("aria-label", "Kopiuj schemat jako obraz"); b.title = "Kopiuj jako obraz";
      b.innerHTML = ICON.img;
      b.addEventListener("click", function (e) { e.stopPropagation(); copyImage(function () { return renderElement(f); }, "Skopiowano schemat jako obraz"); });
      if (getComputedStyle(f).position === "static") f.style.position = "relative";
      f.appendChild(b);
    });
  }
  figButtons();
  window.StudiaCopyImage = { range: renderRange, element: renderElement };
  function download(t, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], { type: "text/markdown;charset=utf-8" })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* --- start --- */
  dockButtons(HLON);
  if (HLON) { renderAll(); refreshDock(); }
  var m = /[#&]hl=([\w]+)/.exec(location.hash);              // link ze strony „Wszystkie zakreślenia”
  if (m) setTimeout(function () { jump(m[1]); }, 300);
  window.StudiaHL = { items: function () { return DB.items.slice(); }, markdown: markdown };
})();
