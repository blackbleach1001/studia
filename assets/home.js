/* =========================================================
   Studia — strona główna: „Czytaj dalej” i wyszukiwanie w notatkach.
   Indeks (assets/search-index.js) wczytuje się dopiero przy pierwszym użyciu pola.
   ========================================================= */
(function () {
  "use strict";
  var me = document.currentScript;
  var SUBJ = window.STUDIA_SUBJECTS || {};
  var main = document.querySelector("main");
  var input = document.getElementById("q");
  var box = document.getElementById("results");
  var list = document.getElementById("results-list");
  var head = document.getElementById("results-h");
  if (!main) return;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function vars(dir) {
    var h = (SUBJ[dir] && SUBJ[dir].hsl) || [28, 22, 45];
    return "--sh:" + h[0] + ";--ss:" + h[1] + "%;--sl:" + h[2] + "%";
  }
  var DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>';
  var RESUME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M14 3v8l-2.5-1.8L9 11V3"/></svg>';

  /* ---------- Czytaj dalej ---------- */
  var last = null;
  try { last = JSON.parse(localStorage.getItem("studia-last") || "null"); } catch (e) {}
  if (last && last.h && SUBJ[last.h.split("/")[0]]) {
    var dir = last.h.split("/")[0];
    var g = document.createElement("section");
    g.className = "group resume";
    g.innerHTML = '<h2>Czytaj dalej</h2><ul class="ios-list"><li style="' + vars(dir) + '">' +
      '<a class="row" href="' + esc(last.h) + '"><span class="ic">' + RESUME + '</span><span class="tx">' +
      '<span class="t">' + esc(last.t || last.u) + "</span>" +
      '<span class="s">' + esc([SUBJ[dir].short, last.u, last.sec].filter(Boolean).join(" · ")) + "</span></span></a></li></ul>";
    g.querySelector("a").addEventListener("click", function () {
      try { sessionStorage.setItem("studia-resume", last.h); } catch (e) {}
    });
    var first = main.querySelector(".group:not(.results)");
    main.insertBefore(g, first);
  }

  /* ---------- wyszukiwanie ---------- */
  if (!input || !box) return;
  var idx = null, loading = false, pending = "";
  function fold(ch) {
    var c = ch.toLowerCase();
    if (c === "ł") return "l";
    var n = c.normalize ? c.normalize("NFD").charAt(0) : c;
    return n.length === 1 ? n : c;
  }
  function norm(s) { var out = ""; for (var i = 0; i < s.length; i++) out += fold(s.charAt(i)); return out; }
  function load(cb) {
    if (idx) return cb();
    pending = "cb"; if (loading) return; loading = true;
    var s = document.createElement("script");
    s.src = (me && me.dataset.index) || "assets/search-index.js";
    s.onload = function () {
      idx = (window.STUDIA_SEARCH || []).map(function (e) { e.nt = norm(e.t); e.nx = norm(e.x); return e; });
      run();
    };
    document.head.appendChild(s);
  }
  function snippet(e, words) {
    var pos = -1, w0 = "";
    words.forEach(function (w) { var p = e.nx.indexOf(w); if (p >= 0 && (pos < 0 || p < pos)) { pos = p; w0 = w; } });
    if (pos < 0) return esc(e.x.slice(0, 140)) + (e.x.length > 140 ? "…" : "");
    var a = Math.max(0, pos - 50), b = Math.min(e.x.length, pos + 110);
    if (a > 0) { var sp = e.x.indexOf(" ", a); if (sp > 0 && sp < pos) a = sp + 1; }
    return (a > 0 ? "…" : "") + hl(e.x.slice(a, b), e.nx.slice(a, b), words) + (b < e.x.length ? "…" : "");
  }
  function hl(orig, n, words) {
    var marks = [];
    words.forEach(function (w) { var p = 0; while ((p = n.indexOf(w, p)) >= 0) { marks.push([p, p + w.length]); p += w.length; } });
    marks.sort(function (x, y) { return x[0] - y[0]; });
    var out = "", at = 0;
    marks.forEach(function (m) { if (m[0] < at) return; out += esc(orig.slice(at, m[0])) + "<mark>" + esc(orig.slice(m[0], m[1])) + "</mark>"; at = m[1]; });
    return out + esc(orig.slice(at));
  }
  function run() {
    var q = input.value.trim();
    var groups = main.querySelectorAll(".group:not(.results)");
    if (q.length < 2) {
      box.hidden = true;
      groups.forEach(function (g) { g.hidden = false; });
      return;
    }
    groups.forEach(function (g) { g.hidden = true; });
    box.hidden = false;
    if (!idx) { head.textContent = "Wyszukiwanie…"; list.innerHTML = ""; return load(run); }
    var words = norm(q).split(/\s+/).filter(function (w) { return w.length > 1; });
    var hits = [];
    idx.forEach(function (e) {
      var score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], inT = e.nt.indexOf(w) >= 0, inX = e.nx.indexOf(w) >= 0;
        if (!inT && !inX) return;
        score += (inT ? 10 : 0) + Math.min(5, e.nx.split(w).length - 1);
      }
      hits.push([score, e]);
    });
    hits.sort(function (a, b) { return b[0] - a[0]; });
    var n = hits.length;
    head.textContent = n ? (n === 1 ? "1 sekcja" : n + (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? " sekcje" : " sekcji")) : "Brak wyników";
    var key = encodeURIComponent(q);
    list.innerHTML = hits.slice(0, 30).map(function (h) {
      var e = h[1], parts = e.h.split("#");
      return '<li style="' + vars(e.d) + '"><a class="row hit" href="' + esc(parts[0]) + "?szukaj=" + key + "#" + esc(parts[1]) + '">' +
        '<span class="ic alt">' + DOC + '</span><span class="tx"><span class="t">' + hl(e.t, e.nt, words) + "</span>" +
        '<span class="s">' + esc((SUBJ[e.d] ? SUBJ[e.d].short : e.d) + " · " + e.u) + "</span>" +
        '<span class="x">' + snippet(e, words) + "</span></span></a></li>";
    }).join("");
  }
  var t = 0;
  input.addEventListener("input", function () { clearTimeout(t); t = setTimeout(run, 120); });
  input.addEventListener("focus", function () { load(function () {}); });
  input.addEventListener("keydown", function (e) { if (e.key === "Escape") { input.value = ""; run(); input.blur(); } });
})();
