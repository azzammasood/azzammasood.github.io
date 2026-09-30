// Landing-page background: the hero is a topic with partitions. Records stream
// left to right along each partition; the cursor is a stream processor with a
// tumbling window. Records inside the window are pulled toward the cursor,
// processed (accent colour, wider) and counted. Inside the window each
// partition reads out its offset and consumer lag; clicking commits the
// offsets, resetting the lag.
(function () {
  "use strict";

  var canvas = document.querySelector("[data-landing-streams]");
  var hero = canvas && canvas.closest(".landing-hero");
  if (!canvas || !hero || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var LANE_GAP = 58;
  var WINDOW_WIDTH = 150;
  var PULL = 22;
  var width = 0;
  var height = 0;
  var dpr = 1;
  var lanes = [];
  var records = [];
  var ripples = [];
  var colors = { base: [154, 164, 199], accent: [137, 247, 255] };
  var probe = document.createElement("canvas").getContext("2d");
  var pointer = { x: -9999, y: -9999, seen: -1e9, active: 0 };
  var windowHits = [];
  var committedAt = -1e9;
  var visible = true;
  var last = 0;

  // Theme colours can be hex or oklch; paint one pixel to get plain RGB.
  function toRgb(color, fallback) {
    if (!color || !probe) return fallback;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  function readColors() {
    var style = getComputedStyle(root);
    colors.base = toRgb(style.getPropertyValue("--color-text-light").trim(), colors.base);
    colors.accent = toRgb(style.getPropertyValue("--color-primary").trim(), colors.accent);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = Math.max(4, Math.floor(height / LANE_GAP));
    var gap = height / (count + 1);
    lanes = [];
    for (var i = 0; i < count; i += 1) {
      lanes.push({
        y: gap * (i + 1),
        speed: rand(28, 74),
        next: rand(0, 1.2),
        offset: Math.floor(rand(1000, 90000)),
        committed: 0,
      });
      lanes[i].committed = lanes[i].offset - Math.floor(rand(0, 40));
    }
    records = records.filter(function (r) { return r.lane < count; });
    if (!records.length) seed();
  }

  // Start with the lanes already populated rather than empty.
  function seed() {
    lanes.forEach(function (lane, index) {
      for (var x = rand(0, 120); x < width; x += rand(70, 190)) {
        records.push(makeRecord(index, x));
      }
    });
  }

  function makeRecord(laneIndex, x) {
    var lane = lanes[laneIndex];
    lane.offset += 1;
    return {
      lane: laneIndex,
      x: x,
      dy: 0,
      len: rand(5, 9),
      processed: 0,
      inWindow: false,
      offset: lane.offset,
    };
  }

  function mix(alpha, color) {
    return "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + Math.max(0, Math.min(1, alpha)).toFixed(3) + ")";
  }

  function step(dt, time) {
    lanes.forEach(function (lane, index) {
      lane.next -= dt;
      if (lane.next <= 0) {
        records.push(makeRecord(index, -12));
        lane.next = rand(0.9, 2.6) * (60 / lane.speed);
      }
    });

    pointer.active += ((time - pointer.seen < 2600 ? 1 : 0) - pointer.active) * Math.min(1, dt * 4);
    var half = WINDOW_WIDTH / 2;

    for (var i = records.length - 1; i >= 0; i -= 1) {
      var r = records[i];
      var lane = lanes[r.lane];
      r.x += lane.speed * dt * (r.inWindow ? 0.55 : 1);

      var inside = pointer.active > 0.05 && Math.abs(r.x - pointer.x) < half;
      if (inside && !r.inWindow) {
        windowHits.push(time);
        r.processed = 1;
      }
      r.inWindow = inside;

      // Lens: records bend toward the cursor's row while inside the window.
      var target = 0;
      if (inside) {
        var distance = pointer.y - lane.y;
        var falloff = Math.exp(-(distance * distance) / (2 * 140 * 140));
        var edge = Math.cos((Math.abs(r.x - pointer.x) / half) * (Math.PI / 2));
        target = Math.max(-PULL, Math.min(PULL, distance * 0.35)) * falloff * edge * pointer.active;
      }
      r.dy += (target - r.dy) * Math.min(1, dt * 8);
      if (!inside && r.processed > 0) r.processed = Math.max(0, r.processed - dt * 0.35);

      if (r.x > width + 20) records.splice(i, 1);
    }

    while (windowHits.length && time - windowHits[0] > 1000) windowHits.shift();
    ripples = ripples.filter(function (ripple) { return time - ripple.t < 900; });
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    var commitFlash = Math.max(0, 1 - (time - committedAt) / 900);

    // Partitions.
    ctx.font = "500 10px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textBaseline = "middle";
    lanes.forEach(function (lane, index) {
      ctx.strokeStyle = mix(0.1, colors.base);
      ctx.setLineDash([2, 7]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lane.y);
      ctx.lineTo(width, lane.y);
      ctx.stroke();
      ctx.setLineDash([]);

    });

    // Partition offsets and consumer lag, read out only inside the window.
    if (pointer.active > 0.02) {
      lanes.forEach(function (lane, index) {
        var near = Math.exp(-Math.pow(pointer.y - lane.y, 2) / (2 * 90 * 90));
        if (near < 0.08) return;
        var alpha = (near * 0.6 + commitFlash * 0.3) * pointer.active;
        ctx.fillStyle = mix(alpha, commitFlash > 0 ? colors.accent : colors.base);
        ctx.fillText(
          "p" + index + " · off " + lane.offset + " · lag " + (lane.offset - lane.committed),
          pointer.x - WINDOW_WIDTH / 2 + 8,
          lane.y - 9
        );
      });
    }

    // Tumbling window around the cursor: a soft glow and short brackets that
    // fade out above and below, rather than full-height bars.
    if (pointer.active > 0.02) {
      var half = WINDOW_WIDTH / 2;
      var reach = 90;
      var glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, half * 1.4);
      glow.addColorStop(0, mix(0.07 * pointer.active, colors.accent));
      glow.addColorStop(1, mix(0, colors.accent));
      ctx.fillStyle = glow;
      ctx.fillRect(pointer.x - half * 1.4, pointer.y - half * 1.4, half * 2.8, half * 2.8);

      [-1, 1].forEach(function (side) {
        var x = pointer.x + side * half;
        var fade = ctx.createLinearGradient(0, pointer.y - reach, 0, pointer.y + reach);
        fade.addColorStop(0, mix(0, colors.accent));
        fade.addColorStop(0.5, mix(0.45 * pointer.active, colors.accent));
        fade.addColorStop(1, mix(0, colors.accent));
        ctx.strokeStyle = fade;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - side * 6, pointer.y - reach * 0.55);
        ctx.lineTo(x, pointer.y - reach * 0.55);
        ctx.lineTo(x, pointer.y + reach * 0.55);
        ctx.lineTo(x - side * 6, pointer.y + reach * 0.55);
        ctx.stroke();
      });

      ctx.fillStyle = mix(0.75 * pointer.active, colors.accent);
      ctx.fillText("window " + windowHits.length + " rec/s", pointer.x + 14, pointer.y + 22);
    }

    // Records.
    records.forEach(function (r) {
      var lane = lanes[r.lane];
      var y = lane.y + r.dy;
      var p = r.processed;
      var len = r.len + p * 5;
      ctx.fillStyle = p > 0 ? mix(0.3 + p * 0.55, colors.accent) : mix(0.26, colors.base);
      ctx.fillRect(r.x - len / 2, y - 1.5, len, 3);
    });

    // Offset commits.
    ripples.forEach(function (ripple) {
      var k = (time - ripple.t) / 900;
      ctx.strokeStyle = mix((1 - k) * 0.6, colors.accent);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, 6 + k * 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = mix((1 - k) * 0.85, colors.accent);
      ctx.fillText("commit ✓", ripple.x + 14, ripple.y - 16 - k * 10);
    });
  }

  function frame(time) {
    if (!visible) {
      last = 0;
      return;
    }
    var dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
    last = time;
    step(dt, time);
    draw(time);
    window.requestAnimationFrame(frame);
  }

  function start() {
    if (reduce) {
      draw(0);
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

  function onDown(event) {
    if (event.target.closest("a,button,input,textarea,label")) return;
    onMove(event);
    if (pointer.x < 0) return;
    var now = performance.now();
    ripples.push({ x: pointer.x, y: pointer.y, t: now });
    committedAt = now;
    lanes.forEach(function (lane) { lane.committed = lane.offset; });
  }

  readColors();
  resize();
  new MutationObserver(function () {
    window.requestAnimationFrame(readColors);
  }).observe(root, { attributes: true, attributeFilter: ["data-code-theme", "data-ui-style", "class"] });

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
  window.addEventListener("pointerdown", onDown, { passive: true });
  start();
})();
