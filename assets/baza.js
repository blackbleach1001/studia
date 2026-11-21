/* =========================================================
   Studia — baza pytań egzaminacyjnych (jednokrotny wybór + pytania otwarte).
   Dane: <script type="application/json" id="baza-data"> { dir, title, groups:[{id,t,s}], items:[…] }
     item: { id, n, g, q, a:[…], c, e, f?, z? }   albo pytanie otwarte: { id, n, g, q, open }
     f — uwaga do odpowiedzi (np. „niepewne”), z — w bazie grupy zaznaczono inną odpowiedź
   Strona: <main id="baza">.
   Postęp: localStorage studia-baza-v1 (osobno na każdym urządzeniu).
   ========================================================= */
(function () {
  "use strict";
  var el = document.getElementById("baza"), src = document.getElementById("baza-data");
  if (!el || !src) return;
  var D = JSON.parse(src.textContent), ITEMS = D.items, byId = {};
  ITEMS.forEach(function (x) { byId[x.id] = x; });
  el.classList.add("st-deck");

  var KEY = "studia-baza-v1", LETTERS = "ABCDEF";
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
  var mine = store[D.dir] = store[D.dir] || {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function rec(id, ok) {
    var r = mine[id] = mine[id] || [0, 0, 0];
    r[ok ? 0 : 1] += 1; r[2] = ok ? 1 : -1; save();
  }
  function isWrong(id) { return mine[id] && mine[id][2] === -1; }
  function isOk(id) { return mine[id] && mine[id][2] === 1; }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plq(n) { return n === 1 ? "pytanie" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "pytania" : "pytań"); }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function num(x) { return x.n ? "nr " + x.n : ""; }
  function groupOf(x) { for (var i = 0; i < D.groups.length; i++) if (D.groups[i].id === x.g) return D.groups[i]; return null; }

  /* ---------- ustawienia ---------- */
  var pick = {}, LENS = [10, 20, 0], pickLen = 20, onlyWrong = false;
  D.groups.forEach(function (g) { pick[g.id] = true; });
  try { var saved = JSON.parse(localStorage.getItem(KEY + ":ui:" + D.dir) || "null"); if (saved) { pick = saved.pick || pick; pickLen = saved.len != null ? saved.len : pickLen; } } catch (e) {}
  function saveUi() { try { localStorage.setItem(KEY + ":ui:" + D.dir, JSON.stringify({ pick: pick, len: pickLen })); } catch (e) {} }

  function pool() {
    return ITEMS.filter(function (x) { return pick[x.g] && (!onlyWrong || isWrong(x.id)); });
  }

  function setup() {
    var all = ITEMS.length, okN = ITEMS.filter(function (x) { return isOk(x.id); }).length;
    var wrongN = ITEMS.filter(function (x) { return pick[x.g] && isWrong(x.id); }).length;
    var html = '<div class="st-deck-head"><div class="st-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + all +
      '" aria-valuenow="' + okN + '" aria-label="Opanowane ' + okN + ' z ' + all + '"><span style="width:' + (100 * okN / Math.max(1, all)) + '%"></span></div>' +
      '<p class="st-deck-stat">Ostatnio dobrze: <strong>' + okN + "</strong> z " + all + "</p></div>";
    if (D.groups.length > 1) {
      html += '<p class="st-test-h">Zakres</p><div class="st-scopes" role="group" aria-label="Zakres">';
      D.groups.forEach(function (g) {
        var ids = ITEMS.filter(function (x) { return x.g === g.id; });
        var ok = ids.filter(function (x) { return isOk(x.id); }).length;
        html += '<button type="button" class="st-scope" role="checkbox" aria-checked="' + !!pick[g.id] + '" data-g="' + esc(g.id) + '">' +
          '<span class="t">' + esc(g.t) + "</span>" +
          '<span class="s">' + (g.s ? esc(g.s) + " · " : "") + ids.length + " " + plq(ids.length) + (ok ? " · dobrze " + ok : "") + "</span></button>";
      });
      html += "</div>";
    }
    var total = pool().length;
    html += '<p class="st-test-h">Liczba pytań</p><div class="st-seg" role="group" aria-label="Liczba pytań">';
    LENS.forEach(function (n) {
      if (n && n >= total) return;
      html += '<button type="button" data-len="' + n + '" aria-pressed="' + (n === pickLen || (!n && pickLen >= total)) + '">' + (n || "Wszystkie (" + total + ")") + "</button>";
    });
    html += "</div>";
    html += '<div class="st-fcard-actions">' +
      (wrongN ? '<button class="st-btn" type="button" data-wrong>Tylko błędne (' + wrongN + ")</button>" : "") +
      '<button class="st-btn primary wide" type="button" data-start' + (total ? "" : " disabled") + ">Zacznij</button></div>";
    el.innerHTML = html;
  }

  /* ---------- quiz ---------- */
  var queue = [], at = 0, score = 0, wrong = [], answered = false, order = null, opened = false;

  function start(list) {
    queue = list; at = 0; score = 0; wrong = []; show();
  }
  function begin(only) {
    onlyWrong = !!only;
    var p = shuffled(pool());
    if (!onlyWrong && pickLen && pickLen < p.length) p = p.slice(0, pickLen);
    onlyWrong = false;
    start(p);
  }

  function head() {
    return '<div class="st-deck-head"><div class="st-progress" aria-hidden="true"><span style="width:' +
      (100 * at / Math.max(1, queue.length)) + '%"></span></div></div>';
  }

  function show() {
    if (at >= queue.length) return done();
    var x = queue[at]; answered = false; opened = false;
    order = x.open ? null : shuffled(x.a.map(function (_, i) { return i; }));
    var g = groupOf(x);
    var top = '<p class="st-fcard-n"><span>Pytanie ' + (at + 1) + " z " + queue.length + "</span>" +
      '<span class="st-tag muted">' + esc([D.groups.length > 1 && g ? g.t.split(":")[0] : "", num(x)].filter(Boolean).join(" · ")) + "</span></p>" +
      '<h2 class="st-fcard-q">' + esc(x.q) + "</h2>";
    var body;
    if (x.open) {
      body = '<p class="st-fcard-hint">Pytanie otwarte. Odpowiedz z pamięci, potem sprawdź.</p>';
      el.innerHTML = head() + '<article class="st-fcard">' + top + body + "</article>" +
        '<div class="st-fcard-actions"><button class="st-btn primary wide" type="button" data-reveal>Pokaż odpowiedź</button></div>';
    } else {
      body = '<div class="st-opts" role="group" aria-label="Odpowiedzi">' + order.map(function (i, k) {
        return '<button type="button" class="st-opt" data-i="' + i + '"><span class="k">' + LETTERS[k] + "</span><span class=\"t\">" + esc(x.a[i]) + "</span></button>";
      }).join("") + "</div>";
      el.innerHTML = head() + '<article class="st-fcard">' + top + body + '<div class="st-fb" aria-live="polite"></div></article>' +
        '<div class="st-fcard-actions"></div>';
    }
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 70));
  }

  function choose(i) {
    if (answered) return;
    answered = true;
    var x = queue[at], ok = i === x.c;
    if (ok) score += 1; else wrong.push(x.id);
    rec(x.id, ok);
    Array.prototype.forEach.call(el.querySelectorAll(".st-opt"), function (b) {
      var j = +b.getAttribute("data-i");
      b.disabled = true;
      if (j === x.c) b.classList.add("ok");
      else if (j === i) b.classList.add("bad");
      else b.classList.add("dim");
    });
    var fb = '<p class="st-fb-t ' + (ok ? "ok" : "bad") + '">' + (ok ? "Dobrze." : "Poprawna odpowiedź: " + esc(x.a[x.c]) + ".") + "</p>" +
      (x.e ? '<p class="st-fb-e">' + esc(x.e) + "</p>" : "") + notes(x);
    el.querySelector(".st-fb").innerHTML = fb;
    el.querySelector(".st-fcard-actions").innerHTML = '<button class="st-btn primary wide" type="button" data-next>' + (at + 1 < queue.length ? "Dalej" : "Wynik") + "</button>";
    el.querySelector("[data-next]").focus({ preventScroll: true });
  }
  function notes(x) {
    var n = [];
    if (x.f === "niepewne") n.push("Odpowiedź niepewna: pytanie jest niejednoznaczne albo źródła się różnią. Warto zapytać prowadzącą.");
    else if (x.f) n.push("Uwaga: " + x.f + ".");
    if (x.z) n.push("W bazie grupy zaznaczona była inna odpowiedź.");
    return n.length ? '<p class="st-fb-n">' + n.map(esc).join(" ") + "</p>" : "";
  }
  function reveal() {
    var x = queue[at]; opened = true;
    var art = el.querySelector(".st-fcard");
    art.querySelector(".st-fcard-hint").outerHTML = '<div class="st-fcard-a" tabindex="-1"><p>' + esc(x.open) + "</p></div>";
    el.querySelector(".st-fcard-actions").innerHTML =
      '<button class="st-btn" type="button" data-self="0">Jeszcze nie</button><button class="st-btn primary" type="button" data-self="1">Umiem</button>';
  }
  function self(ok) {
    var x = queue[at];
    if (ok) score += 1; else wrong.push(x.id);
    rec(x.id, ok); at += 1; show();
  }

  function done() {
    var pct = Math.round(100 * score / Math.max(1, queue.length));
    var html = '<div class="st-done"><p class="st-done-t">Wynik: ' + pct + "%</p><p>Dobrze: " + score + " z " + queue.length + ".</p>";
    if (wrong.length) {
      html += '<p class="st-miss-h">Do powtórki</p><ul class="st-wrong">' + wrong.map(function (id) {
        var x = byId[id];
        var g = groupOf(x), lab = [g && D.groups.length > 1 && g !== D.groups[0] ? g.t.split(":")[0] : "", num(x)].filter(Boolean).join(" · ");
        return "<li><b>" + esc(lab) + "</b> " + esc(x.q) + '<span class="a">' + esc(x.open || x.a[x.c]) + "</span></li>";
      }).join("") + "</ul>";
    }
    html += '<div class="st-deck-tools">' +
      (wrong.length ? '<button class="st-btn" type="button" data-retry>Powtórz błędne (' + wrong.length + ")</button>" : "") +
      '<button class="st-btn primary" type="button" data-again>Nowy test</button></div></div>';
    el.innerHTML = html;
    window.scrollTo(0, 0);
  }

  el.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || !el.contains(b)) return;
    if (b.hasAttribute("data-g")) {
      var g = b.getAttribute("data-g"); pick[g] = !pick[g];
      if (!D.groups.some(function (x) { return pick[x.id]; })) pick[g] = true;
      saveUi(); setup();
    } else if (b.hasAttribute("data-len")) { pickLen = +b.getAttribute("data-len"); saveUi(); setup(); }
    else if (b.hasAttribute("data-start")) begin(false);
    else if (b.hasAttribute("data-wrong")) begin(true);
    else if (b.classList.contains("st-opt")) choose(+b.getAttribute("data-i"));
    else if (b.hasAttribute("data-next")) { at += 1; show(); }
    else if (b.hasAttribute("data-reveal")) reveal();
    else if (b.hasAttribute("data-self")) self(b.getAttribute("data-self") === "1");
    else if (b.hasAttribute("data-retry")) start(shuffled(wrong.map(function (id) { return byId[id]; })));
    else if (b.hasAttribute("data-again")) setup();
  });
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
    var k = e.key.toLowerCase(), idx = "1234".indexOf(k) >= 0 ? "1234".indexOf(k) : "abcd".indexOf(k);
    if (!answered && order && idx >= 0 && idx < order.length && el.querySelector(".st-opt")) { e.preventDefault(); choose(order[idx]); }
    else if (k === "enter") {
      var n = el.querySelector("[data-next]") || (!opened && el.querySelector("[data-reveal]"));
      if (n) { e.preventDefault(); n.click(); }
    }
  });

  setup();
})();
