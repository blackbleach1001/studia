/* =========================================================
   Studia — plan semestru (plan.html). Dane: assets/plan-data.js (window.STUDIA_PLAN).
   Zakładki: Teraz (najbliższy zjazd, co zrobić, zaliczenia) · Kalendarz · Przedmioty.
   Filtr przedmiotu: ?p=<katalog>. Odhaczone zadania: localStorage studia-plan-v1
   (tylko w tej przeglądarce; stan wyjściowy — z Notion).
   ========================================================= */
(function () {
  "use strict";
  var D = window.STUDIA_PLAN, root = document.getElementById("plan");
  if (!D) return;
  var META = D.meta, KEY = "studia-plan-v1";

  /* ---------- daty ---------- */
  var WD = ["nd.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];
  var WDL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  var MON = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  var MONN = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function add(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function days(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  var NOW = new Date(), TODAY = iso(NOW);
  function short(s) { var d = parse(s); return WD[d.getDay()] + " " + d.getDate() + "." + pad(d.getMonth() + 1); }
  function long(s) { var d = parse(s); return WDL[d.getDay()] + ", " + d.getDate() + " " + MON[d.getMonth()]; }
  function rel(s) {
    var n = days(TODAY, s);
    if (n === 0) return "dziś";
    if (n === 1) return "jutro";
    if (n === 2) return "pojutrze";
    if (n > 0) return "za " + n + " dni";
    if (n === -1) return "wczoraj";
    return n + " dni temu";
  }
  function at(s, hm) { var d = parse(s), p = hm.split(":"); d.setHours(+p[0], +p[1]); return d; }
  function past(x) { return at(x.date, x.end) < NOW; }
  function live(x) { return at(x.date, x.start) <= NOW && NOW <= at(x.date, x.end); }

  /* ---------- pomocnicze ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function vars(dir) { var h = META[dir].hsl; return "--sh:" + h[0] + ";--ss:" + h[1] + "%;--sl:" + h[2] + "%"; }
  function kindName(x) {
    var n = x.n.replace(/\D/g, "");
    if (x.kind === "W") return "Wykład " + n;
    return (x.subj === "rozmowa" ? "Zajęcia " : "Ćwiczenia ") + n;
  }
  function pl(n, a, b, c) { return n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c); }
  var WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.5"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------- strona główna: wiersz „Plan semestru” z najbliższymi zajęciami ---------- */
  var homeRow = document.getElementById("plan-row");
  if (homeRow && !root) {
    var nx = D.sessions.filter(function (x) { return !past(x); })[0];
    var ne = D.exams.filter(function (e) { return e.date >= TODAY; })[0];
    var sub = homeRow.querySelector(".s");
    if (nx && sub) {
      sub.textContent = (live(nx) ? "Teraz: " : "Następne: " + short(nx.date) + ", " + nx.start + " · ") +
        META[nx.subj].short + " · " + kindName(nx).toLowerCase() + (nx.place === "online" ? " · online" : "") +
        (ne ? " · zaliczenie " + rel(ne.date) : "");
    }
    return;
  }
  if (!root) return;

  /* ---------- stan ---------- */
  var store = { done: {} };
  try { store = JSON.parse(localStorage.getItem(KEY) || "null") || store; store.done = store.done || {}; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function isDone(t) { return t.id in store.done ? store.done[t.id] : t.done; }

  var q = new URLSearchParams(location.search);
  var subj = META[q.get("p")] ? q.get("p") : "";
  var tab = /^#(kalendarz|przedmioty)$/.test(location.hash) ? location.hash.slice(1) : (subj ? "przedmioty" : "teraz");
  var openAll = {}, recent = {};          // recent: odhaczone teraz — zostają na liście (przekreślone)
  function on(x) { return !subj || x.subj === subj; }

  var SES = D.sessions, EX = D.exams, TASKS = D.tasks;
  var exByDay = {};
  EX.forEach(function (e) { (exByDay[e.date] = exByDay[e.date] || []).push(e); });
  function isFree(s) { return D.free.some(function (r) { return s >= r[0] && s <= r[1]; }); }

  /* zjazdy: zajęcia pogrupowane po weekendach (klucz = sobota) */
  function weekendOf(s) { var d = parse(s).getDay(); return d === 0 ? add(s, -1) : d === 6 ? s : add(s, 6 - d); }
  function zjazdy() {
    var by = {}, out = [];
    SES.filter(on).forEach(function (x) { var k = weekendOf(x.date); (by[k] = by[k] || []).push(x); });
    Object.keys(by).sort().forEach(function (k) { out.push({ key: k, items: by[k] }); });
    return out;
  }
  function mode(items) {
    var onl = items.filter(function (x) { return x.place === "online"; }).length;
    return onl === items.length ? "online" : onl ? "online i na uczelni" : "na uczelni";
  }

  /* ---------- kawałki widoku ---------- */
  function session(x, opts) {
    opts = opts || {};
    var exs = (exByDay[x.date] || []).filter(function (e) { return e.subj === x.subj; });
    var st = live(x) ? '<span class="pl-tag live">Teraz</span>' : past(x) ? '<span class="pl-tag done">Zakończone</span>' : "";
    var body = "";
    if (x.lit && x.lit.length) body += '<p class="pl-k">Literatura</p><ul class="pl-lit">' + x.lit.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>";
    if (x.note) body += '<p class="pl-warn">' + WARN + "<span>" + esc(x.note) + "</span></p>";
    if (x.href) body += '<a class="pl-link" href="' + esc(x.href) + '">Notatki: ' + esc(kindName(x)) + " →</a>";
    return '<li class="pl-ses' + (past(x) ? " is-past" : "") + '" style="' + vars(x.subj) + '">' +
      '<details' + (opts.open ? " open" : "") + '><summary>' +
        '<span class="pl-time">' + (opts.date ? '<b>' + esc(short(x.date)) + "</b>" : "") + esc(x.start) + "<i>" + esc(x.end) + "</i></span>" +
        '<span class="pl-main"><span class="pl-sub"><i class="dot"></i>' + esc(META[x.subj].short) + " · " + esc(kindName(x)) + "</span>" +
        '<span class="pl-topic">' + esc(x.topic || "Temat nie podany") + "</span>" +
        '<span class="pl-place">' + esc(x.place === "online" ? "Online" : x.place.replace("sala", "Sala")) + st +
          exs.map(function (e) { return '<span class="pl-tag ex">' + esc(e.type) + "</span>"; }).join("") + "</span></span>" +
      "</summary>" + (body ? '<div class="pl-more">' + body + "</div>" : "") + "</details></li>";
  }
  function exam(e) {
    var d = parse(e.date), n = days(TODAY, e.date);
    return '<li class="pl-ex' + (n < 0 ? " is-past" : "") + '" style="' + vars(e.subj) + '">' +
      '<span class="pl-day"><b>' + d.getDate() + "</b><i>" + MON[d.getMonth()].slice(0, 3) + "</i></span>" +
      '<span class="pl-main"><span class="pl-sub"><i class="dot"></i>' + esc(META[e.subj].short) + " · " + esc(e.type) + "</span>" +
      '<span class="pl-topic">' + esc(e.text) + "</span>" +
      '<span class="pl-place">' + esc(short(e.date)) + " · " + esc(rel(e.date)) + "</span>" +
      (e.flag ? '<span class="pl-warn">' + WARN + "<span>" + esc(e.flag) + "</span></span>" : "") + "</span></li>";
  }
  function task(t) {
    var d = isDone(t), n = days(TODAY, t.date);
    var when = n < 0 ? "termin minął " + short(t.date) : "do " + short(t.date) + (n <= 2 ? " · " + rel(t.date) : "");
    return '<li class="pl-task' + (d ? " is-done" : "") + (n < 0 && !d ? " is-late" : "") + '" style="' + vars(t.subj) + '">' +
      '<button type="button" class="pl-chk" data-task="' + t.id + '" aria-pressed="' + d + '" aria-label="' + (d ? "Odznacz: " : "Zrobione: ") + esc(t.title) + '">' + CHECK + "</button>" +
      '<span class="pl-main"><span class="pl-topic">' + esc(t.title) + "</span>" +
      '<span class="pl-sub"><i class="dot"></i>' + esc(META[t.subj].short) + " · " + esc(t.type) + " · <b>" + esc(when) + "</b></span>" +
      (t.lit ? '<span class="pl-place">' + esc(t.lit) + "</span>" : "") + "</span></li>";
  }
  function more(id, list, limit, fn, label) {
    if (list.length <= limit || openAll[id]) return list.map(fn).join("");
    return list.slice(0, limit).map(fn).join("") +
      '<li class="pl-more-row"><button type="button" data-all="' + id + '">' + esc(label) + " " + (list.length - limit) + "</button></li>";
  }

  /* ---------- Teraz ---------- */
  function viewNow() {
    var html = "";
    var zs = zjazdy(), next = zs.filter(function (z) { return z.items.some(function (x) { return !past(x); }); })[0];
    if (next) {
      var first = next.items[0].date, last = next.items[next.items.length - 1].date;
      var running = first <= TODAY;
      html += '<section class="pl-card next"><p class="pl-eyebrow">' + (running ? "Trwa zjazd" : "Najbliższy zjazd · " + esc(rel(first))) + "</p>" +
        "<h2>" + esc(first === last ? long(first) : short(first) + " – " + short(last)) + "</h2>" +
        '<p class="pl-meta">' + next.items.length + " " + pl(next.items.length, "zajęcia", "zajęcia", "zajęć") + " · " + esc(mode(next.items)) + "</p>";
      var byDay = {};
      next.items.forEach(function (x) { (byDay[x.date] = byDay[x.date] || []).push(x); });
      Object.keys(byDay).sort().forEach(function (d) {
        html += '<h3 class="pl-dayh">' + esc(long(d)) + (d === TODAY ? " · dziś" : "") + '</h3><ul class="pl-list">' +
          byDay[d].map(function (x) { return session(x, { open: !past(x) && x === next.items.filter(function (y) { return !past(y); })[0] }); }).join("") + "</ul>";
      });
      html += "</section>";
    }

    var open = TASKS.filter(function (t) { return on(t) && (!isDone(t) || recent[t.id]); });
    var late = open.filter(function (t) { return t.date < TODAY; });
    var week = open.filter(function (t) { return t.date >= TODAY && t.date <= add(TODAY, 6); });
    var later = open.filter(function (t) { return t.date > add(TODAY, 6); });
    var doneN = TASKS.filter(function (t) { return on(t) && isDone(t); }).length;
    html += '<section class="pl-sec"><h2>Do zrobienia</h2>';
    if (!open.some(function (t) { return !isDone(t); })) html += '<p class="pl-empty">Wszystko odhaczone.</p>';
    if (late.length) html += '<h3 class="pl-h3 late">Zaległe · ' + late.length + '</h3><ul class="pl-list">' + more("late", late, 4, task, "Pokaż jeszcze") + "</ul>";
    if (week.length) html += '<h3 class="pl-h3">Najbliższe 7 dni · ' + week.length + '</h3><ul class="pl-list">' + week.map(task).join("") + "</ul>";
    if (later.length) html += '<h3 class="pl-h3">Później</h3><ul class="pl-list">' + more("later", later, 3, task, "Pokaż jeszcze") + "</ul>";
    html += '<p class="pl-foot">Zrobione: ' + doneN + ". Zadania z „Planu nauki” w Notion; odhaczenia zapisują się w tej przeglądarce.</p></section>";

    var up = EX.filter(function (e) { return on(e) && e.date >= TODAY; });
    if (up.length) html += '<section class="pl-sec"><h2>Zaliczenia</h2><ul class="pl-list">' + more("ex", up, 4, exam, "Pokaż jeszcze") + "</ul></section>";
    return html;
  }

  /* ---------- Kalendarz ---------- */
  var MONTHS = (function () {
    var a = SES[0].date.slice(0, 7), b = SES[SES.length - 1].date.slice(0, 7), out = [];
    for (var m = a; m <= b;) { out.push(m); var y = +m.slice(0, 4), mo = +m.slice(5); mo++; if (mo > 12) { mo = 1; y++; } m = y + "-" + pad(mo); }
    return out;
  })();
  var month = TODAY.slice(0, 7);
  if (month < MONTHS[0]) month = MONTHS[0];
  if (month > MONTHS[MONTHS.length - 1]) month = MONTHS[MONTHS.length - 1];
  var picked = null;
  function defaultPick() {
    var n = SES.filter(function (x) { return on(x) && x.date >= TODAY; })[0];
    return n && n.date.slice(0, 7) === month ? (SES.some(function (x) { return on(x) && x.date === TODAY; }) ? TODAY : n.date) : month + "-01";
  }
  function viewCal() {
    if (!picked || picked.slice(0, 7) !== month) picked = defaultPick();
    var y = +month.slice(0, 4), m = +month.slice(5) - 1, first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7;
    var nd = new Date(y, m + 1, 0).getDate(), i = MONTHS.indexOf(month);
    var html = '<section class="pl-cal"><div class="pl-cal-h">' +
      '<button type="button" data-month="' + (MONTHS[i - 1] || "") + '"' + (i ? "" : " disabled") + ' aria-label="Poprzedni miesiąc">‹</button>' +
      "<h2>" + MONTHS_NAME(m) + " " + y + "</h2>" +
      '<button type="button" data-month="' + (MONTHS[i + 1] || "") + '"' + (i < MONTHS.length - 1 ? "" : " disabled") + ' aria-label="Następny miesiąc">›</button></div>' +
      '<div class="pl-grid" role="grid"><span>pn</span><span>wt</span><span>śr</span><span>cz</span><span>pt</span><span>sb</span><span>nd</span>';
    for (var k = 0; k < lead; k++) html += "<i></i>";
    for (var d = 1; d <= nd; d++) {
      var s = y + "-" + pad(m + 1) + "-" + pad(d);
      var ses = SES.filter(function (x) { return on(x) && x.date === s; });
      var ex = (exByDay[s] || []).filter(on);
      var subs = [];
      ses.forEach(function (x) { if (subs.indexOf(x.subj) < 0) subs.push(x.subj); });
      var label = long(s) + (ses.length ? ": " + ses.length + " " + pl(ses.length, "zajęcia", "zajęcia", "zajęć") : "") + (ex.length ? ", " + ex.length + " " + pl(ex.length, "zaliczenie", "zaliczenia", "zaliczeń") : "") + (isFree(s) ? ", wolne" : "");
      html += '<button type="button" data-day="' + s + '" class="' + [s === TODAY ? "today" : "", s === picked ? "sel" : "", isFree(s) ? "free" : "", s < TODAY ? "past" : "", ses.length ? "has" : ""].join(" ") + '" aria-label="' + esc(label) + '" aria-pressed="' + (s === picked) + '">' +
        "<b>" + d + "</b><span class=\"dots\">" + subs.slice(0, 3).map(function (x) { return '<i style="' + vars(x) + '"></i>'; }).join("") + (ex.length ? '<i class="exm"></i>' : "") + "</span></button>";
    }
    html += '</div><p class="pl-legend"><span><i class="lg-dot"></i>zajęcia</span><span><i class="lg-ex"></i>zaliczenie</span><span><i class="lg-free"></i>wolne</span></p></section>';

    var ses = SES.filter(function (x) { return on(x) && x.date === picked; });
    var ex = (exByDay[picked] || []).filter(on);
    var tk = TASKS.filter(function (t) { return on(t) && t.date === picked; });
    html += '<section class="pl-sec"><h2>' + esc(long(picked)) + "</h2>";
    if (isFree(picked)) html += '<p class="pl-meta">Wolny weekend · czas na powtórki i lektury</p>';
    if (!ses.length && !ex.length && !tk.length) html += '<p class="pl-empty">Nic zaplanowanego.</p>';
    if (ses.length) html += '<ul class="pl-list">' + ses.map(function (x) { return session(x); }).join("") + "</ul>";
    if (ex.length) html += '<h3 class="pl-h3">Zaliczenia</h3><ul class="pl-list">' + ex.map(exam).join("") + "</ul>";
    if (tk.length) html += '<h3 class="pl-h3">Do zrobienia na ten dzień</h3><ul class="pl-list">' + tk.map(task).join("") + "</ul>";
    html += "</section>";
    return html;
  }
  function MONTHS_NAME(m) { return MONN[m]; }

  /* ---------- Przedmioty ---------- */
  function viewSubj() {
    var html = "";
    Object.keys(D.subjects).filter(function (d) { return !subj || d === subj; }).forEach(function (d) {
      var s = D.subjects[d];
      html += '<section class="pl-card subj" style="' + vars(d) + '"><h2><i class="dot"></i>' + esc(s.name) + '</h2><p class="pl-meta">' + esc(s.meta) + "</p>";
      s.parts.forEach(function (p) {
        var items = SES.filter(function (x) { return x.subj === d && x.kind === p.kind; });
        html += '<h3 class="pl-h3">' + (p.kind === "W" ? "Wykłady" : (d === "rozmowa" ? "Zajęcia" : "Ćwiczenia")) + '</h3><p class="pl-who">' + esc(p.who) + '</p><ul class="pl-list">' +
          items.map(function (x) { return session(x, { date: true }); }).join("") + "</ul>";
        (p.general || []).forEach(function (g) {
          html += '<details class="pl-gen"><summary>' + esc(g.h) + "</summary><ul class=\"pl-lit\">" + g.items.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></details>";
        });
      });
      html += '<div class="pl-pass"><b>Zaliczenie</b><p>' + esc(s.pass) + "</p></div>" +
        '<a class="pl-link" href="' + d + '/">Notatki z przedmiotu →</a></section>';
    });
    return html;
  }

  /* ---------- całość ---------- */
  function render() {
    var chips = '<div class="pl-chips" role="group" aria-label="Przedmiot"><button type="button" data-subj="" aria-pressed="' + !subj + '">Wszystkie</button>' +
      Object.keys(D.subjects).map(function (d) {
        return '<button type="button" data-subj="' + d + '" aria-pressed="' + (subj === d) + '" style="' + vars(d) + '"><i class="dot"></i>' + esc(META[d].short) + "</button>";
      }).join("") + "</div>";
    var tabs = '<div class="st-seg pl-tabs" role="tablist">' + [["teraz", "Teraz"], ["kalendarz", "Kalendarz"], ["przedmioty", "Przedmioty"]].map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + "</button>";
    }).join("") + "</div>";
    var body = tab === "kalendarz" ? viewCal() : tab === "przedmioty" ? viewSubj() : viewNow();
    root.innerHTML = tabs + chips + body +
      '<footer class="pl-src"><p>Stan z Notion: ' + esc(D.synced.split("-").reverse().join(".")) + ". " + esc(D.source) + "</p></footer>";
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !root.contains(b)) return;
    if (b.dataset.tab) {
      tab = b.dataset.tab; render();
      try { history.replaceState(null, "", location.pathname + location.search + (tab === "teraz" ? "" : "#" + tab)); } catch (er) {}
    } else if (b.hasAttribute("data-subj")) {
      subj = b.dataset.subj; picked = null; render();
      try { history.replaceState(null, "", location.pathname + (subj ? "?p=" + subj : "") + location.hash); } catch (er) {}
    } else if (b.dataset.task) {
      var t = TASKS.filter(function (x) { return x.id === b.dataset.task; })[0];
      store.done[t.id] = !isDone(t); recent[t.id] = true; save(); render();
      var nb = root.querySelector('[data-task="' + t.id + '"]'); if (nb) nb.focus({ preventScroll: true });
    } else if (b.dataset.all) { openAll[b.dataset.all] = true; render(); }
    else if (b.hasAttribute("data-month") && b.dataset.month) { month = b.dataset.month; picked = null; render(); }
    else if (b.dataset.day) { picked = b.dataset.day; render(); var p = root.querySelector(".pl-cal + .pl-sec"); if (p && p.getBoundingClientRect().top > innerHeight * .7) p.scrollIntoView({ block: "start", behavior: "smooth" }); }
  });
  render();
})();
