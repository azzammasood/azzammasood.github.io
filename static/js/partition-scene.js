// Home page hero (layouts/baseof.html + layouts/home.html, styles in
// assets/css/press.css): the site owner's name built from 3D cubes.
//   first visit   the cubes fly in from far outside the screen and lock into
//                 the name, packed edge to edge, and stay
//   returning     (from another page, or a reload) they start as a wide ring
//                 outside the screen and swirl inward into the name
// The letterforms come from the font preset chosen in the theme menu: the
// name is drawn with that web font on an offscreen canvas and every filled
// pixel becomes a cube, two cubes deep. Changing the font re-flows the cubes
// into the new shapes. The scene only runs on the home page:
// static/js/page-swap.js calls enter() / leave() when the page changes
// without a reload. All cubes are one instanced mesh with the outline baked
// into the material; colours come from the active code theme and ease when it
// changes. Cubes near the pointer are nudged aside and settle back.
(function () {
  "use strict";

  var canvas = document.querySelector("[data-pp-scene]");
  if (!canvas || !window.THREE) return;

  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var bar = document.querySelector("[data-pp-progress]");
  var NAME = (canvas.getAttribute("data-pp-name") || "Ahmad Uzzam").toUpperCase();

  // Font presets (theme menu → Fonts), matching assets/css/custom.css.
  var FONTS = {
    mono: ['"JetBrains Mono"', 800],
    sans: ["Satoshi", 900],
    grotesk: ['"Space Grotesk"', 700],
    "fira-light": ['"Fira Code"', 500],
  };

  var COUNT = 5200; // cubes allocated; the name uses as many as it needs
  var COLS = 96; // sampling resolution across the widest word
  var DEPTH = 2; // cubes deep
  var PITCH = 0.18; // cube pitch in scene units; cubes touch at this pitch
  var SIZE = PITCH;

  function fontKey() {
    return FONTS[root.dataset.uiFont] ? root.dataset.uiFont : "mono";
  }

  function fontFor() {
    return FONTS[fontKey()];
  }

  function fontSpec(font) {
    return font[1] + " 120px " + font[0];
  }

  // Draw the name with the given font (one word per line, first word flush
  // left, last word flush right) and return cube positions for its pixels.
  function sampleName(font) {
    var words = NAME.split(/\s+/).filter(Boolean);
    var px = 120;
    var lineH = px * 1.02;
    var c = document.createElement("canvas");
    var g = c.getContext("2d");
    var fontSpec = font[1] + " " + px + "px " + font[0] + ", sans-serif";
    g.font = fontSpec;
    sampledFont = fontKey();
    var widths = words.map(function (word) {
      return g.measureText(word).width;
    });
    var maxW = Math.max.apply(null, widths);
    c.width = Math.ceil(maxW) + 4;
    c.height = Math.ceil(lineH * words.length) + 4;
    g = c.getContext("2d");
    g.font = fontSpec;
    sampledLoaded = !document.fonts || !document.fonts.check || document.fonts.check(fontSpec);
    g.fillStyle = "#fff";
    g.textBaseline = "alphabetic";
    words.forEach(function (word, i) {
      var x = i === words.length - 1 && words.length > 1 ? maxW - widths[i] : 0;
      g.fillText(word, x + 2, i * lineH + px * 0.86);
    });
    var cell = c.width / COLS;
    var rows = Math.ceil(c.height / cell);
    var data = g.getImageData(0, 0, c.width, c.height).data;
    var out = [];
    var half = (DEPTH - 1) / 2;
    for (var row = 0; row < rows; row += 1) {
      for (var col = 0; col < COLS; col += 1) {
        var sx = Math.min(c.width - 1, Math.floor((col + 0.5) * cell));
        var sy = Math.min(c.height - 1, Math.floor((row + 0.5) * cell));
        if (data[(sy * c.width + sx) * 4 + 3] < 110) continue;
        for (var d = 0; d < DEPTH; d += 1) {
          out.push(new THREE.Vector3((col - (COLS - 1) / 2) * PITCH, ((rows - 1) / 2 - row) * PITCH, (d - half) * PITCH));
        }
      }
    }
    // More cubes than allocated: keep an even subset.
    if (out.length > COUNT) {
      var step = out.length / COUNT;
      var picked = [];
      for (var k = 0; k < COUNT; k += 1) picked.push(out[Math.floor(k * step)]);
      out = picked;
    }
    return out;
  }

  // Deterministic randomness so the arrivals look the same on every visit.
  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Per formation: group rotation (x, y, z), position on wide and narrow
  // screens (x, y) and scale (with a narrow-screen override).
  var FIG = {
    name: { rot: [0.1, -0.14, 0], off: [0, 0.75], narrow: [0, 0.9], scale: 0.5, narrowScale: 0.21 },
    live: { rot: [0.1, -0.14, 0], off: [0, 0.75], narrow: [0, 0.9], scale: 0.5, narrowScale: 0.21 },
    far: { rot: [1.4, 2.3, 0.8], off: [0, 0], narrow: [0, 0], scale: 1, narrowScale: 0.7 },
    ring: { rot: [0.9, 0, -1.2], off: [0, 0.75], narrow: [0, 0.9], scale: 1, narrowScale: 0.6 },
  };

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 14);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  var sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(5, 9, 8);
  scene.add(sun);

  // ---------------------------------------------------------------- colours

  var probe = document.createElement("canvas").getContext("2d");

  function cssColor(name, fallback) {
    var value = getComputedStyle(root).getPropertyValue(name).trim();
    if (!value || !probe) return new THREE.Color(fallback);
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    var d = probe.getImageData(0, 0, 1, 1).data;
    return new THREE.Color(d[0] / 255, d[1] / 255, d[2] / 255);
  }

  var KEYS = ["base", "hiA", "hiB", "ink", "body"];
  var palette = {};
  var target = {};
  KEYS.forEach(function (k) {
    palette[k] = new THREE.Color(0xffffff);
    target[k] = new THREE.Color(0xffffff);
  });
  var colorsSet = false;
  var colorsDirty = true;

  function readColors() {
    var ink = cssColor("--color-text-dark", "#ffffff");
    var light = cssColor("--color-light", "#191919");
    var accent = cssColor("--color-primary", "#ff5f66");
    var body = cssColor("--color-body", "#050505");
    target.base.copy(light);
    target.hiA.copy(accent);
    target.hiB.copy(accent).lerp(ink, 0.55);
    target.ink.copy(ink);
    target.body.copy(body);
    colorsDirty = true;
    if (!colorsSet) {
      colorsSet = true;
      easeColors(1);
    }
  }

  function easeColors(k) {
    if (!colorsDirty) return;
    var remaining = 0;
    KEYS.forEach(function (key) {
      palette[key].lerp(target[key], k);
      remaining += Math.abs(palette[key].r - target[key].r) + Math.abs(palette[key].g - target[key].g) + Math.abs(palette[key].b - target[key].b);
    });
    if (remaining < 0.002) {
      KEYS.forEach(function (key) {
        palette[key].copy(target[key]);
      });
      colorsDirty = false;
    }
    cellMat.emissive.copy(palette.ink);
    tubeMat.color.copy(palette.ink);
    pointMat.color.copy(palette.hiA);
    scene.background.copy(palette.body);
    for (var i = 0; i < COUNT; i += 1) cellsMesh.setColorAt(i, palette[role[i]]);
    cellsMesh.instanceColor.needsUpdate = true;
  }

  // Cube faces: white interior with a black border on the colour map and the
  // inverse on the emissive map, so the border always paints in ink.
  function maskTexture(invert) {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    g.fillStyle = invert ? "#000" : "#fff";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = invert ? "#fff" : "#000";
    var b = 10;
    g.fillRect(0, 0, 128, b);
    g.fillRect(0, 128 - b, 128, b);
    g.fillRect(0, 0, b, 128);
    g.fillRect(128 - b, 0, b, 128);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  var cellMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: maskTexture(false), emissiveMap: maskTexture(true), emissive: 0xffffff });
  var tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0 });
  var pointMat = new THREE.PointsMaterial({ color: 0xff5f66, size: 0.09, transparent: true, opacity: 0 });

  // --------------------------------------------------------- record stream

  // A wire tunnel crossing the page with records flowing through it. The
  // tunnel itself is still: it fades in once the name has formed and stays.
  var curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9, 4.5, -3),
    new THREE.Vector3(-3, 2.5, -1),
    new THREE.Vector3(1.5, -0.5, 1),
    new THREE.Vector3(6, -2.5, -2),
    new THREE.Vector3(10, -5, -4),
  ]);
  var stream = new THREE.Group();
  stream.position.z = -3;
  stream.rotation.z = -0.1;
  scene.add(stream);
  var streamOpacity = 0;
  var streamOn = false;
  stream.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 0.22, 6, false), tubeMat));
  var PN = 110;
  var pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
  var poff = [];
  var streamRandom = rng(7);
  for (var p = 0; p < PN; p += 1) poff.push(streamRandom());
  stream.add(new THREE.Points(pgeo, pointMat));

  // ------------------------------------------------------------------ cubes

  var group = new THREE.Group();
  scene.add(group);
  var cellsMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(SIZE, SIZE, SIZE), cellMat, COUNT);
  cellsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(cellsMesh);
  var role = [];
  var random = rng(20260107);
  var F = { name: [], live: [], far: [], ring: [] };
  // Per formation, which instances are in use (1) or parked at zero size (0).
  var V = { name: [], live: [], far: [], ring: [] };

  for (var i = 0; i < COUNT; i += 1) {
    var r = random();
    role.push(r < 0.1 ? "hiA" : r < 0.18 ? "hiB" : "base");

    var th = random() * Math.PI * 2;
    var ph = Math.acos(2 * random() - 1);
    var dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph));
    // Far: well outside the viewport in every direction, for the first-visit fly-in.
    var farRad = 16 + random() * 10;
    F.far.push(new THREE.Vector3(dir.x * farRad * 1.4, dir.y * farRad, dir.z * farRad * 0.5));
    // Ring: a wide band just outside the screen that the cubes swirl in from when you return.
    var ang = (i / COUNT) * Math.PI * 2 + random() * 0.3;
    var ringRad = 11 + random() * 2.5;
    F.ring.push(new THREE.Vector3(Math.cos(ang) * ringRad, Math.sin(ang) * ringRad * 0.7, (random() - 0.5) * 3));
    F.name.push(new THREE.Vector3());
    F.live.push(new THREE.Vector3());
    V.far.push(1);
    V.ring.push(1);
    V.name.push(1);
    V.live.push(1);
  }

  // Which font preset the current name cubes were sampled with, and whether
  // that face was actually loaded at the time (otherwise a fallback drew it).
  var sampledFont = "";
  var sampledLoaded = false;

  // Size and place the name so it fills the band between the stamp and the
  // summary in the hero (layouts/home.html), whatever the viewport. Measured
  // from the page, so it is right on a fresh load and after a page swap.
  var nameBox = { w: 1, h: 1, cx: 0, cy: 0 };

  function fitName() {
    var top = document.querySelector(".pp-hero__top");
    var bottom = document.querySelector(".pp-hero__bottom");
    var distance = camera.position.z + 2.5;
    var visibleH = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
    var pxPerUnit = window.innerHeight / visibleH;
    var bandTop = top ? top.getBoundingClientRect().bottom + window.scrollY : window.innerHeight * 0.18;
    var bandBottom = bottom ? bottom.getBoundingClientRect().top + window.scrollY : window.innerHeight * 0.66;
    if (bandBottom - bandTop < 80) {
      bandTop = window.innerHeight * 0.18;
      bandBottom = window.innerHeight * 0.66;
    }
    // Leave air above and below the name so it never crowds the stamp or the summary.
    var availH = ((bandBottom - bandTop) / pxPerUnit) * 0.8;
    var availW = (window.innerWidth / pxPerUnit) * 0.9;
    var scale = Math.min(availH / nameBox.h, availW / nameBox.w);
    var centerY = (window.innerHeight / 2 - (bandTop + bandBottom) / 2) / pxPerUnit;
    ["name", "live", "ring"].forEach(function (key) {
      var fig = FIG[key];
      if (key !== "ring") {
        fig.scale = scale;
        fig.narrowScale = scale;
      }
      fig.off = [-nameBox.cx * scale, centerY - nameBox.cy * scale];
      fig.narrow = fig.off;
    });
  }

  // Fill the name formation from the current font. Cubes the name does not
  // need are parked at the nearest used position at zero size.
  function layoutName() {
    var cells = sampleName(fontFor());
    if (!cells.length) return;
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;
    cells.forEach(function (v) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });
    nameBox = { w: maxX - minX + PITCH, h: maxY - minY + PITCH, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    fitName();
    for (var i = 0; i < COUNT; i += 1) {
      if (i < cells.length) {
        F.name[i].copy(cells[i]);
        V.name[i] = 1;
      } else {
        F.name[i].copy(cells[i % cells.length]);
        V.name[i] = 0;
      }
    }
    // Arrivals only use as many cubes as the name does.
    for (var j = 0; j < COUNT; j += 1) {
      V.far[j] = V.name[j];
      V.ring[j] = V.name[j];
    }
  }

  // ------------------------------------------------------------------ morph

  var morph = { from: "far", to: "far", start: 0, dur: 1 };

  function morphProgress() {
    if (reduce) return 1;
    return Math.max(0, Math.min(1, (performance.now() - morph.start) / morph.dur));
  }

  function arrive(from, dur) {
    for (var c = 0; c < COUNT; c += 1) cur[c].copy(F[from][c]);
    morph = { from: from, to: "name", start: performance.now(), dur: dur };
  }

  // The font changed: re-flow from wherever the cubes are now into the new
  // letterforms.
  function reflow() {
    if (morph.to !== "name" || morphProgress() < 1) {
      layoutName();
      return;
    }
    for (var c = 0; c < COUNT; c += 1) F.live[c].copy(cur[c]);
    var wasVisible = V.name.slice();
    layoutName();
    for (var k = 0; k < COUNT; k += 1) V.live[k] = wasVisible[k];
    morph = { from: "live", to: "name", start: performance.now(), dur: 1100 };
  }

  function isHome() {
    return document.body.classList.contains("is-home");
  }

  // --------------------------------------------------------------- pointer

  var ray = new THREE.Raycaster();
  var ndc = new THREE.Vector2(9, 9);
  var pointerAt = new THREE.Vector3();
  var mouse = { x: 0, y: 0 };
  var pointerIn = false;
  if (fine) {
    window.addEventListener("pointermove", function (event) {
      ndc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
      mouse.x = ndc.x;
      mouse.y = ndc.y;
      pointerIn = true;
    }, { passive: true });
    document.addEventListener("pointerleave", function () {
      pointerIn = false;
    });
  }

  // Where the pointer ray passes at a given depth, so the nudge lines up with
  // the cursor whatever depth a cube sits at.
  function pointerAtDepth(z, out) {
    var t = (z - ray.ray.origin.z) / ray.ray.direction.z;
    return out.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t);
  }

  var narrow = false;

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    narrow = window.innerWidth < 760;
    camera.position.z = narrow ? 19 : 14;
    fitName();
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function offset(fig) {
    return narrow ? FIG[fig].narrow : FIG[fig].off;
  }

  function scaleOf(fig) {
    return narrow ? FIG[fig].narrowScale : FIG[fig].scale;
  }

  var tmp = new THREE.Vector3();
  var w = new THREE.Vector3();
  var push = new THREE.Vector3();
  var dummy = new THREE.Object3D();
  var cur = [];
  for (var c0 = 0; c0 < COUNT; c0 += 1) cur.push(F.far[c0].clone());
  var running = false;
  var last = 0;
  var active = false;

  function tick(t) {
    var dt = last ? (t - last) / 1000 : 1 / 60;
    last = t;
    // After a stall (background tab) land on the target at once.
    var stalled = dt > 0.2;
    var easeCells = stalled ? 1 : 1 - Math.pow(1 - 0.16, dt * 60);
    var easeTint = stalled ? 1 : 1 - Math.pow(1 - 0.055, dt * 60);

    var max = root.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) * 100 : 0).toFixed(2) + "%";

    easeColors(easeTint);

    var from = FIG[morph.from];
    var to = FIG[morph.to];
    var f = smooth(morphProgress());
    var A = F[morph.from];
    var B = F[morph.to];
    var VA = V[morph.from];
    var VB = V[morph.to];
    var offA = offset(morph.from);
    var offB = offset(morph.to);
    var drift = Math.min(window.scrollY, 2600) * 0.0012;
    var swirl = morph.from === "ring" ? (1 - f) * 2.2 : 0;

    ray.setFromCamera(ndc, camera);

    group.rotation.x = lerp(from.rot[0], to.rot[0], f) + mouse.y * 0.06;
    group.rotation.y = lerp(from.rot[1], to.rot[1], f) + (reduce ? 0 : Math.sin(t * 0.0002) * 0.08) + mouse.x * 0.1;
    group.rotation.z = lerp(from.rot[2], to.rot[2], f) + swirl;
    // The whole group sits a little behind the focal plane.
    group.position.set(lerp(offA[0], offB[0], f), lerp(offA[1], offB[1], f) + drift, -2.5);
    group.scale.setScalar(lerp(scaleOf(morph.from), scaleOf(morph.to), f));
    group.updateMatrixWorld();

    for (var i = 0; i < COUNT; i += 1) {
      tmp.copy(A[i]).lerp(B[i], f);
      var vis = lerp(VA[i], VB[i], f);
      if (vis > 0.01 && pointerIn) {
        w.copy(tmp);
        group.localToWorld(w);
        pointerAtDepth(w.z, pointerAt);
        var dx = w.x - pointerAt.x;
        var dy = w.y - pointerAt.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var RADIUS = 0.7;
        if (dist < RADIUS && dist > 0.0001) {
          var amount = (RADIUS - dist) / RADIUS;
          push.set((dx / dist) * amount * 0.32, (dy / dist) * amount * 0.32, amount * 0.25);
          w.add(push);
          group.worldToLocal(w);
          tmp.copy(w);
        }
      }
      cur[i].lerp(tmp, easeCells);
      dummy.position.copy(cur[i]);
      dummy.scale.setScalar(Math.max(0.0001, vis));
      dummy.updateMatrix();
      cellsMesh.setMatrixAt(i, dummy.matrix);
    }
    cellsMesh.instanceMatrix.needsUpdate = true;

    // The tunnel fades in once the name has mostly formed and then stays put;
    // only the records inside it keep moving.
    if (!streamOn && morph.to === "name" && morphProgress() > 0.6) streamOn = true;
    if (streamOn && streamOpacity < 1) {
      streamOpacity = Math.min(1, streamOpacity + dt / 1.2);
      tubeMat.opacity = 0.14 * streamOpacity;
      pointMat.opacity = streamOpacity;
    }
    stream.visible = streamOpacity > 0.001;
    if (stream.visible) {
      var arr = pgeo.attributes.position.array;
      var now = reduce ? 0 : t * 0.00006;
      for (var q = 0; q < PN; q += 1) {
        var pt = curve.getPointAt((poff[q] + now) % 1);
        arr[q * 3] = pt.x;
        arr[q * 3 + 1] = pt.y;
        arr[q * 3 + 2] = pt.z;
      }
      pgeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  function loop(t) {
    if (document.hidden || !active) {
      running = false;
      last = 0;
      return;
    }
    window.requestAnimationFrame(loop);
    tick(t);
  }

  function start() {
    if (running || !active) return;
    running = true;
    last = 0;
    window.requestAnimationFrame(loop);
  }

  // Called by page-swap.js: the home page arrived without a reload.
  function enter() {
    if (active) return;
    active = true;
    // The tunnel fades in again with every arrival.
    streamOn = false;
    streamOpacity = 0;
    tubeMat.opacity = 0;
    pointMat.opacity = 0;
    resize();
    layoutName();
    arrive("ring", 1600);
    tick(performance.now());
    start();
    // The swapped-in hero may still be settling; measure the band again.
    window.setTimeout(fitName, 350);
  }

  // Called by page-swap.js: leaving the home page.
  function leave() {
    active = false;
  }

  window.__partitionScene = {
    enter: enter,
    leave: leave,
    reflow: reflow,
    get morph() {
      return morph;
    },
    progress: morphProgress,
  };

  // Re-sample whenever the font preset changes, and keep retrying until the
  // chosen face has really loaded (the first sample may have used a fallback).
  var syncTimer = 0;

  function syncFont(attempt) {
    window.clearTimeout(syncTimer);
    var font = fontFor();
    var spec = fontSpec(font);
    var changed = sampledFont !== fontKey();
    if (!changed && sampledLoaded) return;
    var apply = function () {
      var loaded = !document.fonts || !document.fonts.check || document.fonts.check(spec);
      if (changed || loaded) reflow();
      if (!loaded && (attempt || 0) < 12) {
        syncTimer = window.setTimeout(function () {
          syncFont((attempt || 0) + 1);
        }, 400);
      }
    };
    if (document.fonts && document.fonts.load) document.fonts.load(spec, NAME).then(apply, apply);
    else window.setTimeout(apply, 300);
  }

  readColors();
  layoutName();
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) start();
  });
  new MutationObserver(function (mutations) {
    window.requestAnimationFrame(readColors);
    if (mutations.some(function (m) { return m.attributeName === "data-ui-font"; })) syncFont(0);
  }).observe(root, { attributes: true, attributeFilter: ["data-code-theme", "data-ui-font", "class"] });
  syncFont(0);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      syncFont(0);
    });
  }

  if (isHome()) {
    active = true;
    // First visit: fly in from far outside; otherwise swirl in from the ring.
    if (root.classList.contains("intro-active")) arrive("far", 2600);
    else arrive("ring", 1600);
    tick(performance.now());
    start();
  }
})();
