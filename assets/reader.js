/* =========================================================
   Studia — pasek czytania: Spis · Skupienie · Lektor
   Lektor = synteza mowy przeglądarki (polski głos systemowy).
   ========================================================= */
(function () {
  "use strict";
  var KEY = "studia-reader-v2";
  var S = { focus: false, rate: 1, player: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  var script = document.currentScript;
  var HOME = (script && script.dataset.home) || "../";
  var root = document.querySelector("main") || document.body;
  var synth = window.speechSynthesis;
  var hasTTS = !!(synth && window.SpeechSynthesisUtterance);
  var hasHL = !!(window.CSS && CSS.highlights && window.Highlight);

  /* ---------- bloki tekstu ---------- */
  var BLOCK_SEL = "h2, h3, details > summary, p, li, tr, dd, blockquote";
  function mark(el) {
    if (el.hasAttribute("data-block") || el.closest(".dock, .toc, .crumbs, .hero .links, nav, script, style")) return;
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
      if (d.closest("[data-block], .dock")) return;
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
    if (e.target.closest("a, button, input, .dock")) return;
    var b = e.target.closest("[data-block]");
    if (!b) return;
    setActive(b, false);
    if (speaking) { startAt(b); }          // lektor przeskakuje do dotkniętego akapitu
  });

  /* ---------- pasek ---------- */
  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    focus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/></svg>',
    speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 17l-5-5 5-5M11 17l-5-5 5-5"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 17l5-5-5-5M13 17l5-5-5-5"/></svg>'
  };

  var dock = document.createElement("div");
  dock.className = "dock";
  dock.innerHTML =
    (hasTTS ?
    '<section class="player" id="tts-player" aria-label="Lektor" hidden>' +
      '<div class="row">' +
        '<button class="ctl" type="button" data-a="prev" aria-label="Poprzedni akapit">' + ICON.prev + '</button>' +
        '<button class="ctl main" type="button" data-a="play" aria-label="Odtwórz">' + ICON.play + '</button>' +
        '<button class="ctl" type="button" data-a="next" aria-label="Następny akapit">' + ICON.next + '</button>' +
        '<div class="now" aria-live="polite"><b data-now>Dotknij akapitu, od którego mam zacząć</b><span data-sub>albo naciśnij odtwórz</span></div>' +
      '</div>' +
      '<label class="rate">Prędkość <input type="range" min="0.6" max="1.8" step="0.05" data-a="rate"> <output data-rate></output></label>' +
      '<p class="voice" data-voice></p>' +
    '</section>' : "") +
    '<nav class="dock-bar" aria-label="Narzędzia czytania">' +
      (HOME === "none" ? "" : '<a href="' + HOME + '">' + ICON.back + '<span>Spis</span></a>') +
      '<button type="button" data-a="focus" aria-pressed="false">' + ICON.focus + '<span>Skupienie</span></button>' +
      (hasTTS ? '<button type="button" data-a="player" aria-expanded="false" aria-controls="tts-player">' + ICON.speak + '<span>Lektor</span></button>' : "") +
    '</nav>';
  document.body.appendChild(dock);

  var $ = function (s) { return dock.querySelector(s); };
  var btnFocus = $('[data-a="focus"]'), btnPlayer = $('[data-a="player"]');
  var player = $(".player"), btnPlay = $('[data-a="play"]');
  var rateIn = $('[data-a="rate"]'), rateOut = $("[data-rate]");
  var nowEl = $("[data-now]"), subEl = $("[data-sub]"), voiceEl = $("[data-voice]");

  function applyUI() {
    document.body.classList.toggle("focus", !!S.focus);
    btnFocus.setAttribute("aria-pressed", S.focus ? "true" : "false");
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
    if (voiceEl) {
      if (!voice) voiceEl.textContent = "Nie znalazłam polskiego głosu na tym urządzeniu.";
      else {
        var good = score(voice) >= 6;
        voiceEl.textContent = "Głos: " + voice.name + (good ? "" :
          " · lepiej brzmi wersja rozszerzona: Ustawienia → Dostępność → Treść mówiona → Głosy → Polski.");
      }
    }
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
      stop(); subEl.textContent = "Lektor nie może teraz mówić. Sprawdź, czy iPad nie jest wyciszony.";
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
    nowEl.textContent = "Dotknij akapitu, od którego mam zacząć"; subEl.textContent = "albo naciśnij odtwórz";
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
