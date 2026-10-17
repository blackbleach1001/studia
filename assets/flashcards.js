/* =========================================================
   Studia — fiszki. Karty w <script type="application/json" id="cards">
   [{ "q": "...", "a": "<p>...</p>", "src": "..." }]
   Postęp zapamiętywany w tej przeglądarce.
   ========================================================= */
(function () {
  "use strict";
  var data = JSON.parse(document.getElementById("cards").textContent);
  var KEY = "studia-cards:" + location.pathname;
  var known = {};
  try { known = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(known)); } catch (e) {} }

  var app = document.getElementById("deck");
  var mode = "todo";           // todo = tylko te, których jeszcze nie umiem; all = wszystkie
  var order = [], pos = 0, shown = false;

  function build() {
    order = data.map(function (_, i) { return i; }).filter(function (i) { return mode === "all" || !known[i]; });
    pos = 0; shown = false; render();
  }
  function shuffle() {
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
    pos = 0; shown = false; render();
  }
  function count() { return Object.keys(known).filter(function (k) { return known[k]; }).length; }

  function render() {
    var total = data.length, k = count();
    var head =
      '<div class="deck-head">' +
        '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + k + '" aria-label="Umiem ' + k + ' z ' + total + '">' +
          '<span style="width:' + (100 * k / total) + '%"></span></div>' +
        '<p class="deck-stat">Umiem <strong>' + k + '</strong> z ' + total + '</p>' +
        '<div class="deck-tools">' +
          '<button class="btn" type="button" data-a="shuffle">Przetasuj</button>' +
          '<button class="btn" type="button" data-a="mode" aria-pressed="' + (mode === "all") + '">' + (mode === "all" ? "Pokaż tylko do powtórki" : "Pokaż wszystkie") + '</button>' +
        '</div>' +
      '</div>';

    if (!order.length) {
      app.innerHTML = head +
        '<div class="card-done"><p><strong>Wszystkie fiszki oznaczone jako umiem.</strong></p>' +
        '<div class="deck-tools"><button class="btn" type="button" data-a="mode">Pokaż wszystkie</button>' +
        '<button class="btn" type="button" data-a="reset">Zacznij od nowa</button></div></div>';
      return;
    }
    var i = order[pos], c = data[i];
    app.innerHTML = head +
      '<article class="fcard' + (shown ? " is-shown" : "") + '" aria-live="polite">' +
        '<p class="fcard-n">Pytanie ' + (pos + 1) + ' z ' + order.length + (c.src ? ' · ' + c.src : "") + (known[i] ? ' · <span class="ok">umiem</span>' : "") + '</p>' +
        '<h2 class="fcard-q">' + c.q + '</h2>' +
        (shown
          ? '<div class="fcard-a">' + c.a + '</div>'
          : '') +
      '</article>' +
      '<div class="fcard-actions">' +
        (shown
          ? '<button class="btn" type="button" data-a="again">Jeszcze raz</button>' +
            '<button class="btn primary" type="button" data-a="know">Umiem</button>'
          : '<button class="btn" type="button" data-a="prev"' + (pos === 0 ? " disabled" : "") + '>Wstecz</button>' +
            '<button class="btn primary" type="button" data-a="show">Pokaż odpowiedź</button>') +
      '</div>';
  }

  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.dataset.a, i = order[pos];
    if (a === "show") { shown = true; render(); var ans = app.querySelector(".fcard-a"); if (ans) ans.setAttribute("tabindex", "-1"), ans.focus({ preventScroll: true }); return; }
    if (a === "prev") { pos = Math.max(0, pos - 1); shown = false; render(); return; }
    if (a === "know") { known[i] = true; save(); next(true); return; }
    if (a === "again") { known[i] = false; save(); next(false); return; }
    if (a === "shuffle") { shuffle(); return; }
    if (a === "mode") { mode = mode === "all" ? "todo" : "all"; build(); return; }
    if (a === "reset") { known = {}; save(); mode = "todo"; build(); return; }
  });
  function next(remove) {
    if (remove && mode === "todo") order.splice(pos, 1);
    else pos++;
    if (pos >= order.length) pos = 0;
    shown = false; render();
    window.scrollTo({ top: app.offsetTop - 12, behavior: "smooth" });
  }
  build();
})();
