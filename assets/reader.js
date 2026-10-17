// Pasek czytania: powrót do spisu, czcionka Atkinson, tryb skupienia.
// Ustawienia zapamiętywane w tej przeglądarce.
(function () {
  var KEY = "studia-reader";
  var state = { atk: false, focus: false };
  try { state = Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var home = document.currentScript && document.currentScript.dataset.home || "../";
  var bar = document.createElement("nav");
  bar.className = "reader-bar";
  bar.setAttribute("aria-label", "Ustawienia czytania");
  bar.innerHTML =
    (home === "none" ? "" : '<a href="' + home + '">← Spis</a>') +
    '<button type="button" data-k="atk" title="Czcionka Atkinson Hyperlegible">Aa</button>' +
    '<button type="button" data-k="focus">Skupienie</button>';

  function apply() {
    document.body.classList.toggle("atk", !!state.atk);
    document.body.classList.toggle("focus", !!state.focus);
    bar.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", state[b.dataset.k] ? "true" : "false");
    });
  }

  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    state[b.dataset.k] = !state[b.dataset.k];
    if (b.dataset.k === "focus" && state.focus) {
      // w trybie skupienia zostaje otwarta tylko jedna sekcja
      var open = document.querySelectorAll("details[open]");
      open.forEach(function (d, i) { if (i > 0) d.open = false; });
    }
    save(); apply();
  });

  // tryb skupienia: otwarcie sekcji zamyka pozostałe
  document.addEventListener("toggle", function (e) {
    var d = e.target;
    if (!state.focus || d.tagName !== "DETAILS" || !d.open) return;
    document.querySelectorAll("details[open]").forEach(function (o) {
      if (o !== d && !o.contains(d) && !d.contains(o)) o.open = false;
    });
    d.scrollIntoView({ block: "start", behavior: "smooth" });
  }, true);

  document.body.appendChild(bar);
  apply();
})();
