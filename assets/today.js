/* =========================================================
   Studia — „Powtórki”: sekcje notatek z zaległymi pytaniami i rozgrzewka.
   Powtórka prowadzi do notatek: link otwiera sekcję i jej zaległe pytania (check.js, #powtorka-…).
   Liczą się tylko pytania już widziane — nowe przychodzą z czytania („Sprawdź tę sekcję”).
   Rozgrzewka: 5 pytań — najpierw zaległe, potem z ostatnio czytanych wykładów.
   Strona główna: grupa pod listą przedmiotów. Strona przedmiotu: sekcje tego przedmiotu
   i licznik przy wierszach z fiszkami.
   Wymaga: srs.js, cards-index.js; do rozgrzewki flashcards.js i check.js.
   data-root = ścieżka do katalogu głównego, data-subject = katalog przedmiotu.
   ========================================================= */
(function () {
  "use strict";
  var SRS = window.SRS, IDX = window.STUDIA_INDEX || [];
  if (!SRS || !IDX.length) return;
  var me = document.currentScript, root = (me && me.dataset.root) || "";
  var here = (me && me.dataset.subject) || "";
  var main = document.querySelector("main");
  if (!main) return;
  var WARM = 5, SHOW = 3;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plq(n) { return n === 1 ? "pytanie" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "pytania" : "pytań"); }
  function vars(h) { return "--sh:" + h[0] + ";--ss:" + h[1] + "%;--sl:" + h[2] + "%"; }
  var DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>';
  var BOLT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L4.5 13.5H12L11 22l8.5-11.5H12z"/></svg>';

  /* sekcje z indeksu: id fiszki → sekcja */
  var SECS = [], secOf = {};
  IDX.forEach(function (d) {
    (d.secs || []).forEach(function (s) {
      var x = { dir: d.dir, short: d.short, hsl: d.hsl, u: s.u, s: s.s, t: s.t, ul: s.ul, ids: s.ids };
      SECS.push(x);
      s.ids.forEach(function (id) { secOf[id] = x; });
    });
  });
  function hrefOf(x, review) {
    return root + x.dir + "/" + x.u + (review ? "#powtorka" + (x.s ? "-" + encodeURIComponent(x.s) : "") : (x.s ? "#" + x.s : ""));
  }
  function where(x) { return x.short + " · " + x.ul; }

  /* ---------- strona przedmiotu: licznik przy wierszu z fiszkami ---------- */
  if (here) {
    IDX.filter(function (d) { return d.dir === here; }).forEach(function (d) {
      var s = SRS.stats(d.ids), file = d.href.split("/").pop();
      var a = document.querySelector('.ios-list a.row[href="' + file + '"]');
      if (!a) return;
      var sub = a.querySelector(".s");
      if (sub) sub.textContent = (s.due ? "Na dziś: " + s.due : "Na dziś gotowe") + " · opanowane " + s.mastered + " z " + s.total;
      if (s.due) {
        var b = document.createElement("span");
        b.className = "badge"; b.textContent = s.due; b.setAttribute("aria-label", s.due + " do powtórki");
        a.appendChild(b);
      }
    });
  }

  /* ---------- ostatnio czytane wykłady (reader.js: studia-recent) ---------- */
  function recentUnits() {
    var out = [];
    try {
      (JSON.parse(localStorage.getItem("studia-recent") || "[]") || []).forEach(function (r) { if (r && r.h) out.push(r.h); });
      var last = JSON.parse(localStorage.getItem("studia-last") || "null");
      if (last && last.h && out.indexOf(last.h) < 0) out.unshift(last.h);
    } catch (e) {}
    return out;
  }

  /* ---------- rozgrzewka: wybór pytań ---------- */
  function pickWarmup() {
    var mine = SECS.filter(function (x) { return !here || x.dir === here; });
    var all = [];
    mine.forEach(function (x) { all = all.concat(x.ids); });
    var due = SRS.reviewList(all), out = [], taken = {};
    function take(id) { if (out.length < WARM && !taken[id]) { taken[id] = 1; out.push(id); } }
    due.slice(0, 3).forEach(take);
    // ostatnio czytane: najpierw pytania już widziane, ale nieopanowane, potem nowe
    var recent = recentUnits();
    recent.forEach(function (h) {
      var ids = [];
      mine.forEach(function (x) { if (x.dir + "/" + x.u === h) ids = ids.concat(x.ids); });
      var weak = [], fresh = [];
      ids.forEach(function (id) {
        var c = SRS.get(id);
        if (!c) fresh.push(id); else if (c.b < SRS.masteredBox && c.d > SRS.today()) weak.push(id);
      });
      shuffle(weak).concat(shuffle(fresh)).forEach(take);
    });
    due.forEach(take);
    // nic świeżego: pytania widziane, jeszcze nieopanowane
    shuffle(all.filter(function (id) { var c = SRS.get(id); return c && c.b < SRS.masteredBox; })).forEach(take);
    return shuffle(out);
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* treść fiszek: <przedmiot>/cards.js (na stronie notatek już wczytane) */
  var loaded = {};
  function loadCards(dirs, cb) {
    var todo = dirs.filter(function (d) { return !loaded[d]; });
    if (!todo.length) return cb();
    var d = todo[0], prev = window.STUDIA_CARDS, s = document.createElement("script");
    s.src = root + d + "/cards.js";
    s.onload = function () { loaded[d] = window.STUDIA_CARDS || []; window.STUDIA_CARDS = prev; loadCards(dirs, cb); };
    s.onerror = function () { loaded[d] = []; loadCards(dirs, cb); };
    document.head.appendChild(s);
  }

  function warmup(btn) {
    if (!window.StudiaQuiz) return;
    var ids = pickWarmup();
    if (!ids.length) return;
    var dirs = [];
    ids.forEach(function (id) { var d = id.split("/")[0]; if (dirs.indexOf(d) < 0) dirs.push(d); });
    loadCards(dirs, function () {
      var cards = [];
      dirs.forEach(function (d) { cards = cards.concat(loaded[d]); });
      window.StudiaQuiz.open({
        cards: cards, ids: ids, title: "Rozgrzewka", opener: btn,
        deck: {
          noRepeat: true, doneTitle: "Rozgrzewka gotowa", closeLabel: "Zamknij",
          moreLabel: "Jeszcze " + WARM, onMore: function () { warmup(btn); },
          linkFor: function (id) { var x = secOf[id]; return x && { href: hrefOf(x), t: x.t, s: where(x) }; }
        }
      });
    });
  }

  /* ---------- lista: rozgrzewka + sekcje z zaległymi pytaniami ---------- */
  var group = null;
  function render() {
    var list = SECS.filter(function (x) { return !here || x.dir === here; }).map(function (x) {
      var due = SRS.reviewList(x.ids);
      return { x: x, n: due.length, d: due.length ? SRS.get(due[0]).d : "" };
    }).filter(function (r) { return r.n; });
    // najpierw najdłużej czekające, potem te z największą liczbą pytań
    list.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : b.n - a.n; });

    var canWarm = !!window.StudiaQuiz && pickWarmup().length > 0;
    if (!list.length && !canWarm) { if (group) { group.remove(); group = null; } return; }

    var rows = "";
    if (canWarm) {
      var total = list.reduce(function (s, r) { return s + r.n; }, 0);
      rows += '<li style="' + vars(here ? hslOf(here) : [28, 22, 45]) + '"><button type="button" class="row" data-warm>' +
        '<span class="ic">' + BOLT + '</span><span class="tx"><span class="t">Rozgrzewka · ' + WARM + " " + plq(WARM) + "</span>" +
        '<span class="s">' + (total ? "Najpierw zaległe, potem ostatnio czytane" : "Z ostatnio czytanych notatek") + "</span></span></button></li>";
    }
    list.forEach(function (r, i) {
      var x = r.x;
      rows += '<li style="' + vars(x.hsl) + '"' + (i >= SHOW ? " hidden data-more" : "") + '><a class="row" href="' + esc(hrefOf(x, true)) + '">' +
        '<span class="ic alt">' + DOC + '</span><span class="tx"><span class="t">' + esc(x.t) + "</span>" +
        '<span class="s">' + esc(here ? x.ul : where(x)) + "</span></span>" +
        '<span class="badge" aria-label="' + r.n + " " + plq(r.n) + ' do powtórki">' + r.n + "</span></a></li>";
    });
    if (list.length > SHOW) {
      rows += '<li class="more"><button type="button" class="row empty" data-all>Pokaż wszystkie sekcje (' + list.length + ")</button></li>";
    }
    var fresh = !group;
    if (fresh) { group = document.createElement("section"); group.className = "group today"; }
    group.innerHTML = "<h2>Na dziś</h2>" + '<ul class="ios-list">' + rows + "</ul>";
    if (fresh) main.appendChild(group);
  }
  function hslOf(dir) { var d = IDX.filter(function (x) { return x.dir === dir; })[0]; return d ? d.hsl : [28, 22, 45]; }

  main.addEventListener("click", function (e) {
    if (!group || !group.contains(e.target)) return;
    var w = e.target.closest("[data-warm]");
    if (w) { warmup(w); return; }
    var all = e.target.closest("[data-all]");
    if (all) {
      group.querySelectorAll("[data-more]").forEach(function (li) { li.hidden = false; });
      all.parentNode.remove();
    }
  });
  if (window.StudiaQuiz) window.StudiaQuiz.onClose = render;
  window.addEventListener("pageshow", function (e) { if (e.persisted) render(); });   // powrót z notatek (pamięć podręczna Safari)
  render();
})();
