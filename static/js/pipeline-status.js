// Landing-page status card for the live pipeline (.github/workflows/pipeline.yml).
// Reads status.json from the pipeline-data branch; stays hidden if it can't.
(function () {
  "use strict";

  var card = document.querySelector("[data-pipeline-card]");
  if (!card || !window.fetch) return;
  var url = card.getAttribute("data-source");
  var SVG = "http://www.w3.org/2000/svg";

  function ago(iso) {
    var seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (seconds < 90) return "just now";
    if (seconds < 5400) return Math.round(seconds / 60) + " min ago";
    if (seconds < 129600) return Math.round(seconds / 3600) + " h ago";
    return Math.round(seconds / 86400) + " d ago";
  }

  function number(value) {
    return value == null ? "–" : Number(value).toLocaleString("en-US");
  }

  function set(name, text) {
    var node = card.querySelector("[data-field='" + name + "']");
    if (node) node.textContent = text;
  }

  // Aircraft per run, oldest to newest.
  function sparkline(runs) {
    var values = runs
      .slice()
      .reverse()
      .map(function (run) { return (run.metrics && run.metrics.aircraft) || 0; });
    var holder = card.querySelector("[data-field='spark']");
    if (!holder || values.length < 2) return;
    var width = 120;
    var height = 26;
    var max = Math.max.apply(null, values) || 1;
    var step = width / (values.length - 1);
    var points = values.map(function (v, i) {
      return (i * step).toFixed(1) + "," + (height - 2 - (v / max) * (height - 4)).toFixed(1);
    });
    var svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("aria-hidden", "true");
    var line = document.createElementNS(SVG, "polyline");
    line.setAttribute("points", points.join(" "));
    var dot = document.createElementNS(SVG, "circle");
    var last = points[points.length - 1].split(",");
    dot.setAttribute("cx", last[0]);
    dot.setAttribute("cy", last[1]);
    dot.setAttribute("r", "2.4");
    svg.appendChild(line);
    svg.appendChild(dot);
    holder.textContent = "";
    holder.appendChild(svg);
  }

  function stages(run) {
    var holder = card.querySelector("[data-field='stages']");
    if (!holder) return;
    holder.textContent = "";
    var failedStage = run.status === "failed" ? "extract" : run.status === "degraded" ? "validate" : null;
    // status.json existing means the load stage ran; it isn't timed separately.
    var list = (run.stages || []).concat([{ name: "load", ms: null }]);
    list.forEach(function (stage, index) {
      if (index) {
        var arrow = document.createElement("span");
        arrow.className = "pipeline-card__arrow";
        arrow.textContent = "→";
        holder.appendChild(arrow);
      }
      var item = document.createElement("span");
      item.className = "pipeline-card__stage" + (stage.name === failedStage ? " is-warn" : "");
      item.textContent = stage.name;
      if (stage.ms != null) item.title = stage.name + ": " + stage.ms + " ms";
      holder.appendChild(item);
    });
  }

  fetch(url, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(function (feed) {
      var run = feed && feed.latest;
      if (!run) return;
      var metrics = run.metrics || {};
      var checks = run.checks || [];
      var passed = checks.filter(function (c) { return c.passed; }).length;
      card.dataset.state = run.status;
      set("state", run.status);
      set("ago", ago(run.finished_at || run.started_at));
      set("aircraft", number(metrics.aircraft));
      set("checks", passed + "/" + checks.length);
      set("duration", (run.duration_ms / 1000).toFixed(1) + "s");
      stages(run);
      sparkline(feed.runs || [run]);
      card.hidden = false;
      window.requestAnimationFrame(function () {
        card.classList.add("is-visible");
      });
    })
    .catch(function () {});
})();
