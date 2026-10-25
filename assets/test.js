/* =========================================================
   Studia — test z przedmiotu: wybór wykładu i długości, pytania zamknięte, wynik na koniec.
   Wymaga: srs.js, flashcards.js, cards.js (window.STUDIA_CARDS), cards-index.js (tytuły sekcji).
   Strona: <main id="test"> + <script type="application/json" id="test-units">.
   test.html#wyklad-3.html — od razu zaznaczony wykład 3.
   Najlepszy wynik: localStorage studia-test-v1 (osobno na każdym urządzeniu).
   ========================================================= */
(function () {
  "use strict";
  var el = document.getElementById("test"), data = document.getElementById("test-units");
  var cards = window.STUDIA_CARDS || [];
  if (!el || !data || !cards.length || !window.StudiaDeck) return;
  el.classList.add("st-deck");
  var dir = cards[0].id.split("/")[0];
  var KEY = "studia-test-v1";
  var LENGTHS = [10, 20, 0];            // 0 = wszystkie
  if (data.getAttribute("data-lengths")) LENGTHS = data.getAttribute("data-lengths").split(",").map(Number);

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plq(n) { return n === 1 ? "pytanie" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "pytania" : "pytań"); }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* zakresy: cały przedmiot + każdy wykład z pytaniami */
  var units = JSON.parse(data.textContent).map(function (u) {
    u.ids = cards.filter(function (c) { return c.u === u.u; }).map(function (c) { return c.id; });
    return u;
  }).filter(function (u) { return u.ids.length; });
  var scopes = [{ key: "", label: "Cały przedmiot", title: "", ids: cards.map(function (c) { return c.id; }) }].concat(
    units.map(function (u) { return { key: u.u, label: u.label, title: u.title, ids: u.ids }; }));

  /* tytuły sekcji do podsumowania */
  var secTitle = {};
  (window.STUDIA_INDEX || []).forEach(function (d) {
    if (d.dir !== dir) return;
    (d.secs || []).forEach(function (s) { secTitle[s.u + "#" + s.s] = s.t; });
  });
  var byId = {}; cards.forEach(function (c) { byId[c.id] = c; });
  var unitLabel = {}; units.forEach(function (u) { unitLabel[u.u] = u.label; });
  function linkFor(id) {
    var c = byId[id]; if (!c || !c.u) return null;
    return { href: c.u + (c.s ? "#" + c.s : ""), t: secTitle[c.u + "#" + c.s] || unitLabel[c.u] || c.u, s: unitLabel[c.u] || "" };
  }

  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function best(scope) { return store[dir + ":" + scope]; }

  /* test.html#zajecia-2.html:2 — zakres i liczba pytań (2 = próbna wejściówka) */
  var hash = decodeURIComponent((location.hash || "").slice(1)).split(":");
  var pickScope = hash[0];
  if (!scopes.some(function (s) { return s.key === pickScope; })) pickScope = "";
  var pickLen = LENGTHS[0] === 2 ? 10 : LENGTHS[0];
  if (hash[1] && LENGTHS.indexOf(+hash[1]) >= 0) pickLen = +hash[1];
  if (LENGTHS.indexOf(pickLen) < 0) pickLen = LENGTHS[0];
  var wantLen = pickLen;

  function setup() {
    var html = '<p class="st-test-h">Zakres</p><div class="st-scopes" role="radiogroup" aria-label="Zakres testu">';
    scopes.forEach(function (s) {
      var b = best(s.key), on = s.key === pickScope;
      html += '<button type="button" class="st-scope" role="radio" aria-checked="' + on + '" data-scope="' + esc(s.key) + '">' +
        '<span class="t">' + esc(s.label) + (s.title ? " · " + esc(s.title) : "") + "</span>" +
        '<span class="s">' + s.ids.length + " " + plq(s.ids.length) + (b ? " · najlepszy wynik " + b.best + "%" : "") + "</span></button>";
    });
    var total = scopes.filter(function (s) { return s.key === pickScope; })[0].ids.length;
    html += '</div><p class="st-test-h">Liczba pytań</p><div class="st-seg" role="group" aria-label="Liczba pytań">';
    var lens = LENGTHS.filter(function (n) { return !n || n < total; });
    if (lens.indexOf(pickLen) < 0) pickLen = 0;
    lens.forEach(function (n) {
      html += '<button type="button" data-len="' + n + '" aria-pressed="' + (n === pickLen) + '">' + (n === 2 ? "2 · jak na wejściówce" : n || "Wszystkie (" + total + ")") + "</button>";
    });
    html += '</div><div class="st-fcard-actions"><button class="st-btn primary wide" type="button" data-start>Zacznij test</button></div>';
    el.innerHTML = html;
  }

  function run(ids, scope) {
    window.scrollTo(0, 0);
    window.StudiaDeck(el, cards, {
      mode: "fixed", ids: ids, test: true, noRepeat: true, linkFor: linkFor,
      onStep: function () { window.scrollTo(0, 0); },
      onFinish: function (ok, n) {
        if (n < 5) return;                     // krótkie „powtórz błędne” nie liczy się do wyniku
        var pct = Math.round(100 * ok / n), k = dir + ":" + scope, prev = store[k];
        store[k] = { best: Math.max(pct, prev ? prev.best : 0), last: pct, n: n };
        save();
      },
      onRetry: function (missed) { fresh(); run(shuffled(missed), scope); },
      onMore: function () { fresh(); setup(); window.scrollTo(0, 0); }
    });
  }
  // nowa instancja testu bez starych nasłuchiwaczy
  function fresh() {
    var n = el.cloneNode(false); el.parentNode.replaceChild(n, el); el = n; el.addEventListener("click", onClick);
  }
  function onClick(e) {
    var s = e.target.closest("[data-scope]"), l = e.target.closest("[data-len]"), go = e.target.closest("[data-start]");
    if (s) { pickScope = s.getAttribute("data-scope"); pickLen = wantLen; setup(); }
    else if (l) { pickLen = wantLen = +l.getAttribute("data-len"); setup(); }
    else if (go) {
      var sc = scopes.filter(function (x) { return x.key === pickScope; })[0];
      var ids = shuffled(sc.ids);
      if (pickLen && pickLen < ids.length) ids = ids.slice(0, pickLen);
      fresh(); run(ids, pickScope);
    }
  }
  el.addEventListener("click", onClick);
  setup();
})();
