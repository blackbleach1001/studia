/* Studia — wspólne narzędzia symulacji */
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var S = {};
  S.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // losowanie z ziarnem (powtarzalne wyniki przy „Od nowa”)
  S.rng = function (seed) {
    var a = seed >>> 0 || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  S.normal = function (r) {
    var u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  S.clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  S.mean = function (xs) { if (!xs.length) return NaN; var s = 0; for (var i = 0; i < xs.length; i++) s += xs[i]; return s / xs.length; };
  S.sd = function (xs) { var m = S.mean(xs), s = 0; for (var i = 0; i < xs.length; i++) s += (xs[i] - m) * (xs[i] - m); return Math.sqrt(s / (xs.length - 1)); };
  S.corr = function (x, y) {
    var mx = S.mean(x), my = S.mean(y), a = 0, b = 0, c = 0;
    for (var i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) * (x[i] - mx); c += (y[i] - my) * (y[i] - my); }
    return a / Math.sqrt(b * c);
  };
  // liczby po polsku: przecinek dziesiętny, minus typograficzny
  S.fmt = function (x, d) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return x.toFixed(d === undefined ? 1 : d).replace(".", ",").replace("-", "−");
  };

  S.svg = function (tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  S.text = function (parent, x, y, str, attrs) {
    var t = S.svg("text", Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  };
  S.clear = function (e) { while (e.firstChild) e.removeChild(e.firstChild); };

  // przełącznik segmentowy: <div class="seg" data-seg="nazwa"><button data-v="a">…
  S.seg = function (el, onChange) {
    var btns = el.querySelectorAll("button");
    function set(v, silent) {
      btns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.v === v ? "true" : "false"); });
      if (!silent) onChange(v);
    }
    btns.forEach(function (b) { b.addEventListener("click", function () { set(b.dataset.v); }); });
    var cur = el.querySelector('[aria-pressed="true"]') || btns[0];
    set(cur.dataset.v, true);
    return { set: set, get: function () { return el.querySelector('[aria-pressed="true"]').dataset.v; } };
  };
  // przełącznik on/off: <button class="switch" role="switch" aria-checked="false">
  S.toggle = function (el, onChange) {
    el.addEventListener("click", function () {
      var on = el.getAttribute("aria-checked") !== "true";
      el.setAttribute("aria-checked", on ? "true" : "false");
      onChange(on);
    });
    return { get: function () { return el.getAttribute("aria-checked") === "true"; },
             set: function (on) { el.setAttribute("aria-checked", on ? "true" : "false"); } };
  };
  window.Sim = S;
})();
