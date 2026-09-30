// /pipeline/: renders the live pipeline's status.json (written by
// scripts/pipeline/run.py) as status, KPIs, run history, stage timings,
// origin countries and check results. Plain DOM + SVG, no chart library.
(function () {
  "use strict";

  var root = document.querySelector("[data-pipeline-detail]");
  if (!root || !window.fetch) return;
  var SVG = "http://www.w3.org/2000/svg";
  var STATUS_LABEL = { success: "Success", degraded: "Degraded", failed: "Failed" };

  function part(name) {
    return root.querySelector("[data-pd='" + name + "']");
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function num(value, digits) {
    if (value == null) return "–";
    return Number(value).toLocaleString("en-US", { maximumFractionDigits: digits || 0 });
  }

  function ago(iso) {
    var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 90) return "just now";
    if (s < 5400) return Math.round(s / 60) + " min ago";
    if (s < 129600) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }

  function time(iso) {
    var d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function statusBadge(state) {
    var badge = el("span", "pipeline-badge pipeline-badge--" + state);
    badge.appendChild(el("span", "pipeline-badge__dot"));
    badge.appendChild(document.createTextNode(STATUS_LABEL[state] || state));
    return badge;
  }

  // Shared hover tooltip for chart marks.
  var tip = el("div", "pipeline-tip");
  tip.hidden = true;
  document.body.appendChild(tip);
  function hover(node, text) {
    node.addEventListener("pointerenter", function () {
      tip.textContent = text;
      tip.hidden = false;
    });
    node.addEventListener("pointermove", function (event) {
      tip.style.left = event.pageX + 12 + "px";
      tip.style.top = event.pageY - 34 + "px";
    });
    node.addEventListener("pointerleave", function () {
      tip.hidden = true;
    });
  }

  function renderStatus(feed, run) {
    var box = part("status");
    box.appendChild(statusBadge(run.status));
    box.appendChild(el("span", null, "Last run " + ago(run.finished_at) + " · " + time(run.finished_at)));
    box.appendChild(el("span", null, (feed.runs || []).length + " runs retained · every 30 min"));
  }

  function renderKpis(run) {
    var m = run.metrics || {};
    var checks = run.checks || [];
    var passed = checks.filter(function (c) { return c.passed; }).length;
    var tiles = [
      ["Aircraft tracked", num(m.aircraft)],
      ["Airborne", m.aircraft ? Math.round((m.airborne / m.aircraft) * 100) + "%" : "–"],
      ["Registration countries", num(m.countries)],
      ["Avg. cruise altitude", m.avg_altitude_m == null ? "–" : num(m.avg_altitude_m) + " m"],
      ["Fastest aircraft", m.max_speed_kmh == null ? "–" : num(m.max_speed_kmh) + " km/h"],
      ["Checks passed", passed + " / " + checks.length],
      ["Rows loaded", num(run.rows_loaded)],
      ["Run duration", (run.duration_ms / 1000).toFixed(1) + " s"],
    ];
    var box = part("kpis");
    tiles.forEach(function (t) {
      var tile = el("div", "pipeline-kpi");
      tile.appendChild(el("span", "pipeline-kpi__label", t[0]));
      tile.appendChild(el("strong", "pipeline-kpi__value", t[1]));
      box.appendChild(tile);
    });
  }

  // Aircraft per run, oldest on the left; failed runs have no bar and are
  // marked with a status tick so a gap never reads as zero traffic.
  function renderHistory(runs) {
    var list = runs.slice().reverse();
    var width = 720;
    var height = 200;
    var pad = { top: 12, right: 8, bottom: 22, left: 40 };
    var inner = width - pad.left - pad.right;
    var plot = height - pad.top - pad.bottom;
    var values = list.map(function (r) { return (r.metrics && r.metrics.aircraft) || 0; });
    var max = Math.max.apply(null, values.concat([1]));
    var niceMax = Math.ceil(max / 50) * 50 || 50;
    var slot = inner / Math.max(list.length, 1);
    var barWidth = Math.max(2, Math.min(18, slot - 2));

    var chart = svg("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "Aircraft tracked per pipeline run" });
    [0, 0.5, 1].forEach(function (k) {
      var y = pad.top + plot - k * plot;
      chart.appendChild(svg("line", { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: "pipeline-chart__grid" }));
      var label = svg("text", { x: pad.left - 8, y: y + 4, class: "pipeline-chart__axis", "text-anchor": "end" });
      label.textContent = num(niceMax * k);
      chart.appendChild(label);
    });

    list.forEach(function (run, i) {
      var x = pad.left + i * slot + (slot - barWidth) / 2;
      var value = values[i];
      var h = (value / niceMax) * plot;
      var label = time(run.started_at) + " · " + (STATUS_LABEL[run.status] || run.status) + " · " + num(value) + " aircraft";
      if (run.status === "failed" || !run.metrics || run.metrics.aircraft == null) {
        var tick = svg("rect", { x: x, y: pad.top + plot - 3, width: barWidth, height: 3, rx: 1, class: "pipeline-chart__missing" });
        chart.appendChild(tick);
        hover(tick, label);
        return;
      }
      var bar = svg("rect", {
        x: x, y: pad.top + plot - h, width: barWidth, height: Math.max(h, 1), rx: Math.min(4, barWidth / 2),
        class: "pipeline-chart__bar" + (run.status === "degraded" ? " is-degraded" : ""),
      });
      chart.appendChild(bar);
      // Wider invisible hit target than the mark itself.
      var hit = svg("rect", { x: pad.left + i * slot, y: pad.top, width: slot, height: plot, fill: "transparent" });
      chart.appendChild(hit);
      hover(hit, label);
    });

    if (list.length) {
      var first = svg("text", { x: pad.left, y: height - 4, class: "pipeline-chart__axis" });
      first.textContent = time(list[0].started_at);
      var last = svg("text", { x: width - pad.right, y: height - 4, class: "pipeline-chart__axis", "text-anchor": "end" });
      last.textContent = time(list[list.length - 1].started_at);
      chart.appendChild(first);
      chart.appendChild(last);
    }
    part("history").appendChild(chart);

    var degraded = runs.filter(function (r) { return r.status !== "success"; }).length;
    part("history-note").textContent =
      runs.length + " runs · peak " + num(max) + " aircraft" + (degraded ? " · " + degraded + " degraded or failed (lighter or missing bars)" : " · every run succeeded");

    var table = el("table", "query-console__table");
    var head = el("tr");
    ["Started", "Status", "Aircraft", "Checks", "Duration"].forEach(function (h) { head.appendChild(el("th", null, h)); });
    var thead = el("thead");
    thead.appendChild(head);
    table.appendChild(thead);
    var body = el("tbody");
    runs.forEach(function (r) {
      var checks = r.checks || [];
      var row = el("tr");
      [time(r.started_at), STATUS_LABEL[r.status] || r.status, num(r.metrics && r.metrics.aircraft),
        checks.filter(function (c) { return c.passed; }).length + "/" + checks.length,
        (r.duration_ms / 1000).toFixed(1) + " s"].forEach(function (v) { row.appendChild(el("td", null, v)); });
      body.appendChild(row);
    });
    table.appendChild(body);
    var wrap = el("div", "query-console__table-wrap");
    wrap.appendChild(table);
    part("history-table").appendChild(wrap);
  }

  // Horizontal bars with the value written at the end of each bar.
  function barList(container, rows, format) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    var list = el("ul", "pipeline-bars");
    rows.forEach(function (r) {
      var item = el("li");
      item.appendChild(el("span", "pipeline-bars__label", r.label));
      var track = el("span", "pipeline-bars__track");
      var fill = el("span", "pipeline-bars__fill");
      fill.style.width = Math.max(1.5, (r.value / max) * 100) + "%";
      track.appendChild(fill);
      item.appendChild(track);
      item.appendChild(el("span", "pipeline-bars__value", format(r.value)));
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function renderStages(run) {
    var sources = (run.sources || []).map(function (s) {
      return { label: "extract: " + s.name, value: s.ms || 0 };
    });
    var stages = (run.stages || []).filter(function (s) { return s.name !== "extract"; }).map(function (s) {
      return { label: s.name, value: s.ms || 0 };
    });
    barList(part("stages"), sources.concat(stages), function (v) { return num(v) + " ms"; });
  }

  function renderCountries(run) {
    var top = (run.metrics && run.metrics.top_countries) || [];
    if (!top.length) {
      part("countries").appendChild(el("p", "pipeline-panel__note", "No flight data in the latest run."));
      return;
    }
    barList(part("countries"), top.map(function (c) { return { label: c.country, value: c.count }; }), function (v) {
      return num(v);
    });
  }

  function renderChecks(run) {
    var list = part("checks");
    (run.checks || []).forEach(function (c) {
      var item = el("li", c.passed ? "is-pass" : "is-fail");
      item.appendChild(el("span", "pipeline-checks__mark", c.passed ? "✓ pass" : "✗ fail"));
      item.appendChild(el("code", null, c.name));
      item.appendChild(el("span", "pipeline-checks__detail", c.detail));
      list.appendChild(item);
    });
    root.parentNode.querySelectorAll(".pipeline-flow__node[data-stage]").forEach(function (node) {
      node.classList.add(run.status === "failed" && node.dataset.stage !== "extract" ? "is-skipped" : "is-done");
    });
  }

  fetch(root.getAttribute("data-source"), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (feed) {
      var run = feed.latest;
      if (!run) throw new Error("no runs yet");
      renderStatus(feed, run);
      renderKpis(run);
      renderHistory(feed.runs || [run]);
      renderStages(run);
      renderCountries(run);
      renderChecks(run);
      part("loading").hidden = true;
      part("body").hidden = false;
    })
    .catch(function (error) {
      part("loading").textContent = "The pipeline feed isn't reachable right now (" + error.message + ").";
    });
})();
