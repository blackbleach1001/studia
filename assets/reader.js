/* =========================================================
   Studia — pasek czytania: Spis · Skupienie · Lektor
   Lektor = synteza mowy przeglądarki (polski głos systemowy).
   ========================================================= */
(function () {
  "use strict";
  var KEY = "studia-reader-v2";
  var S = { focus: false, rate: 1, player: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  function save() {
    try {
      var out = Object.assign({}, S);
      if (NOFOCUS) { var prev = JSON.parse(localStorage.getItem(KEY) || "{}"); out.focus = !!prev.focus; }
      localStorage.setItem(KEY, JSON.stringify(out));
    } catch (e) {}
  }

  var script = document.currentScript;
  var NOFOCUS = !!(script && script.hasAttribute("data-nofocus"));
  var NODOCK = !!(script && script.hasAttribute("data-nodock"));
  var HOME = (script && script.dataset.home) || "../";
  var root = document.querySelector("main") || document.body;
  var synth = window.speechSynthesis;
  var hasTTS = !!(synth && window.SpeechSynthesisUtterance);
  var hasHL = !!(window.CSS && CSS.highlights && window.Highlight);

  /* ---------- bloki tekstu ---------- */
  var BLOCK_SEL = "h2, h3, details > summary, p, li, tr, dd, blockquote";
  function mark(el) {
    if (el.hasAttribute("data-block") || el.closest(".dock, .st-nav, .st-sheet, .toc, .crumbs, .hero .links, nav, script, style")) return;
    if (/^H[23]$/.test(el.tagName) && el.closest("summary")) return;          // nagłówek w summary — czytamy summary
    if (el.tagName === "LI" && el.querySelector("p")) return;                   // li z akapitami — czytamy akapity
    if (el.tagName === "P" && el.closest("li, td, th, blockquote")) return;
    if (el.tagName === "BLOCKQUOTE" && el.querySelector("p")) return;
    if (el.parentElement && el.parentElement.closest("[data-block]")) return;   // nie zagnieżdżaj bloków
    if (!el.textContent.trim()) return;
    el.setAttribute("data-block", "");
  }
  function markBlocks() {
    root.querySelectorAll(BLOCK_SEL).forEach(mark);
    // starsze materiały: tekst bezpośrednio w <div> (np. odpowiedzi, karty)
    root.querySelectorAll("div").forEach(function (d) {
      if (d.closest("[data-block], .dock, .st-nav, .st-sheet")) return;
      if (d.querySelector("p, li, div, table, h1, h2, h3, h4, details, ul, ol")) return;
      if (d.textContent.trim().length < 12) return;
      mark(d);
    });
  }
  function isReadable(el) {
    var d = el.parentElement && el.parentElement.closest("details");
    while (d) {
      // summary zamkniętej sekcji jest widoczne, jej treść nie
      if (!d.open && !(el.tagName === "SUMMARY" && el.parentElement === d)) return false;
      d = d.parentElement && d.parentElement.closest("details");
    }
    return el.offsetParent !== null || el.tagName === "TR";
  }
  function blocks() { return Array.prototype.filter.call(root.querySelectorAll("[data-block]"), isReadable); }

  /* ---------- aktywny blok (skupienie) ---------- */
  var active = null;
  function setActive(el, scroll) {
    if (active) active.classList.remove("is-active");
    active = el;
    if (el) {
      el.classList.add("is-active");
      if (scroll) {
        var r = el.getBoundingClientRect(), vh = window.innerHeight;
        if (r.top < 70 || r.bottom > vh - 170) {
          el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        }
      }
    }
  }
  root.addEventListener("click", function (e) {
    if (e.target.closest("a, button, input, .dock, .st-nav, .st-sheet")) return;
    var b = e.target.closest("[data-block]");
    if (!b) return;
    setActive(b, false);
    if (speaking) { startAt(b); }          // lektor przeskakuje do dotkniętego akapitu
  });

  /* ---------- ikony (w stylu SF Symbols) ---------- */
  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 19l-7-7 7-7"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
    focus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/></svg>',
    speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 6.5v11a.8.8 0 0 1-1.25.66L2.5 12.66a.8.8 0 0 1 0-1.32l7.25-5.5A.8.8 0 0 1 11 6.5zM21 6.5v11a.8.8 0 0 1-1.25.66l-7.25-5.5a.8.8 0 0 1 0-1.32l7.25-5.5A.8.8 0 0 1 21 6.5z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 6.5v11a.8.8 0 0 0 1.25.66l7.25-5.5a.8.8 0 0 0 0-1.32l-7.25-5.5A.8.8 0 0 0 13 6.5zM3 6.5v11a.8.8 0 0 0 1.25.66l7.25-5.5a.8.8 0 0 0 0-1.32L4.25 5.84A.8.8 0 0 0 3 6.5z"/></svg>'
  };

  /* ---------- pasek nawigacji u góry: wstecz + tytuł po przewinięciu ---------- */
  var BACK = (script && script.dataset.back) || HOME;
  var BACK_LABEL = (script && script.dataset.backLabel) || "Studia";
  var h1 = document.querySelector("h1");
  var pageTitle = (script && script.dataset.title) || (h1 ? h1.textContent.replace(/\s+/g, " ").trim() : document.title);
  var nav = document.createElement("header");
  nav.className = "st-nav";
  nav.innerHTML =
    (BACK === "none" ? "<span></span>" : '<a class="st-back" href="' + BACK + '">' + ICON.back + "<span>" + BACK_LABEL + "</span></a>") +
    '<div class="st-title" aria-hidden="true">' + pageTitle.replace(/</g, "&lt;") + "</div><span></span>";
  document.body.insertBefore(nav, document.body.firstChild);
  function onScroll() {
    var y = window.scrollY || 0;
    nav.classList.toggle("is-scrolled", y > 4);
    var past = h1 ? h1.getBoundingClientRect().bottom < 52 : y > 120;
    nav.classList.toggle("show-title", past);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (NODOCK) return;

  /* ---------- spis treści ---------- */
  function headings() {
    return Array.prototype.filter.call(document.querySelectorAll("h2"), function (h) {
      return !h.closest(".st-nav, .st-sheet, .dock, nav, .toc") && h.textContent.trim().length > 1;
    });
  }
  var HEADS = headings();
  var hasToc = HEADS.length >= 3;
  var sheet = null;
  if (hasToc) {
    sheet = document.createElement("div");
    sheet.className = "st-sheet"; sheet.hidden = true;
    sheet.innerHTML =
      '<div class="st-scrim" data-close></div>' +
      '<section class="st-panel" role="dialog" aria-modal="true" aria-labelledby="st-toc-t">' +
        '<div class="st-grab" aria-hidden="true"></div>' +
        '<header><h2 id="st-toc-t">Spis treści</h2><button type="button" data-close>Gotowe</button></header>' +
        "<ol></ol>" +
      "</section>";
    document.body.appendChild(sheet);
    var ol = sheet.querySelector("ol");
    HEADS.forEach(function (h, i) {
      if (!h.id) h.id = "sekcja-" + (i + 1);
      var t = h.cloneNode(true);
      t.querySelectorAll(".tag, .src, .num, .n").forEach(function (x) { x.remove(); });
      var li = document.createElement("li");
      li.innerHTML = '<a href="#' + h.id + '"></a>';
      li.firstChild.textContent = t.textContent.replace(/\s+/g, " ").trim();
      ol.appendChild(li);
    });
    sheet.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { closeToc(); return; }
      var a = e.target.closest("a[href^='#']");
      if (!a) return;
      e.preventDefault();
      var h = document.getElementById(a.getAttribute("href").slice(1));
      closeToc();
      // otwórz zwinięte sekcje, w których jest nagłówek
      for (var d = h.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
      h.scrollIntoView({ block: "start" });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) closeToc(); });
  }
  var lastFocus = null;
  function reachable(h) {
    if (h.getClientRects().length) return true;
    for (var d = h.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) if (!d.open) return true;
    return false;
  }
  function openToc() {
    var cur = null;
    sheet.querySelectorAll("li").forEach(function (li, i) { li.hidden = !reachable(HEADS[i]); });
    HEADS.forEach(function (h) { if (h.getBoundingClientRect().top < 120) cur = h; });
    sheet.querySelectorAll("li").forEach(function (li, i) { li.classList.toggle("is-current", HEADS[i] === cur); });
    lastFocus = document.activeElement;
    sheet.hidden = false; document.body.classList.add("st-locked");
    var c = sheet.querySelector(".is-current a") || sheet.querySelector("a");
    if (c) { c.scrollIntoView({ block: "center" }); }
    sheet.querySelector("header button").focus({ preventScroll: true });
  }
  function closeToc() {
    sheet.hidden = true; document.body.classList.remove("st-locked");
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- pasek narzędzi na dole + lektor ---------- */
  var dock = document.createElement("div");
  dock.className = "dock";
  dock.innerHTML =
    (hasTTS ?
    '<section class="player" id="tts-player" aria-label="Lektor" hidden>' +
      '<div class="now" aria-live="polite"><b data-now>Lektor</b><span data-sub></span></div>' +
      '<div class="row">' +
        '<button class="ctl" type="button" data-a="prev" aria-label="Poprzedni akapit">' + ICON.prev + '</button>' +
        '<button class="ctl main" type="button" data-a="play" aria-label="Odtwórz">' + ICON.play + '</button>' +
        '<button class="ctl" type="button" data-a="next" aria-label="Następny akapit">' + ICON.next + '</button>' +
      '</div>' +
      '<label class="rate"><span>Prędkość</span><input type="range" min="0.6" max="1.8" step="0.05" data-a="rate" aria-label="Prędkość czytania"><output data-rate></output></label>' +
    '</section>' : "") +
    '<nav class="dock-bar" aria-label="Narzędzia">' +
      (hasToc ? '<button type="button" data-a="toc" aria-haspopup="dialog">' + ICON.list + '<span>Spis treści</span></button>' : "") +
      (NOFOCUS ? "" : '<button type="button" data-a="focus" aria-pressed="false">' + ICON.focus + '<span>Skupienie</span></button>') +
      (hasTTS ? '<button type="button" data-a="player" aria-expanded="false" aria-controls="tts-player">' + ICON.speak + '<span>Lektor</span></button>' : "") +
    '</nav>';
  document.body.appendChild(dock);

  var $ = function (s) { return dock.querySelector(s); };
  var btnFocus = $('[data-a="focus"]'), btnPlayer = $('[data-a="player"]');
  var player = $(".player"), btnPlay = $('[data-a="play"]');
  var rateIn = $('[data-a="rate"]'), rateOut = $("[data-rate]");
  var nowEl = $("[data-now]"), subEl = $("[data-sub]");

  function applyUI() {
    document.body.classList.toggle("focus", !!S.focus && !NOFOCUS);
    if (btnFocus) btnFocus.setAttribute("aria-pressed", S.focus ? "true" : "false");
    if (player) {
      player.hidden = !S.player;
      btnPlayer.setAttribute("aria-expanded", S.player ? "true" : "false");
      document.body.classList.toggle("tts-on", !!S.player);
      rateIn.value = S.rate;
      rateOut.textContent = Number(S.rate).toFixed(2).replace(".", ",") + "×";
    }
  }

  dock.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]");
    if (!b) return;
    var a = b.dataset.a;
    if (a === "toc") { openToc(); return; }
    if (a === "focus") {
      S.focus = !S.focus;
      if (S.focus && !active) { var first = firstVisibleBlock(); if (first) setActive(first, false); }
    }
    if (a === "player") { S.player = !S.player; if (!S.player) stop(); }
    if (a === "play") { speaking ? pause() : play(); }
    if (a === "prev") step(-1);
    if (a === "next") step(1);
    save(); applyUI();
  });
  if (rateIn) rateIn.addEventListener("input", function () {
    S.rate = parseFloat(rateIn.value); save(); applyUI();
    if (speaking) speakSentence();           // nowa prędkość od bieżącego zdania
  });

  function firstVisibleBlock() {
    var list = blocks();
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.bottom > 60) return list[i];
    }
    return list[0];
  }

  /* =========================================================
     LEKTOR
     ========================================================= */
  if (!hasTTS) { applyUI(); markBlocks(); return; }

  var voice = null;
  function pickVoice() {
    var vs = synth.getVoices().filter(function (v) { return /^pl/i.test(v.lang); });
    function score(v) {
      var n = v.name.toLowerCase(), s = 0;
      if (/zosia/.test(n)) s += 4;
      if (/enhanced|premium|rozszerz|ulepsz|natural|neural/.test(n)) s += 6;
      if (v.localService) s += 1;
      return s;
    }
    vs.sort(function (a, b) { return score(b) - score(a); });
    voice = vs[0] || null;
  }
  pickVoice();
  if ("onvoiceschanged" in synth) synth.addEventListener("voiceschanged", pickVoice);

  var speaking = false, cur = null, sents = [], si = 0, utt = null, token = 0;

  function textMap(el) {
    // tekst bloku + mapa: indeks znaku → (węzeł, offset)
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [], text = "", n;
    while ((n = walker.nextNode())) {
      if (n.parentElement.closest(".src, [aria-hidden='true']")) continue;
      nodes.push({ node: n, start: text.length });
      text += n.nodeValue;
    }
    return { text: text, nodes: nodes };
  }
  function rangeFor(map, a, b) {
    var r = document.createRange(), sN, sO, eN, eO;
    for (var i = 0; i < map.nodes.length; i++) {
      var m = map.nodes[i], len = m.node.nodeValue.length;
      if (sN == null && a < m.start + len) { sN = m.node; sO = a - m.start; }
      if (b <= m.start + len) { eN = m.node; eO = b - m.start; break; }
    }
    if (sN == null || eN == null) return null;
    r.setStart(sN, Math.max(0, sO)); r.setEnd(eN, Math.max(0, eO));
    return r;
  }
  function splitSentences(text) {
    var out = [], re = /[^.!?…]+(?:[.!?…]+["”»)]*|$)/g, m;
    while ((m = re.exec(text))) {
      var s = m[0]; if (!s.trim()) { if (re.lastIndex === m.index) re.lastIndex++; continue; }
      var lead = s.length - s.replace(/^\s+/, "").length;
      // nie dziel na skrótach typu „np.”, „s.”, „t.”, „ok.”, „r.” ani na liczbach
      if (out.length && /(?:\b(?:np|s|t|ok|r|tj|tzw|m\.in|ang|wg|cyt|red|zob|ew|ok|itd|itp|nr|dr|prof|mgr|hab|cz|rozdz|por|al|im|pkt|min|ul|zw|ks|św|wyd|tab|ryc|ss|ust|art|par)\.|\d\.)\s*$/i.test(text.slice(out[out.length - 1].a, out[out.length - 1].b))) {
        out[out.length - 1].b = m.index + s.length; continue;
      }
      out.push({ a: m.index + lead, b: m.index + s.length });
    }
    return out.filter(function (x) { return text.slice(x.a, x.b).trim().length > 1; });
  }

  function clearHL() {
    if (hasHL) { CSS.highlights.delete("tts-sentence"); CSS.highlights.delete("tts-word"); }
    root.querySelectorAll(".tts-fallback").forEach(function (x) { x.classList.remove("tts-fallback"); });
  }
  function label(el) {
    var sec = el.closest("details.sec");
    var t = sec ? sec.querySelector("summary").textContent : (el.closest("section") || {}).dataset ? "" : "";
    return (t || "").replace(/\s+/g, " ").trim();
  }

  function startAt(el) {
    cur = el; sents = []; si = 0;
    prepare();
    speaking = true; render(); speakSentence();
  }
  function prepare() {
    var map = textMap(cur);
    cur._map = map;
    sents = splitSentences(map.text);
    if (!sents.length) sents = [{ a: 0, b: map.text.length }];
    setActive(cur, true);
    nowEl.textContent = map.text.replace(/\s+/g, " ").trim().slice(0, 80);
    subEl.textContent = label(cur);
  }
  function speakSentence() {
    var my = ++token;
    var wasBusy = synth.speaking || synth.pending;
    if (wasBusy) synth.cancel();
    clearHL();
    if (!cur) return;
    var map = cur._map, s = sents[si];
    var txt = map.text.slice(s.a, s.b).replace(/\s+/g, " ").trim();
    var sr = hasHL ? rangeFor(map, s.a, s.b) : null;
    if (sr) CSS.highlights.set("tts-sentence", new Highlight(sr));
    else cur.classList.add("tts-fallback");

    utt = new SpeechSynthesisUtterance(txt);
    utt.lang = "pl-PL";
    if (voice) utt.voice = voice;
    utt.rate = S.rate;
    // podświetlanie słowa — tylko jeśli przeglądarka wysyła zdarzenia „boundary”
    var offset = s.a + (map.text.slice(s.a, s.b).length - map.text.slice(s.a, s.b).replace(/^\s+/, "").length);
    utt.onboundary = function (ev) {
      if (my !== token || !hasHL || ev.name && ev.name !== "word") return;
      var a = offset + ev.charIndex, rest = map.text.slice(a);
      var len = ev.charLength || (rest.match(/^\S+/) || [""])[0].length;
      var wr = rangeFor(map, a, a + len);
      if (wr) CSS.highlights.set("tts-word", new Highlight(wr));
    };
    utt.onend = function () { if (my === token && speaking) advance(); };
    utt.onerror = function (ev) {
      if (my !== token || !speaking || ev.error === "interrupted" || ev.error === "canceled") return;
      stop(); subEl.textContent = "Odtwarzanie niedostępne";
    };
    // Safari na iPadzie gubi wypowiedź podaną zaraz po cancel() — krótka przerwa
    if (wasBusy) setTimeout(function () { if (my === token) synth.speak(utt); }, 80);
    else synth.speak(utt);
  }
  function advance() {
    if (si < sents.length - 1) { si++; speakSentence(); return; }
    var list = blocks(), i = list.indexOf(cur);
    if (i >= 0 && i < list.length - 1) { cur = list[i + 1]; si = 0; prepare(); speakSentence(); }
    else stop();
  }
  function step(dir) {
    var list = blocks();
    var i = cur ? list.indexOf(cur) : list.indexOf(active || firstVisibleBlock());
    var t = list[Math.min(Math.max(i + dir, 0), list.length - 1)];
    if (!t) return;
    if (speaking) startAt(t); else { cur = t; si = 0; prepare(); }
  }
  function play() {
    if (cur && sents.length) { speaking = true; render(); speakSentence(); return; }
    var start = active || firstVisibleBlock();
    if (start) startAt(start);
  }
  function pause() {
    // pauza = zatrzymanie i zapamiętanie zdania (pause() na iPadzie bywa zawodne)
    speaking = false; token++; synth.cancel(); render();
  }
  function stop() {
    speaking = false; token++; synth.cancel(); clearHL(); cur = null; sents = []; si = 0; render();
    nowEl.textContent = "Lektor"; subEl.textContent = "";
  }
  function render() {
    btnPlay.innerHTML = speaking ? ICON.pause : ICON.play;
    btnPlay.setAttribute("aria-label", speaking ? "Pauza" : "Odtwórz");
  }
  // zwinięcie sekcji w trakcie czytania — przejdź dalej
  root.addEventListener("toggle", function (e) {
    if (speaking && cur && !isReadable(cur)) advance();
  }, true);
  window.addEventListener("pagehide", function () { synth.cancel(); });

  // gdy panel otwarty i lektor stoi — dotknięcie akapitu ustawia start
  root.addEventListener("click", function (e) {
    if (!S.player || speaking) return;
    var b = e.target.closest("[data-block]");
    if (b && !e.target.closest("a, button, input")) { cur = b; si = 0; prepare(); }
  });

  markBlocks();
  applyUI();
  // treść zmieniana skryptem (np. fiszki) — oznacz nowe bloki
  var mo = new MutationObserver(function () { clearTimeout(mo.t); mo.t = setTimeout(markBlocks, 50); });
  mo.observe(root, { childList: true, subtree: true });
})();
