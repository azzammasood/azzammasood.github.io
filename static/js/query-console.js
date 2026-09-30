// SQL console for /query/: loads the site's own content (exported by
// layouts/query/list.html) and the live pipeline runs into an in-memory
// SQLite database (sql.js, self-hosted under /vendor/sql.js/).
(function () {
  "use strict";

  var script = document.currentScript;
  var console_ = document.querySelector("[data-query-console]");
  if (!console_ || !script) return;

  var input = console_.querySelector("[data-query-input]");
  var runButton = console_.querySelector("[data-query-run]");
  var status = console_.querySelector("[data-query-status]");
  var output = console_.querySelector("[data-query-output]");
  var examplesEl = console_.querySelector("[data-query-examples]");
  var schemaEl = console_.querySelector("[data-query-schema]");
  var wasmBase = script.getAttribute("data-wasm");
  var pipelineUrl = script.getAttribute("data-pipeline");
  var MAX_ROWS = 200;

  var EXAMPLES = [
    {
      label: "Most-used tools",
      sql: "SELECT tool, COUNT(*) AS uses\nFROM stack\nGROUP BY tool\nORDER BY uses DESC, tool\nLIMIT 10;",
    },
    {
      label: "Career timeline",
      sql: "SELECT company, role, start_month, end_month, months\nFROM experience\nORDER BY start_month DESC;",
    },
    {
      label: "Years of experience",
      sql: "SELECT ROUND(SUM(months) / 12.0, 1) AS years,\n       COUNT(*) AS roles\nFROM experience;",
    },
    {
      label: "Where does Airflow show up?",
      sql: "SELECT source_type, source\nFROM stack\nWHERE tool LIKE '%airflow%'\nORDER BY source_type;",
    },
    {
      label: "Tools per role",
      sql: "SELECT e.company, COUNT(s.tool) AS tools,\n       GROUP_CONCAT(s.tool, ', ') AS stack\nFROM experience e\nJOIN stack s ON s.source_type = 'experience' AND s.source = e.company\nGROUP BY e.company\nORDER BY tools DESC;",
    },
    {
      label: "Live pipeline health",
      sql: "SELECT status, COUNT(*) AS runs,\n       ROUND(AVG(duration_ms)) AS avg_ms,\n       MAX(aircraft) AS peak_aircraft\nFROM pipeline_runs\nGROUP BY status;",
    },
  ];

  var SCHEMA = [
    "CREATE TABLE projects (slug TEXT PRIMARY KEY, title TEXT, summary TEXT, published TEXT, url TEXT);",
    "CREATE TABLE experience (company TEXT, role TEXT, employment TEXT, location TEXT, mode TEXT, start_month TEXT, end_month TEXT, months INTEGER);",
    "CREATE TABLE highlights (company TEXT, highlight TEXT);",
    "CREATE TABLE certifications (title TEXT, provider TEXT, credential TEXT);",
    "CREATE TABLE competitions (title TEXT, event_date TEXT, summary TEXT);",
    "CREATE TABLE stack (source_type TEXT, source TEXT, tool TEXT);",
    "CREATE TABLE pipeline_runs (run_id TEXT PRIMARY KEY, started_at TEXT, status TEXT, duration_ms INTEGER, rows_loaded INTEGER, checks_passed INTEGER, checks_total INTEGER, aircraft INTEGER, airborne INTEGER);",
    "CREATE TABLE pipeline_checks (run_id TEXT, check_name TEXT, passed INTEGER, detail TEXT);",
  ];

  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  // "Jan 2025" -> {y, m}; "Present" -> this month.
  function parseMonth(text) {
    var match = /([a-z]{3})[a-z]*\.?\s+(\d{4})/i.exec(text || "");
    if (!match) {
      var today = new Date();
      return { y: today.getFullYear(), m: today.getMonth() + 1 };
    }
    return { y: +match[2], m: MONTHS[match[1].toLowerCase()] || 1 };
  }

  function iso(month) {
    return month.y + "-" + (month.m < 10 ? "0" : "") + month.m;
  }

  function period(text) {
    var parts = String(text || "").split(/\s+[-–]\s+/);
    var start = parseMonth(parts[0]);
    var end = parseMonth(parts[1]);
    return {
      start: iso(start),
      end: iso(end),
      months: (end.y - start.y) * 12 + (end.m - start.m) + 1,
    };
  }

  function insert(db, table, rows) {
    if (!rows.length) return;
    var columns = Object.keys(rows[0]);
    var statement = db.prepare(
      "INSERT INTO " + table + " (" + columns.join(",") + ") VALUES (" + columns.map(function () { return "?"; }).join(",") + ")"
    );
    rows.forEach(function (row) {
      statement.run(columns.map(function (column) { return row[column] == null ? null : row[column]; }));
    });
    statement.free();
  }

  function loadResume(db, data) {
    var stack = [];
    function addTools(type, source, tools) {
      (tools || []).forEach(function (tool) {
        stack.push({ source_type: type, source: source, tool: tool });
      });
    }

    insert(db, "projects", data.projects.map(function (p) {
      addTools("project", p.title, p.tools);
      return { slug: p.slug, title: p.title, summary: p.summary, published: p.published, url: p.url };
    }));

    var highlights = [];
    insert(db, "experience", data.experience.map(function (e) {
      var span = period(e.period);
      addTools("experience", e.company, e.tools);
      (e.highlights || []).forEach(function (h) {
        highlights.push({ company: e.company, highlight: h });
      });
      return {
        company: e.company, role: e.role, employment: e.employment, location: e.location, mode: e.mode,
        start_month: span.start, end_month: span.end, months: span.months,
      };
    }));
    insert(db, "highlights", highlights);

    insert(db, "certifications", data.certifications.map(function (c) {
      addTools("certification", c.title, c.tools);
      return { title: c.title, provider: c.provider, credential: c.credential };
    }));

    insert(db, "competitions", data.competitions.map(function (c) {
      addTools("competition", c.title, c.tools);
      return { title: c.title, event_date: c.event_date, summary: c.summary };
    }));

    insert(db, "stack", stack);
  }

  function loadPipeline(db, feed) {
    var runs = (feed && feed.runs) || [];
    var checks = [];
    insert(db, "pipeline_runs", runs.map(function (r) {
      var list = r.checks || [];
      list.forEach(function (c) {
        checks.push({ run_id: r.run_id, check_name: c.name, passed: c.passed ? 1 : 0, detail: c.detail || null });
      });
      var metrics = r.metrics || {};
      return {
        run_id: r.run_id, started_at: r.started_at, status: r.status, duration_ms: r.duration_ms,
        rows_loaded: r.rows_loaded,
        checks_passed: list.filter(function (c) { return c.passed; }).length,
        checks_total: list.length,
        aircraft: metrics.aircraft == null ? null : metrics.aircraft,
        airborne: metrics.airborne == null ? null : metrics.airborne,
      };
    }));
    insert(db, "pipeline_checks", checks);
    return runs.length;
  }

  function fetchPipeline() {
    if (!pipelineUrl || !window.fetch) return Promise.resolve(null);
    return fetch(pipelineUrl, { cache: "no-store" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .catch(function () { return null; });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderResult(results) {
    output.textContent = "";
    if (!results.length) {
      output.appendChild(el("p", "query-console__empty", "Query ran. No rows returned."));
      return 0;
    }
    var last = results[results.length - 1];
    var wrap = el("div", "query-console__table-wrap");
    var table = el("table", "query-console__table");
    var head = el("thead");
    var headRow = el("tr");
    var first = last.values[0] || [];
    last.columns.forEach(function (column, index) {
      headRow.appendChild(el("th", typeof first[index] === "number" ? "is-number" : null, column));
    });
    head.appendChild(headRow);
    table.appendChild(head);
    var body = el("tbody");
    last.values.slice(0, MAX_ROWS).forEach(function (row) {
      var tr = el("tr");
      row.forEach(function (value) {
        var td = el("td", typeof value === "number" ? "is-number" : null, value == null ? "NULL" : String(value));
        if (value == null) td.classList.add("is-null");
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    output.appendChild(wrap);
    return last.values.length;
  }

  function renderSchema(db) {
    var tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    var list = el("ul", "query-console__schema-list");
    ((tables[0] && tables[0].values) || []).forEach(function (row) {
      var name = row[0];
      var info = db.exec("PRAGMA table_info(" + name + ")");
      var count = db.exec("SELECT COUNT(*) FROM " + name)[0].values[0][0];
      var item = el("li");
      var button = el("button", "query-console__table-name", name);
      button.type = "button";
      button.title = "Preview " + name;
      button.addEventListener("click", function () {
        input.value = "SELECT *\nFROM " + name + "\nLIMIT 20;";
        run();
      });
      item.appendChild(button);
      item.appendChild(el("span", "query-console__row-count", count + " rows"));
      var cols = ((info[0] && info[0].values) || []).map(function (c) { return c[1] + " " + c[2].toLowerCase(); });
      item.appendChild(el("code", null, cols.join(", ")));
      list.appendChild(item);
    });
    schemaEl.textContent = "";
    schemaEl.appendChild(list);
  }

  var db = null;

  function run() {
    if (!db) return;
    var sql = input.value.trim();
    if (!sql) return;
    var started = performance.now();
    try {
      var results = db.exec(sql);
      var rows = renderResult(results);
      var ms = (performance.now() - started).toFixed(1);
      status.textContent = rows + (rows === 1 ? " row" : " rows") + (rows > MAX_ROWS ? " (showing " + MAX_ROWS + ")" : "") + " · " + ms + " ms";
      status.classList.remove("is-error");
    } catch (error) {
      output.textContent = "";
      status.textContent = "Error: " + error.message;
      status.classList.add("is-error");
    }
    try {
      history.replaceState(null, "", "?q=" + encodeURIComponent(sql));
    } catch (_) {}
  }

  EXAMPLES.forEach(function (example) {
    var button = el("button", "query-console__example", example.label);
    button.type = "button";
    button.addEventListener("click", function () {
      input.value = example.sql;
      run();
    });
    examplesEl.appendChild(button);
  });

  var fromUrl = null;
  try {
    fromUrl = new URLSearchParams(window.location.search).get("q");
  } catch (_) {}
  input.value = fromUrl || EXAMPLES[0].sql;

  input.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      run();
    }
  });
  runButton.addEventListener("click", run);

  function start() {
    if (!window.initSqlJs) {
      status.textContent = "Couldn't load SQLite in this browser.";
      status.classList.add("is-error");
      return;
    }
    var data = JSON.parse(document.getElementById("resume-data").textContent);
    Promise.all([
      window.initSqlJs({ locateFile: function (file) { return wasmBase + file; } }),
      fetchPipeline(),
    ])
      .then(function (loaded) {
        db = new loaded[0].Database();
        SCHEMA.forEach(function (statement) { db.run(statement); });
        loadResume(db, data);
        var runs = loadPipeline(db, loaded[1]);
        renderSchema(db);
        runButton.disabled = false;
        status.textContent = "Ready · " + (runs ? runs + " pipeline runs loaded" : "pipeline feed unavailable");
        run();
      })
      .catch(function (error) {
        status.textContent = "Couldn't start SQLite: " + error.message;
        status.classList.add("is-error");
      });
  }

  if (window.initSqlJs) {
    start();
  } else {
    window.addEventListener("load", start);
  }
})();
