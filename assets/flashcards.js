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
   Odpowiedź z pamięci: najpierw przypominasz sobie odpowiedź (można ją powiedzieć
   lub napisać — punkty, które w niej padły, zaznaczają się same), potem ją odsłaniasz.
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

  /* ---------- odpowiedź własnymi słowami (głos lub tekst) ----------
     Rozpoznawanie mowy Safari (pl-PL); bez niego — pole tekstowe (działa dyktowanie z klawiatury).
     Po odsłonięciu kluczowe punkty, które padły w odpowiedzi, są już zaznaczone. */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var STOPW = {};
  ("jest są był była było były będzie oraz przez które który która którzy tego temu tych tymi jako może można między " +
   "bardzo tylko także także gdy gdyż jeśli jeżeli czyli więc albo nawet inne innych inny inna jego jej ich sobie siebie " +
   "wiele dużo przy nad pod bez ponad wobec według dzięki często zawsze nigdy bardziej mniej sposób rodzaj tzw np itd itp " +
   "czyli jakiś jakaś jakie jaki jaka taki taka takie tutaj wtedy kiedy dlatego ponieważ jednak również wszystko wszystkie " +
   "jedna jeden jedno nich niej niego nimi będą mają mamy mieć jestem chodzi znaczy właśnie trochę coś czegoś").split(" ")
    .forEach(function (w) { STOPW[w] = 1; });
  function fold(s) {
    return String(s).toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function contentWords(s) {
    var out = [];
    String(s).replace(/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9]+/g, function (w) {
      var acr = /^[A-ZĄĆĘŁŃÓŚŹŻ0-9]{2,}$/.test(w), f = fold(w);
      if (acr || /^\d+$/.test(w) || (f.length >= 4 && !STOPW[w.toLowerCase()])) out.push(f);
      return w;
    });
    return out;
  }
  /* podobne słowa: odmiana przez przypadki (zadania/zadaniach, nowe/nowych) */
  function alike(a, b) {
    if (a === b) return true;
    var m = Math.min(a.length, b.length), p = 0;
    while (p < m && a[p] === b[p]) p++;
    var need = m <= 4 ? m - 1 : Math.min(5, m - 2);
    return m >= 3 && p >= Math.max(3, need);
  }
  /* które punkty padły: przy 1–2 słowach treściowych wystarczy jedno, przy dłuższych — 60% */
  function matchTerms(said, terms) {
    var sw = contentWords(said), got = {}, used = {};
    terms.forEach(function (t, i) {
      var tw = contentWords(t);
      if (!tw.length) return;
      var hits = [];
      tw.forEach(function (w) {
        for (var j = 0; j < sw.length; j++) if (alike(w, sw[j])) { hits.push(j); return; }
      });
      if (hits.length >= (tw.length <= 2 ? 1 : Math.ceil(tw.length * 0.6))) {
        got[i] = true;
        hits.forEach(function (j) { used[sw[j]] = 1; });
      }
    });
    return { got: got, used: used };
  }
  function markSaid(said, used) {
    return esc(said).replace(/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9]+/g, function (w) {
      return used[fold(w)] ? "<mark>" + w + "</mark>" : w;
    });
  }
  var MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
  var KEYB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';

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
      if (!cur || cur.id !== id) { stopRec(); var c = byId[id]; cur = { id: id, terms: c.k && c.k.length ? c.k : keyTerms(c.a), got: {}, said: "", auto: {}, used: {} }; }
      return cur;
    }

    /* ---------- nagrywanie odpowiedzi ---------- */
    var rec = null, recOn = false;
    function sayBox() { return el.querySelector(".st-say-tx"); }
    function sayUI() {
      var b = el.querySelector('[data-a="mic"]'), t = sayBox();
      if (b) {
        b.setAttribute("aria-pressed", recOn);
        b.querySelector("span").textContent = recOn ? "Zakończ" : (cur && cur.said ? "Mów dalej" : "Powiedz odpowiedź");
      }
      if (t) { t.hidden = !(cur && (cur.said || cur.typing)); }
    }
    function stopRec() {
      if (rec) { try { rec.stop(); } catch (e) {} rec = null; }
      recOn = false;
    }
    document.addEventListener("visibilitychange", function () { if (document.hidden) { stopRec(); if (!shown) sayUI(); } });
    function startRec() {
      var base = cur.said ? cur.said.replace(/\s+$/, "") + " " : "";
      var card = cur, r = rec = new SR();
      r.lang = "pl-PL"; r.continuous = true; r.interimResults = true;
      r.onresult = function (e) {
        if (cur !== card || !el.offsetParent) { try { r.stop(); } catch (x) {} return; }   // inne pytanie albo zamknięty arkusz
        var txt = "";
        for (var i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript + " ";
        card.said = (base + txt).replace(/\s+/g, " ").trim();
        var t = sayBox(); if (t) { t.value = card.said; t.hidden = false; }
      };
      r.onerror = function (e) {
        if (cur !== card) return;
        recOn = false;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          cur.typing = true; sayUI();
          var t = sayBox(); if (t) { t.placeholder = "Mikrofon jest wyłączony. Możesz napisać odpowiedź."; t.focus(); }
        } else sayUI();
      };
      r.onend = function () { if (rec === r) { rec = null; recOn = false; if (!shown) sayUI(); } };
      try { r.start(); recOn = true; } catch (e) { recOn = false; rec = null; }
      sayUI();
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
      var said = k.said && k.said.trim();
      el.innerHTML = head() +
        '<article class="st-fcard' + (shown ? "" : " can-reveal") + '"' + (shown ? "" : ' data-a="show"') + ' aria-live="polite">' + top +
          (shown ? (said ? '<div class="st-said"><p class="st-said-h">Twoja odpowiedź</p><p class="st-said-tx">' + markSaid(said, k.used) + "</p></div>" : "") +
              '<div class="st-fcard-a" tabindex="-1">' + c.a + '</div>' +
              (terms ? '<div class="st-terms"><p class="st-terms-h">Co było w Twojej odpowiedzi? <span>' + nGot + " z " + terms.length + "</span></p>" +
                '<div class="st-chips">' + terms.map(function (x, i) {
                  return '<button type="button" class="st-chip' + (k.auto[i] ? " auto" : "") + '" data-a="term" data-i="' + i + '" aria-pressed="' + !!k.got[i] + '">' + esc(x) + "</button>";
                }).join("") + "</div>" +
                (said ? '<p class="st-terms-note">Zaznaczone na podstawie Twojej odpowiedzi. Popraw, jeśli trzeba.</p>' : "") +
                "</div>" : "")
            : '<p class="st-fcard-hint">Odpowiedz z pamięci własnymi słowami. Potem sprawdź.</p>') +
        '</article>' +
        (!shown ? '<div class="st-say">' +
          '<div class="st-say-tools">' +
            (SR ? '<button class="st-say-btn" type="button" data-a="mic" aria-pressed="false">' + MIC + "<span>Powiedz odpowiedź</span></button>" : "") +
            (!SR || !said ? '<button class="st-say-btn plain" type="button" data-a="type"' + (SR ? ' aria-label="Napisz odpowiedź"' : "") + ">" + KEYB + "<span>" + (SR ? "Napisz" : "Napisz odpowiedź") + "</span></button>" : "") +
          "</div>" +
          '<textarea class="st-say-tx" rows="3" aria-label="Twoja odpowiedź" placeholder="Twoja odpowiedź"' + (said || k.typing ? "" : " hidden") + ">" + esc(k.said || "") + "</textarea>" +
        "</div>" : "") +
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
      if (a === "show") {
        stopRec();
        var t = sayBox(); if (t) cur.said = t.value;
        if (cur.said && cur.said.trim() && cur.terms) {
          var m = matchTerms(cur.said, cur.terms);
          cur.got = m.got; cur.auto = {}; Object.keys(m.got).forEach(function (i) { cur.auto[i] = true; }); cur.used = m.used;
        }
        shown = true; render();
      }
      else if (a === "mic") {
        if (recOn) stopRec();
        else { var tx = sayBox(); if (tx) cur.said = tx.value; startRec(); }
        sayUI();
      }
      else if (a === "type") {
        stopRec(); cur.typing = true;
        var ta = sayBox(); if (ta) { ta.hidden = false; ta.focus(); }
        sayUI();
      }
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

    el.addEventListener("input", function (e) {
      if (e.target.classList && e.target.classList.contains("st-say-tx") && cur) cur.said = e.target.value;
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
