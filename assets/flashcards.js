/* =========================================================
   Studia — fiszki z powtórkami rozłożonymi w czasie (wymaga srs.js)
   window.StudiaDeck(el, cards, opts)
     cards: [{ id, q, a, src }]
     opts.mode: "today" | "all" | "fixed"   (fixed = podana lista, bez przełącznika)
     opts.title, opts.onClose
   Strona z fiszkami: <script type="application/json" id="cards"> + <main id="deck">
   ========================================================= */
(function () {
  "use strict";
  var SRS = window.SRS;

  function StudiaDeck(el, cards, opts) {
    opts = opts || {};
    var byId = {}; cards.forEach(function (c) { byId[c.id] = c; });
    var ids = cards.map(function (c) { return c.id; });
    var mode = opts.mode || "today";
    var queue = [], shown = false, done = 0, okCount = 0, sessionTotal = 0;

    function build() {
      queue = mode === "today" ? SRS.dueList(ids) : ids.slice();
      sessionTotal = queue.length; done = 0; okCount = 0; shown = false;
      render();
    }
    function shuffle() {
      for (var i = queue.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = queue[i]; queue[i] = queue[j]; queue[j] = t; }
      shown = false; render();
    }

    function head() {
      if (mode === "fixed") {
        return '<div class="st-deck-head"><div class="st-progress" aria-hidden="true"><span style="width:' +
          (sessionTotal ? 100 * done / sessionTotal : 100) + '%"></span></div></div>';
      }
      var st = SRS.stats(ids);
      return '<div class="st-deck-head">' +
        '<div class="st-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + st.total + '" aria-valuenow="' + st.mastered + '" aria-label="Opanowane ' + st.mastered + ' z ' + st.total + '">' +
          '<span style="width:' + (100 * st.mastered / Math.max(1, st.total)) + '%"></span></div>' +
        '<p class="st-deck-stat"><strong>' + st.due + '</strong> na dziś · opanowane ' + st.mastered + ' z ' + st.total + '</p>' +
        '<div class="st-deck-tools">' +
          '<div class="st-seg" role="group" aria-label="Zakres">' +
            '<button type="button" data-a="today" aria-pressed="' + (mode === "today") + '">Na dziś</button>' +
            '<button type="button" data-a="all" aria-pressed="' + (mode === "all") + '">Wszystkie</button>' +
          '</div>' +
          '<button class="st-btn" type="button" data-a="shuffle">Przetasuj</button>' +
        '</div></div>';
    }

    function badge(id) {
      var c = SRS.get(id);
      if (!c) return '<span class="st-tag new">Nowa</span>';
      if (c.d <= SRS.today()) return '<span class="st-tag">Powtórka</span>';
      return '<span class="st-tag muted">Następna: ' + SRS.label(c.d) + '</span>';
    }

    function render() {
      if (!queue.length) {
        var html = head() + '<div class="st-done">';
        if (mode === "fixed") {
          html += '<p class="st-done-t">Sprawdzone</p><p>Umiesz ' + okCount + ' z ' + sessionTotal + '. Pytania wrócą w powtórkach.</p>' +
            (opts.onClose ? '<div class="st-deck-tools"><button class="st-btn primary" type="button" data-a="close">Wróć do notatek</button></div>' : "");
        } else if (mode === "today") {
          var st = SRS.stats(ids);
          html += '<p class="st-done-t">Na dziś gotowe</p>' +
            '<p>' + (st.next ? "Następna powtórka: " + SRS.label(st.next) + "." : "Brak zaplanowanych powtórek.") + '</p>' +
            '<div class="st-deck-tools"><button class="st-btn" type="button" data-a="all">Przejrzyj wszystkie</button></div>';
        } else {
          html += '<p class="st-done-t">Koniec talii</p><div class="st-deck-tools"><button class="st-btn" type="button" data-a="restart">Od początku</button></div>';
        }
        el.innerHTML = html + "</div>";
        return;
      }
      var id = queue[0], c = byId[id];
      var n = sessionTotal - queue.length + 1;
      el.innerHTML = head() +
        '<article class="st-fcard' + (shown ? "" : " can-reveal") + '"' + (shown ? "" : ' data-a="show"') + ' aria-live="polite">' +
          '<p class="st-fcard-n"><span>' + (mode === "fixed" ? "Pytanie " + Math.min(n, sessionTotal) + " z " + sessionTotal : (c.src || "")) + '</span>' + badge(id) + '</p>' +
          '<h2 class="st-fcard-q">' + c.q + '</h2>' +
          (shown ? '<div class="st-fcard-a" tabindex="-1">' + c.a + '</div>' : "") +
        '</article>' +
        '<div class="st-fcard-actions">' +
          (shown
            ? '<button class="st-btn" type="button" data-a="again">Jeszcze raz</button>' +
              '<button class="st-btn primary" type="button" data-a="know">Umiem</button>'
            : '<button class="st-btn primary wide" type="button" data-a="show">Pokaż odpowiedź</button>') +
        '</div>';
      if (shown) { var a = el.querySelector(".st-fcard-a"); if (a) a.focus({ preventScroll: true }); }
    }

    function answer(ok) {
      var id = queue.shift();
      SRS.grade(id, ok);
      if (ok) { okCount += 1; done += 1; }
      else {
        // wraca jeszcze w tej sesji, po kilku innych pytaniach
        queue.splice(Math.min(queue.length, 3), 0, id);
      }
      shown = false; render();
      if (opts.onStep) opts.onStep();
    }

    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b || !el.contains(b)) return;
      var a = b.dataset.a;
      if (a === "show") { shown = true; render(); }
      else if (a === "know") answer(true);
      else if (a === "again") answer(false);
      else if (a === "shuffle") shuffle();
      else if (a === "today" || a === "all") { if (mode !== a) { mode = a; build(); } }
      else if (a === "restart") build();
      else if (a === "close" && opts.onClose) opts.onClose();
    });

    if (mode === "fixed" && opts.ids) { ids = opts.ids.filter(function (i) { return byId[i]; }); }
    build();
    return { rebuild: build };
  }
  window.StudiaDeck = StudiaDeck;

  /* strona z fiszkami */
  var data = document.getElementById("cards"), root = document.getElementById("deck");
  if (data && root) {
    root.classList.add("st-deck");
    StudiaDeck(root, JSON.parse(data.textContent), { mode: "today" });
  }
})();
