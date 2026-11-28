/* =========================================================
   Studia — słownik w locie.
   Pojęcia z „Pojęć na start” całego przedmiotu (assets/glossary-index.js,
   budowane przez tools/build_glossary.py) są oznaczane w treści notatek
   kropkowanym podkreśleniem (pierwsze wystąpienie na stronie).
   Najechanie (mysz) albo dotknięcie otwiera dymek z definicją.
   Tryb „Sprawdź się”: dymek najpierw pyta o znaczenie, definicja po dotknięciu.
   Ładowany przed czytanie.js (zakreślenia obejmują oznaczone pojęcia).
   ========================================================= */
(function () {
  "use strict";
  var G = window.STUDIA_GLOSSARY; if (!G) return;
  var parts = location.pathname.split("/").filter(Boolean);
  var file = parts[parts.length - 1] || "", dir = parts[parts.length - 2] || "";
  var terms = G[dir]; if (!terms || !terms.length) return;
  if (/(fiszki|test|trening|baza|makieta|sesja|zakreslenia)\.html$/.test(file)) return;
  var root = document.querySelector("main") || document.querySelector(".wrap"); if (!root) return;
  var KEY = "studia-gl-test";
  function load() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function save(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* --- wzorce: odmiana przez przypadki (pomijamy ostatnie litery słowa) --- */
  function stem(w) {
    var L = w.length;
    if (L <= 4) return w;
    return w.slice(0, L >= 7 ? L - 2 : L - 1);
  }
  function pattern(t) {
    var base = t.replace(/\s*\([^)]*\)\s*/g, " ").replace(/[„”"]/g, "").trim();
    var words = base.split(/[\s–-]+/).filter(Boolean);
    if (!words.length) return null;
    function rx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    var src = words.map(function (w) {
      w = w.toLowerCase().replace(/[.,:;]$/, "");
      var s = stem(w);
      return rx(s) + (s.length < w.length ? "\\p{L}*" : "\\p{L}{0,2}");   // krótkie słowa: tylko krótka końcówka
    }).join("[\\s\\u00a0–-]+") + "(?![\\p{L}])";
    try { return new RegExp("(?<![\\p{L}\\p{N}])" + src, "iu"); } catch (e) { return null; }
  }
  // najpierw pojęcia z tej strony, potem dłuższe (mniej fałszywych trafień)
  var list = terms.map(function (x, i) { return { t: x[0], d: x[1], f: x[2], l: x[3], i: i, re: pattern(x[0]) }; })
    .filter(function (x) {
      if (!x.re) return false;
      // ogólne, krótkie słowa z innych notatek („zdrowie”, „zasoby”) dawałyby przypadkowe podkreślenia
      var b = x.t.replace(/\s*\([^)]*\)/g, "").trim();
      return x.f === file || /\s/.test(b) || b.length > 7;
    })
    .sort(function (a, b) { return (b.f === file) - (a.f === file) || b.t.length - a.t.length; });

  var SKIP = "h1,h2,h3,h4,a,button,summary,label,input,textarea,select,code,pre,script,style,.st-prime,.gl-term,.hl-ui,.st-check,.sch figcaption,.src,.must-tag,.st-sheet,mark";
  function textNodes() {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.trim().length < 3) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement; if (!p || p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  function mark() {
    var nodes = textNodes(), n = 0;
    list.forEach(function (it) {
      for (var k = 0; k < nodes.length; k++) {
        var node = nodes[k], m = it.re.exec(node.nodeValue);
        if (!m) continue;
        var after = node.splitText(m.index), rest = after.splitText(m[0].length);
        var span = document.createElement("span");
        span.className = "gl-term"; span.tabIndex = 0; span.setAttribute("role", "button");
        span.setAttribute("data-gl", it.i); span.setAttribute("aria-label", m[0] + " – pokaż definicję");
        after.parentNode.replaceChild(span, after); span.appendChild(after);
        nodes.splice(k, 1, node, rest);                   // reszta tekstu nadal do przeszukania przez inne pojęcia
        n++; break;                                       // tylko pierwsze wystąpienie na stronie
      }
    });
    return n;
  }
  if (!mark()) return;

  /* --- dymek --- */
  var pop = document.createElement("div");
  pop.className = "gl-pop hl-ui"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-live", "polite");
  document.body.appendChild(pop);
  var cur = null, test = load(), shown = false, hideT = 0, showT = 0;
  function render() {
    var it = terms[cur.getAttribute("data-gl")], other = it[2] !== file;
    var src = other ? '<a class="gl-src" href="' + esc(it[2]) + '">' + esc(it[3] || "inna notatka") + " →</a>" : "<span></span>";
    var body = test && !shown
      ? '<p class="gl-q">Co oznacza to pojęcie? Powiedz sobie, potem sprawdź.</p><button type="button" class="gl-reveal" data-gl-act="show">Pokaż definicję</button>'
      : '<p class="gl-d">' + esc(it[1]) + "</p>";
    pop.innerHTML = '<p class="gl-t">' + esc(it[0]) + "</p>" + body +
      '<div class="gl-foot">' + src + '<button type="button" class="gl-mode" data-gl-act="mode" aria-pressed="' + test + '">' + (test ? "✓ " : "") + "Sprawdź się</button></div>";
  }
  function place() {
    var r = cur.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    pop.style.left = "0px"; pop.style.top = "0px"; pop.hidden = false;
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
    var y = r.bottom + 8; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 8);
    pop.style.left = x + "px"; pop.style.top = y + "px";
  }
  function open(el) {
    clearTimeout(hideT);
    if (cur && cur !== el) cur.classList.remove("is-open");
    cur = el; shown = false; el.classList.add("is-open"); el.setAttribute("aria-expanded", "true");
    render(); place();
  }
  function close() {
    pop.hidden = true;
    if (cur) { cur.classList.remove("is-open"); cur.setAttribute("aria-expanded", "false"); }
    cur = null;
  }
  function selecting() { var s = getSelection(); return s && !s.isCollapsed; }
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine) {
    root.addEventListener("mouseover", function (e) {
      var t = e.target.closest && e.target.closest(".gl-term"); if (!t || selecting()) return;
      clearTimeout(showT); clearTimeout(hideT); showT = setTimeout(function () { open(t); }, 250);
    });
    root.addEventListener("mouseout", function (e) {
      var t = e.target.closest && e.target.closest(".gl-term"); if (!t) return;
      clearTimeout(showT); hideT = setTimeout(close, 250);
    });
    pop.addEventListener("mouseenter", function () { clearTimeout(hideT); });
    pop.addEventListener("mouseleave", function () { hideT = setTimeout(close, 250); });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".gl-term");
    if (t && root.contains(t)) {
      if (selecting()) return;
      e.preventDefault();
      if (cur === t && !pop.hidden && !fine) close(); else open(t);
      return;
    }
    if (!pop.contains(e.target)) close();
  });
  pop.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    e.stopPropagation();
    var act = b.getAttribute("data-gl-act");
    if (act === "show") { shown = true; render(); place(); }
    if (act === "mode") { test = !test; save(test); shown = false; render(); place(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !pop.hidden) { var c = cur; close(); if (c) c.focus(); return; }
    var t = e.target.closest && e.target.closest(".gl-term");
    if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(t); }
  });
  addEventListener("scroll", function () { if (!pop.hidden && cur) place(); }, { passive: true });
  addEventListener("resize", function () { if (!pop.hidden && cur) place(); });
})();
