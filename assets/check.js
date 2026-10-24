/* =========================================================
   Studia — arkusz z pytaniami („Sprawdź tę sekcję”).
   Wymaga: srs.js, flashcards.js. Odpowiedzi trafiają do planu powtórek.
   window.StudiaQuiz.open({ cards, ids, title, opener?, deck? })  — deck = dodatkowe opcje StudiaDeck
   Strona notatek (window.STUDIA_CARDS): przyciski [data-check] otwierają pytania z sekcji.
   ========================================================= */
(function () {
  "use strict";
  if (!window.StudiaDeck || !window.SRS) return;

  var sheet = null, deckEl, titleEl, opener = null;
  function make() {
    sheet = document.createElement("div");
    sheet.className = "st-sheet"; sheet.hidden = true;
    sheet.innerHTML =
      '<div class="st-scrim" data-x></div>' +
      '<section class="st-panel tall" role="dialog" aria-modal="true" aria-labelledby="st-check-t">' +
        '<div class="st-grab" aria-hidden="true"></div>' +
        '<header><h2 id="st-check-t">Sprawdź się</h2><button type="button" data-x>Zamknij</button></header>' +
        '<div class="st-deck"></div>' +
      "</section>";
    document.body.appendChild(sheet);
    deckEl = sheet.querySelector(".st-deck"); titleEl = sheet.querySelector("#st-check-t");
    sheet.addEventListener("click", function (e) { if (e.target.closest("[data-x]")) close(); });
    if (window.StudiaSheet) window.StudiaSheet(sheet, close);
    else document.addEventListener("DOMContentLoaded", function () { if (window.StudiaSheet) window.StudiaSheet(sheet, close); });
  }

  function open(o) {
    if (!sheet) make();
    opener = o.opener || null;
    titleEl.textContent = o.title || "Sprawdź się";
    var fresh = deckEl.cloneNode(false);            // nowa instancja bez starych nasłuchiwaczy
    deckEl.parentNode.replaceChild(fresh, deckEl); deckEl = fresh;
    var opts = { mode: "fixed", ids: o.ids, onClose: close, onStep: function () { deckEl.scrollTop = 0; } };
    Object.keys(o.deck || {}).forEach(function (k) { opts[k] = o.deck[k]; });
    window.StudiaDeck(deckEl, o.cards, opts);
    sheet.hidden = false; document.body.classList.add("st-locked");
    sheet.querySelector("header button").focus({ preventScroll: true });
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true; document.body.classList.remove("st-locked");
    if (opener) opener.focus({ preventScroll: true });
    if (window.StudiaQuiz.onClose) window.StudiaQuiz.onClose();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet && !sheet.hidden) close(); });
  window.StudiaQuiz = { open: open, close: close };

  /* ---------- strona notatek ---------- */
  var cards = window.STUDIA_CARDS || [];
  if (!cards.length) return;

  function idsOf(btn) { return btn.getAttribute("data-check").split(","); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-check]");
    if (!b) return;
    e.preventDefault();
    open({ cards: cards, ids: idsOf(b), title: b.getAttribute("data-title"), opener: b });
  });
})();
