// Landing-page background: small records drifting left to right along
// invisible partitions, like messages streaming through a topic.
(function () {
  "use strict";

  var canvas = document.querySelector("[data-landing-streams]");
  var hero = canvas && canvas.closest(".landing-hero");
  if (!canvas || !hero || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var LANE_GAP = 58;
  var width = 0;
  var height = 0;
  var lanes = [];
  var records = [];
  var color = [154, 164, 199];
  var probe = document.createElement("canvas").getContext("2d");
  var visible = true;
  var last = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // Theme colours can be hex or oklch; paint one pixel to get plain RGB.
  function readColor() {
    var value = getComputedStyle(root).getPropertyValue("--color-text-light").trim();
    if (!value || !probe) return;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data;
    color = [d[0], d[1], d[2]];
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = Math.max(4, Math.floor(height / LANE_GAP));
    var gap = height / (count + 1);
    lanes = [];
    for (var i = 0; i < count; i += 1) {
      lanes.push({ y: gap * (i + 1), speed: rand(28, 74), next: rand(0, 1.2) });
    }
    records = [];
    lanes.forEach(function (lane, index) {
      for (var x = rand(0, 120); x < width; x += rand(70, 190)) {
        records.push({ lane: index, x: x, len: rand(5, 9) });
      }
    });
  }

  function step(dt) {
    lanes.forEach(function (lane, index) {
      lane.next -= dt;
      if (lane.next <= 0) {
        records.push({ lane: index, x: -12, len: rand(5, 9) });
        lane.next = rand(0.9, 2.6) * (60 / lane.speed);
      }
    });
    for (var i = records.length - 1; i >= 0; i -= 1) {
      var r = records[i];
      r.x += lanes[r.lane].speed * dt;
      if (r.x > width + 20) records.splice(i, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(" + color[0] + "," + color[1] + "," + color[2] + ",0.26)";
    records.forEach(function (r) {
      ctx.fillRect(r.x - r.len / 2, lanes[r.lane].y - 1.5, r.len, 3);
    });
  }

  function frame(time) {
    if (!visible) {
      last = 0;
      return;
    }
    var dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    step(dt);
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

  readColor();
  resize();
  new MutationObserver(function () {
    window.requestAnimationFrame(readColor);
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

  start();
})();
