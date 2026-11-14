/* =========================================================
   Studia — tryb sesji: wykład jako ciąg ekranów zamiast przewijanej strony.
   Dzieli <main> na ekrany: okładka → dla każdej sekcji (h2): ekran otwierający,
   po jednym ekranie na część (details.sec / blok treści), ekran sprawdzenia.
   Treści nie zmienia. Przełącznik „Strona” wraca do zwykłego widoku.
   Postęp i wybór widoku: localStorage (studia-sesja*).
   ========================================================= */
(function () {
  "use strict";
  var main = document.querySelector("main"), page = document.querySelector(".page");
  if (!main || !page || page.classList.contains("hub")) return;
  if (main.querySelectorAll(":scope > h2").length < 2 || !main.querySelector(".tldr, details.sec")) return;
  var KEY = "studia-sesja", POS = KEY + ":" + location.pathname, on = true;
  try { on = localStorage.getItem(KEY) !== "0"; } catch (e) {}
  var hero = page.querySelector("header.hero");
  function setMode(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} location.reload(); }
  if (!on) {
    var links = hero && hero.querySelector(".links");
    if (links) { var b0 = document.createElement("button"); b0.className = "btn"; b0.type = "button"; b0.textContent = "Tryb sesji"; b0.onclick = function () { setMode(true); }; links.appendChild(b0); }
    return;
  }
  document.documentElement.classList.add("ss");
  /* ekrany liczymy dopiero, gdy krój pisma jest wczytany (od niego zależy wysokość tekstu) */
  function go() { try { run(); } catch (e) { if (window.console) console.error(e); } document.documentElement.classList.add("ss-ready"); }
  var fr = window.document.fonts && document.fonts.ready;
  if (fr) { var done = false, once = function () { if (!done) { done = true; go(); } }; fr.then(once); setTimeout(once, 1200); } else go();
  function run() {

  function mk(cls) {
    var s = document.createElement("section"); s.className = "ss-screen " + cls; s.hidden = true;
    var i = document.createElement("div"); i.className = "ss-in"; s.appendChild(i); return s;
  }
  function words(el) { return (el.textContent || "").trim().split(/\s+/).length; }
  function pl(n, a, b, c) { return n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c); }

  /* typ ekranu: stały układ i etykieta dla definicji, zestawień, wykresów, przykładów */
  function classify(s) {
    var kind = s.querySelector(".def") ? "Definicja" : s.querySelector("table") ? "Zestawienie" :
      s.querySelector("svg, .fig") ? "Wykres" : s.querySelector(".ex, .script") ? "Przykład" : "";
    if (kind) { s.setAttribute("data-kind", kind); var k = document.createElement("p"); k.className = "ss-kind"; k.textContent = kind; s.firstChild.insertBefore(k, s.firstChild.firstChild); }
    var key = s.querySelector(".body strong, .ss-in > p strong, .def strong, li strong");
    if (key) key.classList.add("ss-key");               // jedno kluczowe pojęcie w kolorze przedmiotu
  }

  var screens = [], secs = [], cur = null, buf = null, tail = mk("ss-end");
  function push(el) { screens.push({ el: el, sec: cur ? cur.i : -1 }); }
  function flush() { if (buf && buf.firstChild.childNodes.length) { classify(buf); push(buf); } buf = null; }

  var cover = mk("ss-cover");
  if (hero) cover.firstChild.appendChild(hero);
  push(cover);

  Array.prototype.slice.call(main.children).forEach(function (el) {
    if (/^(SCRIPT|STYLE)$/.test(el.tagName)) return;
    if (el.tagName === "H2") {
      flush();
      cur = { i: secs.length, words: 0, start: screens.length, n: 0 }; secs.push(cur);
      var op = mk("ss-open"), num = document.createElement("p");
      num.className = "ss-num"; num.textContent = (cur.i + 1 < 10 ? "0" : "") + (cur.i + 1);
      op.firstChild.appendChild(num); op.firstChild.appendChild(el);
      cur.op = op; push(op); return;
    }
    if (el.classList.contains("st-pager") || el.tagName === "FOOTER" || (el.classList.contains("st-check") && el.classList.contains("unit"))) { tail.firstChild.appendChild(el); return; }
    if (cur) cur.words += words(el);
    if (cur && el.classList.contains("tldr") && !cur.lead) { cur.op.firstChild.appendChild(el); cur.lead = true; return; }
    if (el.tagName === "DETAILS") {
      flush(); el.open = true;
      var s = mk("ss-part"); s.firstChild.appendChild(el); classify(s); push(s); if (cur) cur.n++; return;
    }
    if (el.classList.contains("st-check")) {
      flush();
      var c = mk("ss-check"), h = document.createElement("p");
      h.className = "ss-done"; h.textContent = "Koniec sekcji " + (cur ? cur.i + 1 : "");
      c.firstChild.appendChild(h); c.firstChild.appendChild(el); push(c); return;
    }
    if (!buf) { buf = mk("ss-part"); if (cur) cur.n++; }
    buf.firstChild.appendChild(el);
  });
  flush();
  var saveCur = cur; cur = null;
  if (tail.firstChild.childNodes.length) {
    var t = document.createElement("p"); t.className = "ss-done"; t.textContent = "Koniec wykładu";
    tail.firstChild.insertBefore(t, tail.firstChild.firstChild); push(tail);
  }
  secs.forEach(function (s, i) {
    s.end = (secs[i + 1] ? secs[i + 1].start : screens.length - (tail.firstChild.childNodes.length ? 1 : 0)) - 1;
    var m = document.createElement("p"); m.className = "ss-meta";
    var min = Math.max(1, Math.round(s.words / 180));
    m.textContent = "ok. " + min + " min · " + s.n + " " + pl(s.n, "część", "części", "części");
    s.op.firstChild.appendChild(m);
  });
  var total = Math.max(1, Math.round(secs.reduce(function (a, s) { return a + s.words; }, 0) / 180));
  var start = document.createElement("p"); start.className = "ss-meta";
  start.textContent = secs.length + " " + pl(secs.length, "sekcja", "sekcje", "sekcji") + " · ok. " + total + " min czytania";
  cover.firstChild.appendChild(start);
  screens.forEach(function (s) { main.appendChild(s.el); });

  /* za długi ekran dzielimy na kolejne (nic nie ma się przewijać w dół) */
  (function () {
    var lim = window.innerHeight - 215;
    for (var k = 0; k < screens.length; k++) {
      var el = screens[k].el;
      if (!el.classList.contains("ss-part")) continue;
      var box = el.firstChild, det = el.querySelector("details"), cont = (det && det.querySelector(".body")) || box, moved = [];
      el.hidden = false;
      while (box.offsetHeight > lim && cont.children.length > 1) moved.unshift(cont.removeChild(cont.lastElementChild));
      while (moved.length && cont.children.length > 1 && /^H[3-6]$/.test(cont.lastElementChild.tagName)) moved.unshift(cont.removeChild(cont.lastElementChild));
      if (cont.querySelectorAll(":scope > :not(.ss-kind)").length === 1 && box.offsetHeight > lim) {        // jedna wielka tabela: dzielimy po wierszach
        var blk = cont.firstElementChild, tb = blk.matches("table") ? blk : blk.querySelector("table"), body = tb && tb.tBodies[0];
        if (body && body.rows.length > 3) {
          var rows = [];
          while (box.offsetHeight > lim && body.rows.length > 2) rows.unshift(body.removeChild(body.rows[body.rows.length - 1]));
          if (rows.length) {
            var cl = blk.cloneNode(true), cb = (cl.matches("table") ? cl : cl.querySelector("table")).tBodies[0];
            while (cb.rows.length) cb.removeChild(cb.rows[0]);
            rows.forEach(function (r) { cb.appendChild(r); });
            moved.unshift(cl);
          }
        }
      }
      if (cont.querySelectorAll(":scope > :not(.ss-kind)").length === 1 && box.offsetHeight > lim && /^[UO]L$/.test(cont.querySelector(":scope > :not(.ss-kind)").tagName)) {   // jedna długa lista
        var ul = cont.querySelector(":scope > :not(.ss-kind)"), its = [];
        while (box.offsetHeight > lim && ul.children.length > 2) its.unshift(ul.removeChild(ul.lastElementChild));
        if (its.length) {
          var l2 = ul.cloneNode(false); l2.removeAttribute("id");
          if (ul.tagName === "OL") l2.start = (+ul.getAttribute("start") || 1) + ul.children.length;
          its.forEach(function (x) { l2.appendChild(x); });
          moved.unshift(l2);
        }
      }
      el.hidden = true;
      if (!moved.length) continue;
      var n = mk("ss-part ss-cont"), h = document.createElement("p");
      var sm = det && det.querySelector("summary"), ttl = "";
      if (sm) { var c = sm.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll(".src"), function (x) { x.remove(); }); ttl = c.textContent.replace(/\s+/g, " ").trim(); }
      h.className = "ss-kind"; h.textContent = "cd." + (ttl ? " · " + ttl : "");
      n.firstChild.appendChild(h);
      moved.forEach(function (x) { n.firstChild.appendChild(x); });
      main.insertBefore(n, el.nextSibling);
      screens.splice(k + 1, 0, { el: n, sec: screens[k].sec });
    }
    secs.forEach(function (s, i) {
      var f = -1, l = -1;
      screens.forEach(function (x, j) { if (x.sec === i) { if (f < 0) f = j; l = j; } });
      s.start = f; s.end = l;
    });
  })();

  /* ---------- pasek postępu: jeden segment na sekcję ---------- */
  var bar = document.createElement("div"); bar.className = "ss-bar";
  bar.innerHTML = '<div class="ss-segs">' + secs.map(function (s, i) { return '<button type="button" data-s="' + i + '" aria-label="Sekcja ' + (i + 1) + '"><i></i></button>'; }).join("") + "</div>" +
    '<div class="ss-row"><span class="ss-where"></span><span class="ss-time" title="Czas sesji">0:00</span><button type="button" class="ss-mode">Strona</button></div>';
  page.insertBefore(bar, page.firstChild);
  var nav = document.createElement("div"); nav.className = "ss-nav";
  nav.innerHTML = '<button type="button" class="ss-prev" aria-label="Wstecz">←</button><button type="button" class="ss-next">Dalej →</button>';
  document.body.appendChild(nav);
  var where = bar.querySelector(".ss-where"), segs = bar.querySelectorAll(".ss-segs button"), next = nav.querySelector(".ss-next"), prev = nav.querySelector(".ss-prev");

  var at = -1;
  function show(i, keepScroll) {
    i = Math.max(0, Math.min(screens.length - 1, i));
    if (i === at) return;
    if (at >= 0) screens[at].el.hidden = true;
    at = i; var sc = screens[i]; sc.el.hidden = false;
    document.documentElement.classList.toggle("ss-on-color", sc.el.classList.contains("ss-open") || sc.el.classList.contains("ss-cover"));
    Array.prototype.forEach.call(segs, function (b, k) {
      var s = secs[k], f = i > s.end ? 1 : i < s.start ? 0 : (i - s.start + 1) / (s.end - s.start + 1);
      b.firstChild.style.width = (100 * f) + "%"; b.classList.toggle("cur", k === sc.sec);
    });
    var s = secs[sc.sec];
    where.textContent = s ? "Sekcja " + (sc.sec + 1) + " z " + secs.length + " · ekran " + (i - s.start + 1) + " z " + (s.end - s.start + 1) : (i < (secs[0] ? secs[0].start : 1) ? "Początek" : "Koniec");
    prev.disabled = i === 0; next.disabled = i === screens.length - 1;
    next.textContent = i === 0 ? "Zacznij →" : (s && i === s.end && secs[sc.sec + 1] ? "Następna sekcja →" : "Dalej →");
    if (!keepScroll) window.scrollTo(0, 0);
    try { localStorage.setItem(POS, String(i)); } catch (e) {}
  }
  function screenOf(el) { var s = el && el.closest(".ss-screen"); for (var k = 0; k < screens.length; k++) if (screens[k].el === s) return k; return -1; }

  nav.addEventListener("click", function (e) { if (e.target === next) show(at + 1); else if (e.target === prev) show(at - 1); });
  bar.addEventListener("click", function (e) {
    var b = e.target.closest("[data-s]"); if (b) return show(secs[+b.getAttribute("data-s")].start);
    if (e.target.classList.contains("ss-mode")) setMode(false);
  });
  document.addEventListener("keydown", function (e) {
    if (document.body.classList.contains("st-locked") || /INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
    if (e.key === "ArrowRight") show(at + 1); else if (e.key === "ArrowLeft") show(at - 1);
  });
  var tx = 0, ty = 0;
  main.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  main.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 40 && !e.target.closest(".tbl, table")) show(at + (dx < 0 ? 1 : -1));
  }, { passive: true });
  /* linki do kotwic i lektor: pokaż ekran, na którym leży cel */
  function goHash() { var el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))); var k = screenOf(el); if (k >= 0) show(k); return k >= 0; }
  window.addEventListener("hashchange", goHash);
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { if (m.target.classList && m.target.classList.contains("is-active")) { var k = screenOf(m.target); if (k >= 0 && k !== at) show(k, true); } });
  }).observe(main, { attributes: true, attributeFilter: ["class"], subtree: true });

  /* czas sesji (liczy tylko, gdy karta jest widoczna) */
  var sec = 0, tm = bar.querySelector(".ss-time");
  setInterval(function () { if (document.hidden) return; sec++; tm.textContent = Math.floor(sec / 60) + ":" + (sec % 60 < 10 ? "0" : "") + (sec % 60); }, 1000);

  var saved = 0; try { saved = +localStorage.getItem(POS) || 0; } catch (e) {}
  if (!goHash()) show(saved);
  }
})();
