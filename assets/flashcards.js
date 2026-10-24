/* =========================================================
   Studia — fiszki z powtórkami rozłożonymi w czasie (wymaga srs.js)
   window.StudiaDeck(el, cards, opts)
     cards: [{ id, q, a, src, u?, s?, o?, e? }]
     opts.mode: "today" | "all" | "fixed"   (fixed = podana lista, bez przełącznika)
     opts.ids        — lista pytań w trybie fixed
     opts.pool       — fiszki, z których losujemy błędne odpowiedzi (domyślnie cards)
     opts.noRepeat   — błędne pytanie nie wraca w tej sesji (rozgrzewka)
     opts.linkFor(id) → { href, t } — podsumowanie linkuje do sekcji z błędnymi pytaniami
     opts.onClose, opts.closeLabel, opts.onMore, opts.moreLabel, opts.doneTitle, opts.onStep
   Pytanie zamknięte (wybór z 3–4 odpowiedzi): nowe i świeże fiszki (pudełko 0–1).
   Dalej: przypomnij sobie i oceń (Umiem / Jeszcze raz).
   Strona z fiszkami: <script type="application/json" id="cards"> + <main id="deck">
   ========================================================= */
(function () {
  "use strict";
  var SRS = window.SRS;
  var MC_UNTIL_BOX = 2;           // od tego pudełka pytamy bez podpowiedzi

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function dirOf(id) { return id.split("/")[0]; }

  /* krótka wersja odpowiedzi do pytania zamkniętego: pierwsze zdanie albo ~170 znaków */
  var MAX = 170;
  function brief(html) {
    var t = String(html).replace(/<\/li>\s*(?=<li)/g, "; ").replace(/<\/?(p|li|div|br|ul|ol|tr|td|th)\b[^>]*>/g, " ").replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ").replace(/\s+([,.;:!?)])/g, "$1").trim();
    if (t.length <= MAX) return t;
    var re = /[.!?;](?=\s+[A-ZĄĆĘŁŃÓŚŹŻ(„])/g, m, cut = -1;
    while ((m = re.exec(t))) { if (m.index >= 50 && m.index < MAX) cut = m.index + 1; if (m.index >= MAX) break; }
    if (cut > 0) return t.slice(0, cut).replace(/;$/, ".");
    var sp = t.lastIndexOf(" ", MAX);
    return t.slice(0, sp > 60 ? sp : MAX).replace(/[,;:–—-]+$/, "") + "…";
  }

  function StudiaDeck(el, cards, opts) {
    opts = opts || {};
    var byId = {}; cards.forEach(function (c) { byId[c.id] = c; });
    var pool = opts.pool || cards;
    var ids = cards.map(function (c) { return c.id; });
    var mode = opts.mode || "today";
    var queue = [], shown = false, done = 0, firstOk = 0, sessionTotal = 0;
    var cur = null, asked = {}, missed = [];

    function build() {
      queue = mode === "today" ? SRS.dueList(ids) : ids.slice();
      sessionTotal = queue.length; done = 0; firstOk = 0; shown = false; cur = null; asked = {}; missed = [];
      render();
    }
    function shuffle() {
      queue = shuffled(queue);
      shown = false; cur = null; render();
    }

    /* ---------- pytanie zamknięte ---------- */
    function choices(c) {
      if (c.o && c.o.length > 1) {
        return shuffled(c.o.map(function (t, i) { return { t: t, ok: i === 0 }; }));
      }
      var right = brief(c.a), seen = {}; seen[right] = 1;
      var same = [], near = [];
      pool.forEach(function (x) {
        if (x.id === c.id || dirOf(x.id) !== dirOf(c.id)) return;
        if (c.u && x.u !== c.u) return;
        var t = brief(x.a);
        if (seen[t] || t.length < 12) return;
        seen[t] = 1;
        (c.s && x.s === c.s ? same : near).push(t);
      });
      // najpierw z innych sekcji tego wykładu: są z tego samego materiału, ale nie odpowiadają na to samo
      var wrong = shuffled(near).concat(shuffled(same)).slice(0, 3);
      if (wrong.length < 2) return null;
      return shuffled([{ t: right, ok: true }].concat(wrong.map(function (t) { return { t: t, ok: false }; })));
    }
    function current() {
      var id = queue[0];
      if (!cur || cur.id !== id) {
        var c = byId[id], box = (SRS.get(id) || { b: 0 }).b || 0;
        var o = !asked[id] && box < MC_UNTIL_BOX ? choices(c) : null;
        cur = { id: id, kind: o ? "mc" : "recall", o: o, pick: -1 };
      }
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
        if (mode === "fixed") {
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

      if (k.kind === "mc") {
        var picked = k.pick >= 0, ok = picked && k.o[k.pick].ok;
        el.innerHTML = head() +
          '<article class="st-fcard" aria-live="polite">' + top +
            '<div class="st-opts" role="group" aria-label="Odpowiedzi">' +
            k.o.map(function (o, i) {
              var cls = picked ? (o.ok ? " ok" : (i === k.pick ? " no" : " off")) : "";
              var note = picked ? (o.ok ? '<em>Poprawna</em>' : (i === k.pick ? '<em>Twój wybór</em>' : "")) : "";
              return '<button type="button" class="st-opt' + cls + '" data-a="pick" data-i="' + i + '"' + (picked ? " disabled" : "") + '>' +
                '<span class="k" aria-hidden="true">' + "ABCD".charAt(i) + '</span><span class="t">' + esc(o.t) + note + "</span></button>";
            }).join("") + "</div>" +
            (picked ? '<div class="st-fcard-a" tabindex="-1"><p class="st-fb ' + (ok ? "ok" : "no") + '"><b>' + (ok ? "Dobrze." : "Nie tym razem.") + "</b>" +
              (c.o && c.e ? " " + esc(c.e) : " Pełna odpowiedź:") + "</p>" + (c.o && c.e ? "" : c.a) + "</div>" : "") +
          '</article>' +
          '<div class="st-fcard-actions">' +
            (picked ? '<button class="st-btn primary wide" type="button" data-a="next">' + (queue.length > 1 || (!ok && !opts.noRepeat) ? "Dalej" : "Zakończ") + "</button>"
              : '<button class="st-btn wide" type="button" data-a="skip">Nie wiem</button>') +
          '</div>';
        if (picked) { var fa = el.querySelector(".st-fcard-a"); if (fa) fa.focus({ preventScroll: true }); }
        return;
      }

      el.innerHTML = head() +
        '<article class="st-fcard' + (shown ? "" : " can-reveal") + '"' + (shown ? "" : ' data-a="show"') + ' aria-live="polite">' + top +
          (shown ? '<div class="st-fcard-a" tabindex="-1">' + c.a + '</div>'
            : '<p class="st-fcard-hint">Przypomnij sobie odpowiedź, potem sprawdź.</p>') +
        '</article>' +
        '<div class="st-fcard-actions">' +
          (shown
            ? '<button class="st-btn" type="button" data-a="again">Jeszcze raz</button>' +
              '<button class="st-btn primary" type="button" data-a="know">Umiem</button>'
            : '<button class="st-btn primary wide" type="button" data-a="show">Pokaż odpowiedź</button>') +
        '</div>';
      if (shown) { var a = el.querySelector(".st-fcard-a"); if (a) a.focus({ preventScroll: true }); }
    }

    function grade(ok) {
      var id = queue[0];
      SRS.grade(id, ok);
      if (!asked[id]) { if (ok) firstOk += 1; else missed.push(id); }
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
      else if (a === "pick" || a === "skip") {
        if (!cur || cur.pick >= 0) return;
        cur.pick = a === "skip" ? cur.o.map(function (o) { return o.ok; }).indexOf(true) : +b.dataset.i;
        var ok = a === "pick" && cur.o[cur.pick].ok;
        cur.ok = ok;
        grade(ok); render();
      }
      else if (a === "next") { advance(cur && cur.ok); }
      else if (a === "shuffle") shuffle();
      else if (a === "today" || a === "all") { if (mode !== a) { mode = a; build(); } }
      else if (a === "restart") build();
      else if (a === "close" && opts.onClose) opts.onClose();
      else if (a === "more" && opts.onMore) opts.onMore();
    });

    if (mode === "fixed" && opts.ids) { ids = opts.ids.filter(function (i) { return byId[i]; }); }
    build();
    return { rebuild: build };
  }
  StudiaDeck.brief = brief;
  window.StudiaDeck = StudiaDeck;

  /* strona z fiszkami */
  var data = document.getElementById("cards"), root = document.getElementById("deck");
  if (data && root) {
    root.classList.add("st-deck");
    StudiaDeck(root, JSON.parse(data.textContent), { mode: "today" });
  }
})();
