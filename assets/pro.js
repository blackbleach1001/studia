/* Studia — wygląd „pro” (makieta): spis sekcji z boku, znak przedmiotu, najbliższy zjazd na stronie głównej. */
(function () {
  "use strict";
  var IC = {
    poznawcza: '<circle cx="9" cy="14" r="3.2"/><path d="M9 8.5v2.3M9 17.2v2.3M3.5 14h2.3M12.2 14h2.3M5.1 10.1l1.6 1.6M11.3 16.3l1.6 1.6M5.1 17.9l1.6-1.6M11.3 11.7l1.6-1.6"/><circle cx="17.5" cy="6.5" r="1.8"/><path d="M17.5 3v1.7M17.5 8.3V10M14 6.5h1.7M19.3 6.5H21"/>',
    metodologia: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6.5 14.5l3.5-4 3 2.5 4.5-5"/>',
    kliniczna: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M12 10.5v6M9 13.5h6"/>',
    rozmowa: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z"/>',
    praca: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    edukacja: '<path d="M4 20V10l8-5 8 5v10M9 20v-5h6v5M12 5V3M2 20h20"/><path d="M11 10.5h2"/>'
  };
  function svg(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[d] || "") + "</svg>"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var page = document.querySelector(".page"), main = document.querySelector("main");
  if (!page || !main) return;

  /* ---------- strona wykładu ---------- */
  if (!page.classList.contains("hub")) {
    var rd = document.querySelector('script[src*="reader.js"]');
    var dir = location.pathname.split("/").slice(-2)[0];
    var hero = page.querySelector("header.hero");
    if (hero && rd) {
      var k = document.createElement("p"); k.className = "pro-kicker";
      k.innerHTML = svg(dir) + "<span>" + esc((rd.dataset.backLabel || "") + " · " + (rd.dataset.title || "")) + "</span>";
      hero.insertBefore(k, hero.firstChild);
    }
    var hs = Array.prototype.slice.call(main.querySelectorAll(":scope > h2"));
    if (hs.length > 2) {
      var done = function (h) {           // sekcja sprawdzona: wszystkie jej pytania mają już ocenę
        var el = h.nextElementSibling, btn = null;
        while (el && el.tagName !== "H2") { btn = btn || (el.querySelector && el.querySelector("[data-check]")); el = el.nextElementSibling; }
        if (!btn || !window.SRS) return false;
        return btn.getAttribute("data-check").split(",").every(function (id) { return !!window.SRS.get(id); });
      };
      var nav = document.createElement("nav"); nav.className = "pro-toc"; nav.setAttribute("aria-label", "Sekcje");
      nav.innerHTML = "<p>Sekcje</p><ol>" + hs.map(function (h, i) {
        return '<li><a href="#' + esc(h.id) + '"><span class="n">' + (i + 1) + "</span><span>" + esc(h.textContent.trim()) + "</span>" +
          (done(h) ? '<span class="ok" title="Sprawdzone">✓</span>' : "") + "</a></li>";
      }).join("") + "</ol>";
      page.insertBefore(nav, main);
      var links = nav.querySelectorAll("a");
      var spy = function () {
        var cur = 0;
        hs.forEach(function (h, i) { if (h.getBoundingClientRect().top < 140) cur = i; });
        Array.prototype.forEach.call(links, function (a, i) { a.setAttribute("aria-current", i === cur); });
      };
      window.addEventListener("scroll", spy, { passive: true }); spy();
    }
    return;
  }

  /* ---------- strona główna ---------- */
  Array.prototype.forEach.call(document.querySelectorAll(".row.subj[data-subj]"), function (a) {
    var dot = a.querySelector(".dot"); if (!dot) return;
    var t = document.createElement("span"); t.className = "tile"; t.innerHTML = svg(a.getAttribute("data-subj"));
    dot.parentNode.replaceChild(t, dot);
  });
  var P = window.STUDIA_PLAN;
  if (!P) return;
  var now = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  var up = P.sessions.filter(function (x) { return !x.alt && x.date >= today; });
  if (!up.length) return;
  var first = up[0].date, lim = new Date(first); lim.setDate(lim.getDate() + 0);  /* tylko najbliższy dzień zajęć; reszta w Planie */
  var limS = lim.getFullYear() + "-" + pad(lim.getMonth() + 1) + "-" + pad(lim.getDate());
  var WD = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  var html = "", last = "";
  up.filter(function (x) { return x.date <= limS; }).forEach(function (x) {
    var m = P.meta[x.subj], d = new Date(x.date);
    if (x.date !== last) { html += '<li class="day">' + WD[d.getDay()] + " " + d.getDate() + "." + pad(d.getMonth() + 1) + "</li>"; last = x.date; }
    var inner = '<span class="tm">' + esc(x.start || "") + (x.end ? "–" + esc(x.end) : "") + '</span><span class="bar"></span><span><b>' +
      esc(m.short + " · " + (x.kind === "W" ? "wykład" : x.kind === "C" ? "ćwiczenia" : "zajęcia") + " " + String(x.n).replace(/^\D+/, "")) + '</b><span class="s">' +
      esc(x.topic || "") + (x.place === "online" ? " · online" : "") + "</span></span>";
    var st = 'style="--sh:' + m.hsl[0] + ";--ss:" + m.hsl[1] + "%;--sl:" + m.hsl[2] + '%"';
    html += "<li>" + (x.href ? '<a href="' + esc(x.href) + '" ' + st + ">" + inner + "</a>" : '<span class="ev" ' + st + ">" + inner + "</span>") + "</li>";
  });
  var sec = document.createElement("section"); sec.className = "group";
  sec.innerHTML = "<h2>Najbliższe zajęcia</h2><ul class=\"pro-week\">" + html + "</ul><p class=\"pro-more\"><a href=\"plan.html\">Cały zjazd i terminy w planie →</a></p>";
  var plan = main.querySelector(".plan-home");
  main.insertBefore(sec, plan ? plan.nextSibling : main.firstChild);
})();
