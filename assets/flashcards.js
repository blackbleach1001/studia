/* =========================================================
   Studia — fiszki z powtórkami rozłożonymi w czasie (wymaga srs.js)
   window.StudiaDeck(el, cards, opts)
     cards: [{ id, q, a, src, k?, u?, s? }]   k — kluczowe punkty odpowiedzi
     opts.mode: "today" | "all" | "fixed"   (fixed = podana lista, bez przełącznika)
     opts.ids        — lista pytań w trybie fixed
     opts.noRepeat   — błędne pytanie nie wraca w tej sesji (test)
     opts.linkFor(id) → { href, t } — podsumowanie linkuje do sekcji z błędnymi pytaniami
     opts.onClose, opts.closeLabel, opts.onMore, opts.moreLabel, opts.doneTitle, opts.onStep
     opts.test       — test: bez etykiet powtórek, wynik w procentach,
                       opts.onRetry(błędne id), opts.onFinish(punkty, wszystkie)
   Odpowiedź z pamięci: najpierw przypominasz sobie odpowiedź, potem ją odsłaniasz.
   Potem zaznaczasz, które kluczowe punkty (k; bez nich — pogrubienia) były w Twojej
   odpowiedzi; zaliczone od 60%. Bez punktów: Umiem / Jeszcze raz.
   Strona z fiszkami: <script type="application/json" id="cards"> + <main id="deck">
   ========================================================= */
(function () {
  "use strict";
  var SRS = window.SRS;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var PASS = 0.6;                  // zaliczone, gdy pamiętasz co najmniej 60% kluczowych pojęć

  /* kluczowe pojęcia odpowiedzi: pogrubienia (bez powtórzeń), najwyżej 8 */
  function keyTerms(html) {
    var out = [], seen = {}, re = /<(strong|b)>([\s\S]*?)<\/\1>/g, m;
    while ((m = re.exec(html)) && out.length < 8) {
      var x = m[2].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, "");
      var k = x.toLowerCase();
      if (x.length < 2 || x.length > 70 || seen[k] || /^(tak|nie)$/i.test(x)) continue;
      seen[k] = 1; out.push(x);
    }
    return out.length >= 2 ? out : null;
  }

  function StudiaDeck(el, cards, opts) {
    opts = opts || {};
    var byId = {}; cards.forEach(function (c) { byId[c.id] = c; });
    var ids = cards.map(function (c) { return c.id; });
    var mode = opts.mode || "today";
    var queue = [], shown = false, done = 0, firstOk = 0, points = 0, sessionTotal = 0;
    var cur = null, asked = {}, missed = [], finished = false;

    function build() {
      queue = mode === "today" ? SRS.dueList(ids) : ids.slice();
      sessionTotal = queue.length; done = 0; firstOk = 0; points = 0; shown = false; cur = null; asked = {}; missed = []; finished = false;
      render();
    }
    function shuffle() {
      queue = shuffled(queue);
      shown = false; cur = null; render();
    }

    function current() {
      var id = queue[0];
      if (!cur || cur.id !== id) { var c = byId[id]; cur = { id: id, terms: c.k && c.k.length ? c.k : keyTerms(c.a), got: {} }; }
      return cur;
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
      if (opts.test) return "";
      var c = SRS.get(id);
      if (!c) return '<span class="st-tag new">Nowa</span>';
      if (c.d <= SRS.today()) return '<span class="st-tag">Powtórka</span>';
      return '<span class="st-tag muted">Następna: ' + SRS.label(c.d) + '</span>';
    }

    function missedHtml() {
      if (!opts.linkFor || !missed.length) return "";
      var seen = {}, rows = "";
      missed.forEach(function (id) {
        var l = opts.linkFor(id);
        if (!l || seen[l.href]) return;
        seen[l.href] = 1;
        rows += '<li><a href="' + esc(l.href) + '"><b>' + esc(l.t) + "</b>" + (l.s ? "<span>" + esc(l.s) + "</span>" : "") + "</a></li>";
      });
      return rows ? '<p class="st-miss-h">Do przeczytania jeszcze raz</p><ul class="st-miss">' + rows + "</ul>" : "";
    }

    function render() {
      if (!queue.length) {
        var html = head() + '<div class="st-done">';
        if (mode === "fixed" && opts.test) {
          if (opts.onFinish && !finished) { finished = true; opts.onFinish(points, sessionTotal); }
          html += '<p class="st-done-t">Wynik: ' + Math.round(100 * points / Math.max(1, sessionTotal)) + "%</p>" +
            "<p>Zaliczone pytania: " + firstOk + " z " + sessionTotal + ".</p>" + missedHtml() +
            '<div class="st-deck-tools">' +
              (missed.length && opts.onRetry ? '<button class="st-btn" type="button" data-a="retry">Powtórz błędne (' + missed.length + ")</button>" : "") +
              (opts.onMore ? '<button class="st-btn primary" type="button" data-a="more">' + esc(opts.moreLabel || "Nowy test") + "</button>" : "") +
            "</div>";
        } else if (mode === "fixed") {
          html += '<p class="st-done-t">' + esc(opts.doneTitle || "Sprawdzone") + '</p><p>' +
            (firstOk === sessionTotal ? "Wszystko za pierwszym razem: " + firstOk + " z " + sessionTotal + "."
              : "Za pierwszym razem: " + firstOk + " z " + sessionTotal + ".") +
            " Pytania wrócą w powtórkach.</p>" + missedHtml() +
            ((opts.onMore || opts.onClose) ? '<div class="st-deck-tools">' +
              (opts.onClose ? '<button class="st-btn" type="button" data-a="close">' + esc(opts.closeLabel || "Wróć do notatek") + "</button>" : "") +
              (opts.onMore ? '<button class="st-btn primary" type="button" data-a="more">' + esc(opts.moreLabel || "Jeszcze") + "</button>" : "") +
              "</div>" : "");
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
      var k = current(), id = k.id, c = byId[id];
      var top = '<p class="st-fcard-n"><span>' + (mode === "fixed" ? "Pytanie " + Math.min(done + 1, sessionTotal) + " z " + sessionTotal : (c.src || "")) + '</span>' + badge(id) + '</p>' +
        '<h2 class="st-fcard-q">' + c.q + '</h2>';

      var terms = k.terms, nGot = Object.keys(k.got).length;
      el.innerHTML = head() +
        '<article class="st-fcard' + (shown ? "" : " can-reveal") + '"' + (shown ? "" : ' data-a="show"') + ' aria-live="polite">' + top +
          (shown ? '<div class="st-fcard-a" tabindex="-1">' + c.a + '</div>' +
              (terms ? '<div class="st-terms"><p class="st-terms-h">Co było w Twojej odpowiedzi? <span>' + nGot + " z " + terms.length + "</span></p>" +
                '<div class="st-chips">' + terms.map(function (x, i) {
                  return '<button type="button" class="st-chip" data-a="term" data-i="' + i + '" aria-pressed="' + !!k.got[i] + '">' + esc(x) + "</button>";
                }).join("") + "</div></div>" : "")
            : '<p class="st-fcard-hint">Odpowiedz z pamięci: na głos, w myślach albo na kartce. Potem sprawdź.</p>') +
        '</article>' +
        '<div class="st-fcard-actions">' +
          (!shown ? '<button class="st-btn primary wide" type="button" data-a="show">Pokaż odpowiedź</button>'
            : terms ? '<button class="st-btn primary wide" type="button" data-a="score">' + (nGot ? "Dalej" : "Nic nie pamiętam") + "</button>"
            : '<button class="st-btn" type="button" data-a="again">Jeszcze raz</button>' +
              '<button class="st-btn primary" type="button" data-a="know">Umiem</button>') +
        '</div>';
      if (shown && !terms) { var a = el.querySelector(".st-fcard-a"); if (a) a.focus({ preventScroll: true }); }
    }

    function grade(ok, credit) {
      var id = queue[0];
      SRS.grade(id, ok);
      if (!asked[id]) { points += credit == null ? (ok ? 1 : 0) : credit; if (ok) firstOk += 1; else missed.push(id); }
      asked[id] = true;
    }
    function advance(ok) {
      var id = queue.shift();
      if (ok || opts.noRepeat) done += 1;
      else queue.splice(Math.min(queue.length, 3), 0, id);   // wraca jeszcze w tej sesji, po kilku innych pytaniach
      shown = false; cur = null; render();
      if (opts.onStep) opts.onStep();
    }

    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b || !el.contains(b)) return;
      var a = b.dataset.a;
      if (a === "show") { shown = true; render(); }
      else if (a === "know") { grade(true); advance(true); }
      else if (a === "again") { grade(false); advance(false); }
      else if (a === "term") {
        var i = +b.dataset.i;
        if (cur.got[i]) delete cur.got[i]; else cur.got[i] = true;
        render();
        var nb = el.querySelector('[data-a="term"][data-i="' + i + '"]'); if (nb) nb.focus({ preventScroll: true });
      }
      else if (a === "score") {
        var credit = Object.keys(cur.got).length / cur.terms.length, ok = credit >= PASS;
        grade(ok, credit); advance(ok);
      }
      else if (a === "shuffle") shuffle();
      else if (a === "today" || a === "all") { if (mode !== a) { mode = a; build(); } }
      else if (a === "restart") build();
      else if (a === "close" && opts.onClose) opts.onClose();
      else if (a === "more" && opts.onMore) opts.onMore();
      else if (a === "retry" && opts.onRetry) opts.onRetry(missed.slice());
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
