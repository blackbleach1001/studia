/* =========================================================
   Studia — arkusz z pytaniami („Sprawdź tę sekcję”, powtórki, rozgrzewka).
   Wymaga: srs.js, flashcards.js. Odpowiedzi trafiają do planu powtórek.
   window.StudiaQuiz.open({ cards, ids, title, opener?, deck? })  — deck = dodatkowe opcje StudiaDeck
   Strona notatek (window.STUDIA_CARDS):
     przyciski [data-check] otwierają pytania z sekcji;
     adres …#powtorka-<sekcja> (z listy powtórek) przewija do sekcji i otwiera jej zaległe pytania,
     …#powtorka — pytania z całego wykładu, które nie należą do żadnej sekcji.
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

  /* wejście z listy powtórek: przewiń do sekcji i otwórz jej zaległe pytania */
  function review() {
    var m = /^#powtorka(?:-(.+))?$/.exec(location.hash);
    if (!m) return;
    var sid = m[1] ? decodeURIComponent(m[1]) : "", target, btn, ids;
    if (sid) {
      target = document.getElementById(sid);
      btn = target && (target.querySelector(".st-check:not(.unit) button") ||
        // sekcja bez kontenera: przycisk stoi za nagłówkiem, przed następnym h2
        (function () { for (var n = target.nextElementSibling; n && n.tagName !== "H2"; n = n.nextElementSibling) { if (n.matches(".st-check:not(.unit)")) return n.querySelector("button"); } return null; })());
      ids = btn ? idsOf(btn) : [];
    } else {
      btn = document.querySelector(".st-check.unit button");
      var inSec = {};
      document.querySelectorAll(".st-check:not(.unit) button").forEach(function (b) { idsOf(b).forEach(function (i) { inSec[i] = 1; }); });
      ids = btn ? idsOf(btn).filter(function (i) { return !inSec[i]; }) : [];
      target = btn;
    }
    try { history.replaceState(null, "", location.pathname + location.search + (sid ? "#" + sid : "")); } catch (e) {}
    if (!target) return;
    for (var d = target.closest("details") || (target.tagName === "DETAILS" ? target : null); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
    if (target.tagName === "DETAILS") target.open = true;
    target.scrollIntoView({ block: "start" });
    var due = window.SRS.reviewList(ids);
    if (!due.length) return;
    open({ cards: cards, ids: due, opener: btn,
      title: sid ? "Powtórka: " + (btn.getAttribute("data-title") || "") : "Powtórka z wykładu",
      deck: { doneTitle: "Powtórka gotowa", closeLabel: "Czytaj tę sekcję" } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", review);
  else review();
})();
