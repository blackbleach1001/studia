/* =========================================================
   Studia — „Na dziś”: liczba fiszek do powtórki.
   Strona główna: grupa „Na dziś” nad listą przedmiotów.
   Strona przedmiotu: licznik przy wierszu „Fiszki”.
   Wymaga: srs.js, cards-index.js. data-root = ścieżka do katalogu głównego.
   ========================================================= */
(function () {
  "use strict";
  var SRS = window.SRS, IDX = window.STUDIA_INDEX || [];
  if (!SRS || !IDX.length) return;
  var me = document.currentScript, root = (me && me.dataset.root) || "";
  var here = (me && me.dataset.subject) || "";

  function pl(n) { return n === 1 ? "fiszka" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "fiszki" : "fiszek"); }
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  var decks = IDX.map(function (d) { var s = SRS.stats(d.ids); s.d = d; return s; });

  /* strona przedmiotu: licznik przy wierszu z fiszkami */
  if (here) {
    decks.filter(function (s) { return s.d.dir === here; }).forEach(function (s) {
      var file = s.d.href.split("/").pop();
      var a = document.querySelector('.ios-list a.row[href="' + file + '"]');
      if (!a) return;
      var sub = a.querySelector(".s");
      if (sub) sub.textContent = (s.due ? "Na dziś: " + s.due : "Na dziś gotowe") + " · opanowane " + s.mastered + " z " + s.total;
      if (s.due) {
        var b = document.createElement("span");
        b.className = "badge"; b.textContent = s.due; b.setAttribute("aria-label", s.due + " do powtórki");
        a.appendChild(b);
      }
    });
    return;
  }

  /* strona główna: grupa „Na dziś” */
  var main = document.querySelector("main");
  if (!main) return;
  var total = 0, rows = "";
  decks.forEach(function (s) {
    total += s.due;
    if (!s.due) return;
    var h = s.d.hsl;
    rows += '<li style="--sh:' + h[0] + ';--ss:' + h[1] + '%;--sl:' + h[2] + '%"><a class="row" href="' + root + s.d.href + '">' +
      '<span class="ic">' + ICON + '</span><span class="tx"><span class="t">' + s.d.name + '</span>' +
      '<span class="s">' + s.due + " " + pl(s.due) + " do powtórki</span></span>" +
      '<span class="badge">' + s.due + "</span></a></li>";
  });
  if (!total) {
    var next = decks.map(function (s) { return s.next; }).filter(Boolean).sort()[0];
    rows = '<li style="--sh:150;--ss:30%;--sl:40%"><span class="row empty"><span class="ic">' + CHECK + '</span>' +
      '<span class="tx"><span class="t">Na dziś wszystko powtórzone</span>' +
      '<span class="s">' + (next ? "Następna powtórka: " + SRS.label(next) : "Brak zaplanowanych powtórek") + "</span></span></span></li>";
  }
  var g = document.createElement("section");
  g.className = "group";
  g.innerHTML = '<h2>Na dziś' + (total ? " · " + total : "") + '</h2><ul class="ios-list">' + rows + "</ul>";
  main.insertBefore(g, main.firstChild);
})();
