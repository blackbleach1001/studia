/* =========================================================
   Studia — „Sprawdź tę sekcję”: fiszki z jednej sekcji w arkuszu.
   Wymaga: srs.js, flashcards.js, cards.js (window.STUDIA_CARDS).
   Odpowiedzi trafiają do planu powtórek.
   ========================================================= */
(function () {
  "use strict";
  var cards = window.STUDIA_CARDS || [];
  if (!cards.length || !window.StudiaDeck) return;

  var sheet = document.createElement("div");
  sheet.className = "st-sheet"; sheet.hidden = true;
  sheet.innerHTML =
    '<div class="st-scrim" data-x></div>' +
    '<section class="st-panel tall" role="dialog" aria-modal="true" aria-labelledby="st-check-t">' +
      '<div class="st-grab" aria-hidden="true"></div>' +
      '<header><h2 id="st-check-t">Sprawdź się</h2><button type="button" data-x>Zamknij</button></header>' +
      '<div class="st-deck"></div>' +
    "</section>";
  document.body.appendChild(sheet);
  var deckEl = sheet.querySelector(".st-deck"), titleEl = sheet.querySelector("#st-check-t");
  var opener = null;

  function open(btn) {
    opener = btn;
    var ids = btn.getAttribute("data-check").split(",");
    titleEl.textContent = btn.getAttribute("data-title") || "Sprawdź się";
    var fresh = deckEl.cloneNode(false);            // nowa instancja bez starych nasłuchiwaczy
    deckEl.parentNode.replaceChild(fresh, deckEl); deckEl = fresh;
    window.StudiaDeck(deckEl, cards, { mode: "fixed", ids: ids, onClose: close, onStep: function () { deckEl.scrollTop = 0; } });
    sheet.hidden = false; document.body.classList.add("st-locked");
    sheet.querySelector("header button").focus({ preventScroll: true });
  }
  function close() {
    sheet.hidden = true; document.body.classList.remove("st-locked");
    if (opener) opener.focus({ preventScroll: true });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-check]");
    if (b) { e.preventDefault(); open(b); return; }
    if (!sheet.hidden && e.target.closest("[data-x]")) close();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) close(); });
  // reader.js ładuje się po tym pliku — podpinamy po wczytaniu strony
  document.addEventListener("DOMContentLoaded", function () { if (window.StudiaSheet) window.StudiaSheet(sheet, close); });
})();
