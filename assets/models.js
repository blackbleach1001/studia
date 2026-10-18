/* Studia — mapa modeli.
   Dane: <script id="models" type="application/json">{core, groups:[{id,name,sub}], models:[…]}</script>
   Model: {id, g, name, who, yr, gist, pts[], flow[] (opcjonalnie; "*" na początku = krok kluczowy),
           study, warn, links:[{to, rel}], sec} */
(function () {
  var REL = {
    "rozwija": "hsl(209,40%,40%)",
    "krytykuje": "hsl(8,52%,46%)",
    "alternatywa": "hsl(36,60%,40%)",
    "uzupełnia": "hsl(150,30%,36%)",
    "wyjaśnia": "hsl(265,24%,46%)"
  };
  var PAL = ["209 36% 42%", "150 28% 34%", "28 48% 42%", "345 34% 46%", "265 22% 46%", "190 34% 34%", "36 55% 38%", "8 38% 44%", "100 22% 34%", "220 18% 40%", "300 18% 42%", "170 30% 32%"];
  var data = JSON.parse(document.getElementById("models").textContent);
  var byId = {}, gIdx = {};
  data.groups.forEach(function (g, i) { gIdx[g.id] = i; });
  data.models.forEach(function (m) { byId[m.id] = m; m.links = m.links || []; });
  // powiązania przychodzące
  var inc = {};
  data.models.forEach(function (m) {
    m.links.forEach(function (l) { (inc[l.to] = inc[l.to] || []).push({ from: m.id, rel: l.rel }); });
  });
  function gcol(m) { return PAL[gIdx[m.g] % PAL.length]; }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "style") e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var root = document.getElementById("mm");
  var wrap = el("div", { "class": "mm-wrap" });
  var map = el("div", { "class": "mm-map", id: "mm-map" });
  map.appendChild(el("div", { "class": "mm-core" }, "<div><b>" + esc(data.core.title) + "</b><span>" + esc(data.core.sub) + "</span></div>"));
  var groups = el("div", { "class": "mm-groups" });
  data.groups.forEach(function (g, i) {
    var box = el("section", { "class": "mm-group", style: "--g:" + PAL[i % PAL.length], "aria-label": g.name });
    box.appendChild(el("h3", null, esc(g.name)));
    if (g.sub) box.appendChild(el("p", null, esc(g.sub)));
    var ul = el("ul");
    data.models.filter(function (m) { return m.g === g.id; }).forEach(function (m) {
      var li = el("li");
      var b = el("button", { type: "button", "class": "mm-node", "data-id": m.id, "aria-pressed": "false", style: "--g:" + PAL[i % PAL.length] },
        esc(m.name) + "<small>" + esc(m.who) + (m.yr ? " · " + esc(m.yr) : "") + "</small>");
      b.addEventListener("click", function () { select(m.id, true); });
      li.appendChild(b); ul.appendChild(li);
    });
    box.appendChild(ul); groups.appendChild(box);
  });
  map.appendChild(groups);
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "mm-lines"); svg.setAttribute("aria-hidden", "true");
  map.appendChild(svg);
  var leg = el("div", { "class": "mm-legend" });
  Object.keys(REL).forEach(function (k) {
    if (data.models.some(function (m) { return m.links.some(function (l) { return l.rel === k; }); }))
      leg.appendChild(el("span", null, '<i style="background:' + REL[k] + '"></i>' + k));
  });
  map.appendChild(leg);
  var det = el("aside", { "class": "mm-detail", id: "mm-detail", "aria-live": "polite", tabindex: "-1" });
  wrap.appendChild(map); wrap.appendChild(det); root.appendChild(wrap);

  // chronologia
  var tl = document.getElementById("mm-time-list");
  if (tl) {
    data.models.filter(function (m) { return m.yr; }).slice().sort(function (a, b) { return parseInt(a.yr, 10) - parseInt(b.yr, 10); }).forEach(function (m) {
      var li = el("li", { style: "--g:" + gcol(m) });
      var b = el("button", { type: "button", "data-id": m.id, "aria-pressed": "false", style: "--g:" + gcol(m) },
        '<span class="y">' + esc(m.yr) + '</span><span><span class="n">' + esc(m.name) + '</span> <span class="w">' + esc(m.who) + "</span></span>");
      b.addEventListener("click", function () { select(m.id, true, true); });
      li.appendChild(b); tl.appendChild(li);
    });
  }

  var current = null;
  function center(node) {
    var r = node.getBoundingClientRect(), mr = map.getBoundingClientRect();
    return { x: r.left - mr.left + r.width / 2, y: r.top - mr.top + r.height / 2, w: r.width, h: r.height, l: r.left - mr.left, t: r.top - mr.top };
  }
  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!current) return;
    var a = map.querySelector('.mm-node[data-id="' + current + '"]');
    if (!a) return;
    var A = center(a);
    var pairs = byId[current].links.map(function (l) { return { id: l.to, rel: l.rel }; })
      .concat((inc[current] || []).map(function (l) { return { id: l.from, rel: l.rel }; }));
    pairs.forEach(function (p) {
      var b = map.querySelector('.mm-node[data-id="' + p.id + '"]');
      if (!b) return;
      var B = center(b);
      var same = Math.abs(A.l - B.l) < 4;
      var x1, x2, d;
      if (same) {
        x1 = A.l + A.w - 6; x2 = B.l + B.w - 6;
        var bow = Math.min(60, 24 + Math.abs(B.y - A.y) / 6, map.clientWidth - Math.max(x1, x2) - 3);
        d = "M" + x1 + "," + A.y + " C" + (x1 + bow) + "," + A.y + " " + (x2 + bow) + "," + B.y + " " + x2 + "," + B.y;
      } else {
        x1 = B.x > A.x ? A.l + A.w - 4 : A.l + 4;
        x2 = B.x > A.x ? B.l + 4 : B.l + B.w - 4;
        var mx = (x1 + x2) / 2;
        d = "M" + x1 + "," + A.y + " C" + mx + "," + A.y + " " + mx + "," + B.y + " " + x2 + "," + B.y;
      }
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d); path.setAttribute("stroke", REL[p.rel] || "var(--ink-mute)");
      svg.appendChild(path);
      [[x1, A.y], [x2, B.y]].forEach(function (pt) {
        var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", pt[0]); c.setAttribute("cy", pt[1]); c.setAttribute("r", 4.5); c.setAttribute("fill", REL[p.rel] || "var(--ink-mute)");
        svg.appendChild(c);
      });
    });
  }
  function relRow(id, rel, out) {
    var m = byId[id]; if (!m) return "";
    var label = out ? rel : ({ "rozwija": "rozwinięty przez", "krytykuje": "krytykowany przez", "alternatywa": "alternatywa", "uzupełnia": "uzupełnia", "wyjaśnia": "wyjaśniany przez" }[rel] || rel);
    return '<button type="button" class="mm-rel" data-id="' + id + '"><em style="background:' + (REL[rel] || "#888") + '">' + esc(label) + "</em><span>" + esc(m.name) + ' <span style="color:var(--ink-mute)">· ' + esc(m.who) + "</span></span></button>";
  }
  function flow(steps) {
    return '<ul class="mm-flow">' + steps.map(function (s, i) {
      var k = s.charAt(0) === "*"; var t = k ? s.slice(1) : s;
      return (i ? '<li class="arr" aria-hidden="true">›</li>' : "") + '<li' + (k ? ' class="k"' : "") + ">" + esc(t) + "</li>";
    }).join("") + "</ul>";
  }
  function select(id, user, fromTimeline) {
    var m = byId[id]; if (!m) return;
    current = id;
    det.hidden = false;
    var rels = m.links.map(function (l) { return l.to; }).concat((inc[id] || []).map(function (l) { return l.from; }));
    map.classList.add("focus");
    [].forEach.call(map.querySelectorAll(".mm-node"), function (b) {
      b.setAttribute("aria-pressed", b.dataset.id === id);
      b.classList.toggle("rel", rels.indexOf(b.dataset.id) > -1);
    });
    if (tl) [].forEach.call(tl.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", b.dataset.id === id); });
    var g = data.groups[gIdx[m.g]];
    det.style.setProperty("--g", gcol(m));
    var h = '<button type="button" class="mm-back">Zwiń</button>';
    h += '<p class="eyebrow">' + esc(g.name) + "</p><h2>" + esc(m.name) + '</h2><p class="who">' + esc(m.who) + (m.yr ? " · " + esc(m.yr) : "") + "</p>";
    h += '<p class="gist">' + m.gist + "</p>";
    if (m.flow) h += "<h4>Schemat</h4>" + flow(m.flow);
    if (m.pts && m.pts.length) h += '<h4>Najważniejsze</h4><ul class="pts">' + m.pts.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul>";
    if (m.study) h += '<h4>Kluczowe badanie</h4><div class="study">' + m.study + "</div>";
    if (m.warn) h += '<div class="warn"><b>Uwaga.</b> ' + m.warn + "</div>";
    var rl = m.links.map(function (l) { return relRow(l.to, l.rel, true); }).join("") +
      (inc[id] || []).map(function (l) { return relRow(l.from, l.rel, false); }).join("");
    if (rl) h += '<h4>Powiązania</h4><div class="mm-rels">' + rl + "</div>";
    if (m.sec) h += '<a class="mm-open" href="' + m.sec + '">Otwórz w notatkach</a>';
    det.innerHTML = h;
    [].forEach.call(det.querySelectorAll(".mm-rel"), function (b) { b.addEventListener("click", function () { select(b.dataset.id, true); }); });
    det.querySelector(".mm-back").addEventListener("click", function () {
      var n = map.querySelector('.mm-node[data-id="' + id + '"]');
      current = null; det.hidden = true; map.classList.remove("focus");
      [].forEach.call(map.querySelectorAll(".mm-node"), function (b) { b.setAttribute("aria-pressed", "false"); b.classList.remove("rel"); });
      draw();
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
      if (n) { n.scrollIntoView({ block: "center", behavior: "auto" }); n.focus({ preventScroll: true }); }
    });
    place();
    draw();
    if (user) {
      try { history.replaceState(null, "", "#" + id); } catch (e) {}
      var narrow = window.matchMedia("(max-width:999px)").matches;
      if (narrow || fromTimeline) det.scrollIntoView({ block: "start", behavior: "auto" });
      if (fromTimeline && !narrow) map.querySelector('.mm-node[data-id="' + id + '"]').scrollIntoView({ block: "center" });
    }
  }
  // wąski ekran: szczegóły pod grupą wybranego modelu; szeroki: panel z boku
  var mq = window.matchMedia("(max-width:999px)");
  function place() {
    if (mq.matches && current) {
      var box = map.querySelector('.mm-node[data-id="' + current + '"]').closest(".mm-group");
      // w siatce kilkukolumnowej — za ostatnią grupą w tym samym wierszu
      var after = box, top = box.offsetTop, n = box.nextElementSibling;
      while (n) { if (n !== det && n.offsetTop === top) after = n; n = n.nextElementSibling; }
      if (after.nextElementSibling !== det) after.insertAdjacentElement("afterend", det);
    } else if (!mq.matches && det.parentNode !== wrap) wrap.appendChild(det);
  }
  var t;
  window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(function () { place(); draw(); }, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  var start = location.hash.slice(1);
  if (byId[start]) select(start, false);
  else if (!mq.matches) select(data.models[0].id, false);
  else det.hidden = true;
  if (byId[start]) setTimeout(function () { det.scrollIntoView({ block: "start" }); }, 50);
})();
