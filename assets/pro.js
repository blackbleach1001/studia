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
  /* nagłówek z postępem semestru · karta najbliższego zjazdu · terminy zaliczeń · przedmioty jako kafelki */
  var P = window.STUDIA_PLAN;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var iso = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var dt = function (s) { var a = s.split("-"); return new Date(+a[0], a[1] - 1, +a[2]); };
  var now = new Date(), today = iso(now);
  var diff = function (s) { return Math.round((dt(s) - dt(today)) / 864e5); };
  var WD = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  var WDS = ["nd.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];
  var MON = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  function rel(s) {
    var n = diff(s);
    return n === 0 ? "dziś" : n === 1 ? "jutro" : n === 2 ? "pojutrze" : n < 0 ? "" : n <= 13 ? "za " + n + " dni" : dt(s).getDate() + "." + pad(dt(s).getMonth() + 1);
  }
  function vars(d) { var h = P && P.meta[d] ? P.meta[d].hsl : [28, 22, 45]; return "--sh:" + h[0] + ";--ss:" + h[1] + "%;--sl:" + h[2] + "%"; }
  var hub = page, hero = hub.querySelector("header.hero"), plan = main.querySelector(".plan-home");
  /* kolejność: przedmioty → zjazd → terminy (wstawiane za listą przedmiotów) */
  var subjSec = (main.querySelector(".subjects") || {}).closest ? main.querySelector(".subjects").closest("section") : null;
  var anchor = subjSec || plan;
  function after(el) { if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(el, anchor.nextSibling); anchor = el; } else main.appendChild(el); }

  /* kafelki przedmiotów: ikona zamiast kropki */
  Array.prototype.forEach.call(document.querySelectorAll(".row.subj[data-subj]"), function (a) {
    var dot = a.querySelector(".dot"); if (!dot) return;
    var t = document.createElement("span"); t.className = "tile"; t.innerHTML = svg(a.getAttribute("data-subj"));
    dot.parentNode.replaceChild(t, dot);
  });
  hub.classList.add("hub-pro");

  /* --- 5. nagłówek: data i postęp semestru --- */
  var ses = P ? P.sessions.filter(function (x) { return !x.alt; }) : [];
  var zj = [];                                           // zjazdy = zajęcia w kolejnych dniach
  ses.map(function (x) { return x.date; }).filter(function (d, i, a) { return a.indexOf(d) === i; }).sort().forEach(function (d) {
    var g = zj[zj.length - 1];
    if (g && diff(d) - diff(g[g.length - 1]) <= 1) g.push(d); else zj.push([d]);
  });
  var zi = -1;
  for (var k = 0; k < zj.length; k++) if (zj[k][zj[k].length - 1] >= today) { zi = k; break; }
  if (hero) {
    var kick = document.createElement("p"); kick.className = "hp-kicker";
    kick.textContent = WD[now.getDay()] + ", " + now.getDate() + " " + MON[now.getMonth()];
    hero.insertBefore(kick, hero.firstChild);
    if (zj.length) {
      var doneN = zi < 0 ? zj.length : zi, curIn = zi >= 0 && zj[zi][0] <= today;
      var sem = document.createElement("div"); sem.className = "hp-sem";
      sem.innerHTML = '<div class="hp-seg" aria-hidden="true">' + zj.map(function (g, j) {
        return '<i class="' + (j < doneN ? "on" : j === zi ? (curIn ? "now on" : "next") : "") + '"></i>';
      }).join("") + "</div>" +
        '<p class="hp-sem-t">' + (zi < 0 ? "Wszystkie zjazdy za Tobą" : (curIn ? "Trwa zjazd " : "Przed Tobą zjazd ") + (zi + 1) + " z " + zj.length) + "</p>";
      var form = hero.querySelector("form.search");
      hero.insertBefore(sem, form);
    }
  }
  if (!P) return;

  /* --- 1. karta najbliższego zjazdu --- */
  if (zi >= 0) {
    var days = zj[zi], d0 = dt(days[0]), d1 = dt(days[days.length - 1]);
    var title = days.length > 1
      ? WDS[d0.getDay()] + " " + d0.getDate() + (d0.getMonth() !== d1.getMonth() ? " " + MON[d0.getMonth()] : "") + " – " + WDS[d1.getDay()] + " " + d1.getDate() + " " + MON[d1.getMonth()]
      : WD[d0.getDay()] + " " + d0.getDate() + " " + MON[d0.getMonth()];
    var n0 = diff(days[0]), when = n0 <= 0 ? "Trwa teraz" : n0 === 1 ? "Jutro" : "Za " + n0 + " dni";
    var rows = days.map(function (d) {
      var dd = dt(d);
      var list = ses.filter(function (x) { return x.date === d; }).map(function (x) {
        var m = P.meta[x.subj], kind = x.kind === "W" ? "wykład" : x.subj === "rozmowa" ? "zajęcia" : "ćwiczenia";
        var past = d === today && x.end && (pad(now.getHours()) + ":" + pad(now.getMinutes())) > x.end;
        var inner = '<span class="tm">' + esc(x.start || "") + "<small>" + esc(x.end || "") + '</small></span><span class="dot"></span>' +
          '<span class="tx"><b>' + esc(m.short) + ' <em>· ' + kind + " " + esc(String(x.n).replace(/^\D+/, "")) + "</em></b>" +
          '<span class="s">' + esc(x.topic || "") + (x.place ? " · " + esc(x.place === "online" ? "online" : x.place.replace("sala ", "")) : "") + "</span></span>";
        return '<li class="' + (past ? "is-past" : "") + '" style="' + vars(x.subj) + '">' + (x.href ? '<a href="' + esc(x.href) + '">' + inner + "</a>" : "<div>" + inner + "</div>") + "</li>";
      }).join("");
      return (days.length > 1 ? '<li class="hp-day">' + WD[dd.getDay()] + "</li>" : "") + list;
    }).join("");
    var card = document.createElement("section"); card.className = "hp-zjazd";
    card.innerHTML = '<p class="hp-label"><span>Najbliższy zjazd</span><b>' + when + "</b></p>" +
      '<h2 class="hp-date">' + esc(title) + "</h2>" +
      '<ol class="hp-tl">' + rows + "</ol>" +
      '<a class="hp-more" href="plan.html">Plan semestru<span aria-hidden="true">→</span></a>';
    after(card);
  }

  /* --- 2. terminy zaliczeń --- */
  var due = P.exams.filter(function (e) { return e.date >= today && (e.subj !== "rozmowa" || e.grp === "popa"); }).map(function (e) {
    var t = e.text, lab = t.split(/\s[–-]\s|:|\s·\s|\s\(/)[0].trim(), tm = /(\d)\.\s*termin/.exec(t);
    if (/^egzamin/i.test(lab)) { if (tm && tm[1] !== "1") return null; lab = "Egzamin"; }
    return { date: e.date, subj: e.subj, lab: lab };
  }).filter(Boolean);
  ses.forEach(function (x) { if (x.date >= today && /wyjściówk/i.test(x.topic || "")) due.push({ date: x.date, subj: x.subj, lab: "Wyjściówka" }); });
  due.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var soon = due.filter(function (e) { return diff(e.date) <= 45; });
  if (soon.length < 4) soon = due.slice(0, 4);
  if (soon.length) {
    var ds = document.createElement("section"); ds.className = "group hp-due";
    ds.innerHTML = '<h2>Do zaliczenia</h2><div class="hp-chips" role="list">' + soon.map(function (e) {
      var n = diff(e.date), lvl = n <= 3 ? "hot" : n <= 7 ? "warm" : "";
      return '<a role="listitem" class="hp-chip ' + lvl + '" style="' + vars(e.subj) + '" href="plan.html?p=' + esc(e.subj) + '#przedmioty">' +
        '<span class="w">' + esc(rel(e.date)) + "</span><b>" + esc(e.lab) + "</b><span class=\"sj\"><i></i>" + esc(P.meta[e.subj].short) + "</span></a>";
    }).join("") + "</div>";
    after(ds);
  }

  /* --- 4. kafelki przedmiotów: bez licznika bazy (sam przedmiot i najbliższy termin) --- */
  var NB = window.STUDIA_BAZA_N || {}, baza = {};
  try { baza = JSON.parse(localStorage.getItem("studia-baza-v1") || "{}") || {}; } catch (e) {}
  Array.prototype.forEach.call(document.querySelectorAll(".row.subj[data-subj]"), function (a) {
    var d = a.getAttribute("data-subj"), m = a.querySelector(".m");
    if (m) Array.prototype.forEach.call(m.querySelectorAll("span"), function (c) { if (/^Baza /.test(c.textContent)) c.remove(); });
    if (m && !m.children.length) m.hidden = true;
  });
})();

/* ---------- strona główna na telefonie: mniej przewijania ----------
   „Czytaj dalej” i „Do zaliczenia” obok siebie (pół na pół),
   najbliższy zjazd jako wysuwany panel z prawej krawędzi. */
(function () {
  "use strict";
  var page = document.querySelector(".hub-pro"); if (!page) return;
  var main = page.querySelector("main");
  var resume = main.querySelector(".group.resume"), due = main.querySelector(".group.hp-due"), zj = main.querySelector(".hp-zjazd");
  var subjSec = main.querySelector(".subjects") ? main.querySelector(".subjects").closest("section") : null;

  /* pół na pół */
  if (resume || due) {
    var duo = document.createElement("section"); duo.className = "hp-duo";
    if (resume) {
      var a = resume.querySelector("a.row");
      var r = document.createElement("a"); r.className = "hp-half"; r.href = a.getAttribute("href");
      r.setAttribute("style", resume.querySelector("li").getAttribute("style") || "");
      r.innerHTML = '<span class="hp-half-l">Czytaj dalej</span><b>' + a.querySelector(".t").innerHTML + '</b><span class="hp-half-s">' + a.querySelector(".s").innerHTML + "</span>";
      r.addEventListener("click", function () { try { sessionStorage.setItem("studia-resume", r.getAttribute("href")); } catch (e) {} });
      duo.appendChild(r); resume.remove();
    }
    if (due) {
      var chips = due.querySelectorAll(".hp-chip"), c0 = chips[0];
      var d = document.createElement("button"); d.type = "button"; d.className = "hp-half hp-half-due"; d.setAttribute("aria-expanded", "false");
      d.setAttribute("style", c0.getAttribute("style") || "");
      d.innerHTML = '<span class="hp-half-l">Do zaliczenia' + (chips.length > 1 ? ' <i>+' + (chips.length - 1) + "</i>" : "") + '</span><b>' + c0.querySelector("b").innerHTML +
        '</b><span class="hp-half-s"><i class="dt"></i>' + c0.querySelector(".sj").textContent + " · " + c0.querySelector(".w").textContent + "</span>";
      if (/\bhot\b|\bwarm\b/.test(c0.className)) d.classList.add(/\bhot\b/.test(c0.className) ? "hot" : "warm");
      duo.appendChild(d);
      due.classList.add("hp-due-more"); due.hidden = true;
      d.addEventListener("click", function () { due.hidden = !due.hidden; d.setAttribute("aria-expanded", String(!due.hidden)); });
    }
    if (!resume || !due) duo.classList.add("one");
    main.insertBefore(duo, subjSec || main.firstChild);
    if (due) main.insertBefore(due, subjSec || duo.nextSibling);
  }

  /* zjazd: przycisk pod kafelkami (w zasięgu kciuka), panel wysuwany od dołu */
  if (zj) {
    var lab = zj.querySelector(".hp-label b"), dte = zj.querySelector(".hp-date");
    var open = document.createElement("button"); open.type = "button"; open.className = "hp-zj-open"; open.setAttribute("aria-expanded", "false");
    open.innerHTML = '<span class="hp-zj-l">Najbliższy zjazd · ' + (lab ? lab.textContent.toLowerCase() : "") + "</span><b>" + (dte ? dte.textContent : "") + '</b><i aria-hidden="true"></i>';
    var bd = document.createElement("div"); bd.className = "hp-zj-bd";
    var x = document.createElement("button"); x.type = "button"; x.className = "hp-zj-x"; x.innerHTML = '<i aria-hidden="true"></i>Zwiń';
    zj.appendChild(x);
    (subjSec || main).after(open);
    document.body.appendChild(bd); page.appendChild(zj);
    function set(o) { document.documentElement.classList.toggle("zj-open", o); open.setAttribute("aria-expanded", String(o)); if (o) zj.scrollTop = 0; }
    open.addEventListener("click", function () { set(true); });
    bd.addEventListener("click", function () { set(false); });
    x.addEventListener("click", function () { set(false); });
    addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  }
})();
