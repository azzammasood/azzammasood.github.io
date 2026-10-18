// Landing-page background: records flying through 3D space, like events
// streaming through a topic. Each record moves along its own 3D velocity
// (mostly toward the viewer), is drawn along its projected direction of
// travel, and the field tilts slightly with the cursor for parallax.
// Records near the cursor light up; clicking one inspects it, showing its
// topic/partition/offset and a data-engineering concept it "carries".
(function () {
  "use strict";

  var canvas = document.querySelector("[data-landing-streams]");
  var hero = canvas && canvas.closest(".landing-hero");
  if (!canvas || !hero || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COUNT_PER_PX = 1.1 / 5600;
  var FOCAL = 520;
  var FAR = 1500;
  var NEAR = -380;
  var GLOW_RADIUS = 140;
  var PICK_RADIUS = 30;
  var EDGE_FADE = 110; // px over which records fade out near the viewport edges
  var NEAR_FADE = 160; // depth over which records fade out as they pass the camera
  var TOPICS = ["orders.cdc", "clickstream", "telemetry.raw", "payments", "inventory.v2", "sensor.readings"];
  var CONCEPTS = [
    ["Change Data Capture", "Streams inserts, updates and deletes from a database log so downstream copies stay in sync without full reloads."],
    ["Idempotency", "Running a job twice gives the same result, which is what makes retries and backfills safe."],
    ["Exactly-once", "Idempotent producers plus transactional writes, so every event lands in the sink exactly one time."],
    ["Watermarks", "An event-time marker of how far a stream has progressed, deciding when a window can close and how late data is handled."],
    ["SCD Type 2", "Keeps history by closing the old row with an end date and inserting a new version instead of overwriting."],
    ["Partition pruning", "Queries skip whole files or folders whose partition values can't match the filter, cutting scan cost."],
    ["Compaction", "Merges many small files into fewer large ones so readers open fewer files and queries run faster."],
    ["Schema evolution", "Adding or widening columns without breaking existing readers, with the table format tracking each version."],
    ["Data contracts", "An agreed schema and quality bar between producer and consumer, checked before data is published."],
    ["Lineage", "A graph of which jobs read and wrote which datasets, so you can trace a bad number back to its source."],
    ["Medallion architecture", "Bronze keeps raw data, Silver cleans and conforms it, Gold serves business-ready aggregates."],
    ["Dead-letter queue", "Records that fail parsing or validation are parked aside with the error, instead of blocking the stream."],
    ["Backpressure", "When consumers fall behind, upstream stages slow down rather than overflow memory or drop data."],
    ["Checkpointing", "Periodically saving stream offsets and state so a restarted job resumes exactly where it stopped."],
    ["MERGE / upsert", "Inserts new keys and updates existing ones in one atomic statement, the core of incremental loads."],
    ["Z-ordering", "Co-locates related values across files so filters on several columns can skip more data."],
  ];

  var width = 0;
  var height = 0;
  var records = [];
  var base = [154, 164, 199];
  var accent = [137, 247, 255];
  var probe = document.createElement("canvas").getContext("2d");
  var pointer = { x: -9999, y: -9999, active: 0, seen: -1e9 };
  var tilt = { x: 0, y: 0 };
  var selected = null;
  var selectedAt = 0;
  var card = null;
  var cardTimer = null;
  var offsets = {};
  var visible = true;
  var booted = false;
  var last = 0;
  // Travel speed multiplier: the first-visit intro runs the field at warp
  // speed, then eases it back to 1 as the page appears.
  var WARP = 9;
  var speed = 1;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(list) {
    return list[(Math.random() * list.length) | 0];
  }

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

  // A record starts somewhere in the volume (or at the far plane when
  // respawning) and travels toward the viewer, drifting right.
  function spawn(fresh) {
    var z = fresh ? rand(NEAR + 100, FAR) : FAR;
    var spread = 1 + z / FOCAL;
    var topic = pick(TOPICS);
    var partition = (Math.random() * 6) | 0;
    var key = topic + ":" + partition;
    offsets[key] = (offsets[key] || ((Math.random() * 90000) | 0)) + 1;
    return {
      x: rand(-width * 0.7, width * 0.7) * spread,
      y: rand(-height * 0.6, height * 0.6) * spread,
      z: z,
      vx: rand(27.5, 77),
      vy: rand(-19.8, 19.8),
      vz: -rand(99, 209),
      age: fresh ? 1 : 0,
      len: rand(7, 13),
      glow: 0,
      topic: topic,
      partition: partition,
      offset: offsets[key],
      concept: pick(CONCEPTS),
    };
  }

  // Resizing reallocates the canvas, which is expensive. During page load the
  // hero's box shifts several times (fonts swapping in, content revealing),
  // so ignore sub-pixel/1-2px changes, debounce the rest, and keep existing
  // records, only topping up or trimming to the new density.
  var resizeTimer = null;

  function resize() {
    var rect = hero.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    if (Math.abs(w - width) < 3 && Math.abs(h - height) < 3 && records.length) return;
    width = w;
    height = h;
    // Thin dashes on a soft background don't need full retina resolution;
    // capping the backing store keeps fill cost down on 2x/3x screens.
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var target = Math.min(220, Math.round(width * height * COUNT_PER_PX));
    if (records.length > target) records.length = target;
    while (records.length < target) records.push(spawn(true));
  }

  function scheduleResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 150);
  }

  function project(x, y, z) {
    var scale = FOCAL / (FOCAL + z);
    return {
      x: width / 2 + (x + tilt.x * z) * scale,
      y: height / 2 + (y + tilt.y * z) * scale,
      scale: scale,
    };
  }

  function step(dt, time) {
    pointer.active += ((time - pointer.seen < 2500 ? 1 : 0) - pointer.active) * Math.min(1, dt * 3);
    var tx = pointer.active * ((pointer.x - width / 2) / width) * -0.12;
    var ty = pointer.active * ((pointer.y - height / 2) / height) * -0.08;
    tilt.x += (tx - tilt.x) * Math.min(1, dt * 2);
    tilt.y += (ty - tilt.y) * Math.min(1, dt * 2);

    for (var i = 0; i < records.length; i += 1) {
      var r = records[i];
      if (r === selected) continue; // an inspected record holds still
      r.x += r.vx * dt * speed;
      r.y += r.vy * dt * speed;
      r.z += r.vz * dt * speed;
      r.age = Math.min(1, r.age + dt / 0.6);
      var p = project(r.x, r.y, r.z);
      // Only recycle once a record has fully faded out past an edge.
      if (r.z < NEAR || p.x < -EDGE_FADE || p.x > width + EDGE_FADE || p.y < -EDGE_FADE || p.y > height + EDGE_FADE) {
        records[i] = spawn(false);
        continue;
      }
      var dx = p.x - pointer.x;
      var dy = p.y - pointer.y;
      var near = pointer.active * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / GLOW_RADIUS);
      r.glow += (near - r.glow) * Math.min(1, dt * (near > r.glow ? 10 : 2.5));
    }
  }

  // Records are bucketed by opacity and thickness, and each bucket is drawn as
  // a single path with one stroke() call. That turns ~260 stroke calls (each
  // with its own colour string) into a few dozen, which matters on slower
  // machines and high-density screens. Only records lit by the cursor, and
  // the inspected one, are drawn individually on top.
  var ALPHA_STEPS = 10;
  var WIDTH_STEPS = [0.8, 1.2, 1.7, 2.4, 3.2, 4.4];
  var buckets = [];
  for (var bi = 0; bi < ALPHA_STEPS * WIDTH_STEPS.length; bi += 1) buckets.push([]);

  function widthIndex(w) {
    for (var i = 0; i < WIDTH_STEPS.length - 1; i += 1) {
      if (w < (WIDTH_STEPS[i] + WIDTH_STEPS[i + 1]) / 2) return i;
    }
    return WIDTH_STEPS.length - 1;
  }

  function segment(r) {
    var head = project(r.x, r.y, r.z);
    // The tail sits a short way back along the record's 3D velocity, so each
    // dash points the way it is travelling.
    // At warp speed the dashes stretch into streaks.
    var back = 0.12 * (1 + (speed - 1) * 0.55);
    var tail = project(r.x - r.vx * back, r.y - r.vy * back, r.z - r.vz * back);
    var depth = Math.max(0, Math.min(1, 1 - r.z / FAR));
    // Fade in when spawned, and out toward the viewport edges and the camera,
    // so records never pop in or vanish abruptly.
    var edge = Math.min(head.x, width - head.x, head.y, height - head.y);
    var fade = Math.max(0, Math.min(1, (edge + EDGE_FADE * 0.25) / EDGE_FADE));
    fade *= Math.max(0, Math.min(1, (r.z - NEAR) / NEAR_FADE));
    fade *= r.age;
    return { head: head, tail: tail, depth: depth, fade: fade, width: Math.max(0.8, 3 * head.scale) };
  }

  function rgba(c, a) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    var lit = [];
    var i;
    for (i = 0; i < buckets.length; i += 1) buckets[i].length = 0;

    for (i = 0; i < records.length; i += 1) {
      var r = records[i];
      if (r === selected || r.glow > 0.05) {
        lit.push(r);
        continue;
      }
      var sg = segment(r);
      var alpha = (0.06 + sg.depth * 0.3) * sg.fade;
      if (alpha < 0.01) continue;
      var ai = Math.min(ALPHA_STEPS - 1, Math.floor(alpha * ALPHA_STEPS / 0.36));
      buckets[ai * WIDTH_STEPS.length + widthIndex(sg.width)].push(sg);
    }

    for (i = 0; i < buckets.length; i += 1) {
      var list = buckets[i];
      if (!list.length) continue;
      var aIndex = Math.floor(i / WIDTH_STEPS.length);
      ctx.strokeStyle = rgba(base, ((aIndex + 0.5) / ALPHA_STEPS) * 0.36);
      ctx.lineWidth = WIDTH_STEPS[i % WIDTH_STEPS.length];
      ctx.beginPath();
      for (var j = 0; j < list.length; j += 1) {
        ctx.moveTo(list[j].tail.x, list[j].tail.y);
        ctx.lineTo(list[j].head.x, list[j].head.y);
      }
      ctx.stroke();
    }

    lit.forEach(function (r) {
      var sg = segment(r);
      var g = r === selected ? 1 : r.glow;
      var fade = r === selected ? 1 : sg.fade;
      var c = [
        Math.round(base[0] + (accent[0] - base[0]) * g),
        Math.round(base[1] + (accent[1] - base[1]) * g),
        Math.round(base[2] + (accent[2] - base[2]) * g),
      ];
      var alpha = (0.06 + sg.depth * 0.3 + g * 0.6) * fade;
      // Glow as a wide faint stroke under the dash: far cheaper than shadowBlur.
      ctx.strokeStyle = rgba(accent, g * 0.22 * fade);
      ctx.lineWidth = sg.width + 6 * g;
      ctx.beginPath();
      ctx.moveTo(sg.tail.x, sg.tail.y);
      ctx.lineTo(sg.head.x, sg.head.y);
      ctx.stroke();
      ctx.strokeStyle = rgba(c, alpha);
      ctx.lineWidth = sg.width;
      ctx.beginPath();
      ctx.moveTo(sg.tail.x, sg.tail.y);
      ctx.lineTo(sg.head.x, sg.head.y);
      ctx.stroke();
      if (r === selected) {
        // A circle that draws itself around the record, sized to enclose it.
        var cx = (sg.head.x + sg.tail.x) / 2;
        var cy = (sg.head.y + sg.tail.y) / 2;
        var radius = Math.hypot(sg.head.x - sg.tail.x, sg.head.y - sg.tail.y) / 2 + sg.width + 7;
        var t = Math.min(1, (performance.now() - selectedAt) / 480);
        var sweep = 1 - Math.pow(1 - t, 3);
        ctx.strokeStyle = rgba(accent, 0.75);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sweep);
        ctx.stroke();
      }
    });
  }

  // ------------------------------------------------------------ inspector

  function hideCard() {
    window.clearTimeout(cardTimer);
    selected = null;
    if (card) card.classList.remove("is-visible");
  }

  function showCard(r, x, y) {
    if (!card) {
      card = document.createElement("div");
      card.className = "record-card";
      card.setAttribute("role", "status");
      document.body.appendChild(card);
    }
    card.innerHTML = "";
    var meta = document.createElement("span");
    meta.className = "record-card__meta";
    meta.textContent = r.topic + " · p" + r.partition + " · offset " + r.offset;
    var title = document.createElement("strong");
    title.className = "record-card__title";
    title.textContent = r.concept[0];
    var body = document.createElement("span");
    body.className = "record-card__body";
    body.textContent = r.concept[1];
    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(body);

    var rect = hero.getBoundingClientRect();
    var left = Math.min(x + rect.left + 16, window.innerWidth - 300);
    var top = Math.max(rect.top + y + window.scrollY - 20, window.scrollY + 70);
    card.style.left = left + "px";
    card.style.top = top + "px";
    card.classList.add("is-visible");
    window.clearTimeout(cardTimer);
    cardTimer = window.setTimeout(hideCard, 7000);
  }

  function onClick(event) {
    if (event.target.closest("a, button, input, textarea, label, .record-card")) return;
    var rect = hero.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    var best = null;
    var bestDistance = PICK_RADIUS;
    records.forEach(function (r) {
      var p = project(r.x, r.y, r.z);
      var d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        best = r;
      }
    });
    if (!best) {
      hideCard();
      return;
    }
    selected = best;
    selectedAt = performance.now();
    var p = project(best.x, best.y, best.z);
    showCard(best, p.x, p.y);
  }

  // ------------------------------------------------------------ loop

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
    if (!booted) return;
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
    new ResizeObserver(scheduleResize).observe(hero);
  } else {
    window.addEventListener("resize", scheduleResize);
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
  hero.addEventListener("click", onClick);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hideCard();
  });
  // First visit: start right away at warp speed behind the intro counter,
  // then decelerate (ease-out) to cruising speed when the page appears.
  var boot = function () {
    if (booted) return;
    booted = true;
    canvas.classList.add("is-ready");
    start();
  };
  if (root.classList.contains("intro-active") && !reduce) {
    speed = WARP;
    boot();
    document.addEventListener("intro:reveal", function () {
      var from = speed;
      var t0 = performance.now();
      var DURATION = 2200;
      (function slow(now) {
        var t = Math.min(1, (now - t0) / DURATION);
        speed = 1 + (from - 1) * Math.pow(1 - t, 3);
        if (t < 1) window.requestAnimationFrame(slow);
      })(t0);
    }, { once: true });
    return;
  }

  // Otherwise start only after the page's entrance animation has settled
  // (code-motion announces it), then on the next idle moment, so the two never
  // compete for the first second. A fallback timer covers pages without it.
  var whenIdle = function () {
    if (window.requestIdleCallback) window.requestIdleCallback(boot, { timeout: 600 });
    else window.setTimeout(boot, 200);
  };
  if (window.__cmSettled) whenIdle();
  else document.addEventListener("cm:settled", whenIdle, { once: true });
  window.setTimeout(whenIdle, 3500);
})();
