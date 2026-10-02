// About page: clicking the profile photo blooms a small lineage graph out of
// it. Nodes labelled with skills from the page spring outward along curved
// edges, linger, then retract into the photo. Drawn on a temporary canvas
// behind the page content.
(function () {
  "use strict";

  var photo = document.querySelector(".about-layout__image");
  if (!photo) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var NODES = 14;
  var OUT = 700; // ms to spring out
  var HOLD = 1500;
  var BACK = 650;
  var canvas = null;
  var ctx = null;
  var run = null;

  function skills() {
    var names = Array.prototype.map.call(document.querySelectorAll(".about-skill"), function (el) {
      return el.textContent.trim();
    }).filter(Boolean);
    for (var i = names.length - 1; i > 0; i -= 1) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = names[i];
      names[i] = names[j];
      names[j] = t;
    }
    return names.slice(0, NODES);
  }

  function color(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  // Spring out with a little overshoot; ease back in.
  function springOut(t) {
    var c = 1.55;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.className = "about-bloom";
    canvas.setAttribute("aria-hidden", "true");
    // Inside the page section (which paints its own background), beneath the
    // content layer.
    var host = photo.closest("section") || document.body;
    host.insertBefore(canvas, host.firstChild);
    ctx = canvas.getContext("2d");
  }

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function bloom() {
    if (reduce) return;
    ensureCanvas();
    sizeCanvas();
    var labels = skills();
    var count = Math.max(6, labels.length);
    var offset = Math.random() * Math.PI * 2;
    var nodes = [];
    for (var i = 0; i < count; i += 1) {
      var angle = offset + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      nodes.push({
        angle: angle,
        dist: 170 + Math.random() * 190,
        bend: (Math.random() - 0.5) * 0.9,
        delay: Math.random() * 180,
        label: labels[i] || "",
      });
    }
    run = { start: performance.now(), nodes: nodes };
    canvas.classList.add("is-active");
    window.requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!run) return;
    var rect = photo.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var radius = rect.width / 2;
    var elapsed = now - run.start;
    var total = OUT + HOLD + BACK + 200;
    var accent = color("--color-primary", "#89f7ff");
    var muted = color("--color-text-light", "#b3c3ff");

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // A single soft ring that leaves the photo first.
    var ringT = Math.min(1, elapsed / 900);
    if (ringT < 1) {
      ctx.globalAlpha = (1 - ringT) * 0.45;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 8 + ringT * 120, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = "500 11px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textBaseline = "middle";
    run.nodes.forEach(function (n) {
      var t = elapsed - n.delay;
      var reach;
      if (t < 0) return;
      if (t < OUT) reach = springOut(t / OUT);
      else if (t < OUT + HOLD) reach = 1;
      else reach = Math.max(0, 1 - Math.pow((t - OUT - HOLD) / BACK, 2));
      if (reach <= 0) return;

      var sx = cx + Math.cos(n.angle) * radius;
      var sy = cy + Math.sin(n.angle) * radius;
      var d = radius + n.dist * reach;
      var ex = cx + Math.cos(n.angle) * d;
      var ey = cy + Math.sin(n.angle) * d;
      // Control point pushed sideways so each edge curves.
      var mx = (sx + ex) / 2 - Math.sin(n.angle) * n.bend * n.dist * 0.5 * reach;
      var my = (sy + ey) / 2 + Math.cos(n.angle) * n.bend * n.dist * 0.5 * reach;
      var fade = Math.min(1, reach * 1.4);

      ctx.globalAlpha = 0.35 * fade;
      ctx.strokeStyle = muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();

      ctx.globalAlpha = 0.9 * fade;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
      ctx.fill();

      if (n.label) {
        ctx.globalAlpha = 0.75 * fade;
        ctx.fillStyle = muted;
        var right = Math.cos(n.angle) >= 0;
        ctx.textAlign = right ? "left" : "right";
        ctx.fillText(n.label, ex + (right ? 9 : -9), ey);
      }
    });
    ctx.globalAlpha = 1;

    if (elapsed < total) {
      window.requestAnimationFrame(frame);
    } else {
      run = null;
      canvas.classList.remove("is-active");
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  photo.addEventListener("click", bloom);
  window.addEventListener("resize", function () {
    if (canvas) sizeCanvas();
  });
})();
