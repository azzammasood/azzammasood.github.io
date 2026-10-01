// Landing-page background: records drifting through 3D space, like messages
// streaming through a topic. Each record has a depth; nearer ones are larger,
// brighter and faster, and the whole field tilts slightly with the cursor for
// parallax. Records near the cursor light up in the accent colour.
(function () {
  "use strict";

  var canvas = document.querySelector("[data-landing-streams]");
  var hero = canvas && canvas.closest(".landing-hero");
  if (!canvas || !hero || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COUNT_PER_PX = 1 / 5200; // density: records per square pixel
  var FOCAL = 520; // perspective focal length
  var DEPTH = 1400; // far plane
  var GLOW_RADIUS = 140;
  var width = 0;
  var height = 0;
  var records = [];
  var base = [154, 164, 199];
  var accent = [137, 247, 255];
  var probe = document.createElement("canvas").getContext("2d");
  var pointer = { x: -9999, y: -9999, active: 0, seen: -1e9 };
  var tilt = { x: 0, y: 0 };
  var visible = true;
  var last = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // Theme colours can be hex or oklch; paint one pixel to get plain RGB.
  function toRgb(value, fallback) {
    if (!value || !probe) return fallback;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  function readColors() {
    var style = getComputedStyle(root);
    base = toRgb(style.getPropertyValue("--color-text-light").trim(), base);
    accent = toRgb(style.getPropertyValue("--color-primary").trim(), accent);
  }

  // World space: x spans a little wider than the view so records enter from
  // off-screen at every depth; z runs from near (0) to far (DEPTH).
  function spawn(atLeftEdge) {
    var z = rand(0, DEPTH);
    var spread = (width / 2) * (1 + z / FOCAL) + 80;
    return {
      x: atLeftEdge ? -spread : rand(-spread, spread),
      y: rand(-height / 2, height / 2) * (1 + z / FOCAL),
      z: z,
      len: rand(6, 11),
      speed: rand(40, 90),
      glow: 0,
    };
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var target = Math.round(width * height * COUNT_PER_PX);
    records = [];
    for (var i = 0; i < target; i += 1) records.push(spawn(false));
  }

  function project(r) {
    var scale = FOCAL / (FOCAL + r.z);
    return {
      x: width / 2 + (r.x + tilt.x * r.z) * scale,
      y: height / 2 + (r.y + tilt.y * r.z) * scale,
      scale: scale,
    };
  }

  function step(dt, time) {
    pointer.active += ((time - pointer.seen < 2500 ? 1 : 0) - pointer.active) * Math.min(1, dt * 3);
    // Parallax: the field leans gently away from the cursor.
    var tx = pointer.active * ((pointer.x - width / 2) / width) * -0.12;
    var ty = pointer.active * ((pointer.y - height / 2) / height) * -0.08;
    tilt.x += (tx - tilt.x) * Math.min(1, dt * 2);
    tilt.y += (ty - tilt.y) * Math.min(1, dt * 2);

    for (var i = 0; i < records.length; i += 1) {
      var r = records[i];
      r.x += r.speed * dt * (1 + (DEPTH - r.z) / DEPTH);
      var p = project(r);
      if (p.x - r.len * p.scale > width + 20) {
        records[i] = spawn(true);
        continue;
      }
      var dx = p.x - pointer.x;
      var dy = p.y - pointer.y;
      var near = pointer.active * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / GLOW_RADIUS);
      r.glow += (near - r.glow) * Math.min(1, dt * (near > r.glow ? 10 : 2.5));
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    // Far records first so near ones paint on top.
    records.sort(function (a, b) { return b.z - a.z; });
    records.forEach(function (r) {
      var p = project(r);
      var depth = 1 - r.z / DEPTH;
      var len = r.len * p.scale * 1.6;
      var thick = Math.max(1, 3 * p.scale);
      var g = r.glow;
      var c = [
        Math.round(base[0] + (accent[0] - base[0]) * g),
        Math.round(base[1] + (accent[1] - base[1]) * g),
        Math.round(base[2] + (accent[2] - base[2]) * g),
      ];
      var alpha = 0.08 + depth * 0.26 + g * 0.6;
      ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.min(1, alpha).toFixed(3) + ")";
      if (g > 0.05) {
        ctx.shadowColor = "rgba(" + accent[0] + "," + accent[1] + "," + accent[2] + "," + (g * 0.8).toFixed(3) + ")";
        ctx.shadowBlur = 10 * g;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(p.x - len / 2, p.y - thick / 2, len, thick);
    });
    ctx.shadowBlur = 0;
  }

  function frame(time) {
    if (!visible) {
      last = 0;
      return;
    }
    var dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    step(dt, time);
    draw();
    window.requestAnimationFrame(frame);
  }

  function start() {
    if (reduce) {
      draw();
      return;
    }
    if (!last) window.requestAnimationFrame(frame);
  }

  function onMove(event) {
    var rect = hero.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    pointer.x = x;
    pointer.y = y;
    pointer.seen = performance.now();
  }

  readColors();
  resize();
  new MutationObserver(function () {
    window.requestAnimationFrame(readColors);
  }).observe(root, { attributes: true, attributeFilter: ["data-code-theme", "class"] });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(hero);
  } else {
    window.addEventListener("resize", resize);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting && !document.hidden;
      if (visible) start();
    }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
    if (visible) start();
  });

  window.addEventListener("pointermove", onMove, { passive: true });
  start();
})();
