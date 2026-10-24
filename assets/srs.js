/* =========================================================
   Studia — powtórki rozłożone w czasie (system pudełek Leitnera)
   Fiszka „umiem” wraca po 1, 3, 7, 14, a potem co 30 dni.
   Fiszka „jeszcze raz” wraca na początek (dziś).
   Nowych fiszek: najwyżej NEW_PER_DAY dziennie z jednej talii.
   Zapis w localStorage — osobno na każdym urządzeniu.
   ========================================================= */
(function () {
  "use strict";
  var KEY = "studia-srs-v1";
  var STEPS = [1, 3, 7, 14, 30];          // dni do kolejnej powtórki po pudełkach 1…5
  var NEW_PER_DAY = 10;
  var MASTERED_BOX = 3;                   // po przejściu powtórki 7-dniowej

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function addDays(dateStr, n) {
    var p = dateStr.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n); return iso(d);
  }

  var mem = null;
  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { mem = null; }
    if (!mem || typeof mem !== "object") mem = {};
    mem.cards = mem.cards || {};
    mem.intro = mem.intro || {};
    return mem;
  }
  function save() {
    // sprzątanie starych liczników nowych fiszek
    var t = today();
    Object.keys(mem.intro).forEach(function (k) { if (k < addDays(t, -7)) delete mem.intro[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {}
  }

  function deckOf(id) { return id.split(":")[0]; }
  function get(id) { return load().cards[id] || null; }
  function isNew(id) { return !get(id); }
  function isDue(id) { var c = get(id); return !!c && c.d <= today(); }
  function introducedToday(deck) { var i = load().intro[today()]; return (i && i[deck]) || 0; }

  /* ocena: ok = „Umiem”, !ok = „Jeszcze raz” */
  function grade(id, ok) {
    var m = load(), c = m.cards[id], t = today();
    if (!c) {
      c = m.cards[id] = { b: 0, d: t, n: 0 };
      var day = m.intro[t] = m.intro[t] || {};
      day[deckOf(id)] = (day[deckOf(id)] || 0) + 1;
    }
    c.n = (c.n || 0) + 1;
    c.last = t;
    if (ok) {
      c.b = Math.min((c.b || 0) + 1, STEPS.length);
      c.d = addDays(t, STEPS[c.b - 1]);
    } else {
      c.b = 0;
      c.d = t;
    }
    save();
    return c;
  }

  /* lista na dziś dla talii: zaległe powtórki + limit nowych */
  function dueList(ids, opts) {
    opts = opts || {};
    var limit = opts.newLimit == null ? NEW_PER_DAY : opts.newLimit;
    var deck = ids.length ? deckOf(ids[0]) : "";
    var room = Math.max(0, limit - introducedToday(deck));
    var due = [], fresh = [];
    ids.forEach(function (id) {
      if (isNew(id)) { if (fresh.length < room) fresh.push(id); }
      else if (isDue(id)) due.push(id);
    });
    // najpierw zaległe (od najdawniej zaplanowanych), potem nowe
    due.sort(function (a, b) { return get(a).d < get(b).d ? -1 : 1; });
    return due.concat(fresh);
  }

  /* tylko powtórki (fiszki już widziane), bez nowych — nowe przychodzą z czytania notatek */
  function reviewList(ids) {
    var due = ids.filter(function (id) { return !isNew(id) && isDue(id); });
    due.sort(function (a, b) { return get(a).d < get(b).d ? -1 : 1; });
    return due;
  }

  function stats(ids) {
    var mastered = 0, seen = 0, next = null, t = today();
    ids.forEach(function (id) {
      var c = get(id);
      if (!c) return;
      seen++;
      if (c.b >= MASTERED_BOX) mastered++;
      if (c.d > t && (!next || c.d < next)) next = c.d;
    });
    return { total: ids.length, seen: seen, mastered: mastered, due: dueList(ids).length, next: next };
  }

  function label(dateStr) {
    if (!dateStr) return "";
    var t = today();
    if (dateStr <= t) return "dziś";
    if (dateStr === addDays(t, 1)) return "jutro";
    if (dateStr === addDays(t, 2)) return "pojutrze";
    var p = dateStr.split("-");
    return +p[2] + "." + p[1];
  }

  window.SRS = {
    today: today, grade: grade, get: get, isNew: isNew, isDue: isDue,
    dueList: dueList, reviewList: reviewList, stats: stats, label: label, steps: STEPS.slice(), newPerDay: NEW_PER_DAY, masteredBox: MASTERED_BOX
  };
})();
