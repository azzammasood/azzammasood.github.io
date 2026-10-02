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

  var COUNT_PER_PX = 1 / 5600;
  var FOCAL = 520;
  var FAR = 1500;
  var NEAR = -380;
  var GLOW_RADIUS = 140;
  var PICK_RADIUS = 30;
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
  var card = null;
  var cardTimer = null;
  var offsets = {};
  var visible = true;
  var last = 0;

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
      vx: rand(25, 70),
      vy: rand(-18, 18),
      vz: -rand(90, 190),
      len: rand(7, 13),
      glow: 0,
      topic: topic,
      partition: partition,
      offset: offsets[key],
      concept: pick(CONCEPTS),
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
    for (var i = 0; i < target; i += 1) records.push(spawn(true));
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
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      var p = project(r.x, r.y, r.z);
      if (r.z < NEAR || p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60) {
        records[i] = spawn(false);
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
    records.sort(function (a, b) { return b.z - a.z; });
    ctx.lineCap = "round";
    records.forEach(function (r) {
      var head = project(r.x, r.y, r.z);
      // The tail sits a short way back along the record's 3D velocity, so each
      // dash points the way it is travelling.
      var back = 0.12;
      var tail = project(r.x - r.vx * back, r.y - r.vy * back, r.z - r.vz * back);
      var depth = Math.max(0, Math.min(1, 1 - r.z / FAR));
      var g = r === selected ? 1 : r.glow;
      var c = [
        Math.round(base[0] + (accent[0] - base[0]) * g),
        Math.round(base[1] + (accent[1] - base[1]) * g),
        Math.round(base[2] + (accent[2] - base[2]) * g),
      ];
      var alpha = 0.06 + depth * 0.3 + g * 0.6;
      ctx.strokeStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.min(1, alpha).toFixed(3) + ")";
      ctx.lineWidth = Math.max(0.8, 3 * head.scale);
      if (g > 0.05) {
        ctx.shadowColor = "rgba(" + accent[0] + "," + accent[1] + "," + accent[2] + "," + (g * 0.8).toFixed(3) + ")";
        ctx.shadowBlur = 10 * g;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      if (r === selected) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(" + accent[0] + "," + accent[1] + "," + accent[2] + ",0.7)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.shadowBlur = 0;
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
  hero.addEventListener("click", onClick);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hideCard();
  });
  start();
})();
