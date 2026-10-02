// Small site-wide behaviours: the bottom-left local time/status line, and
// double-click fading text instead of selecting it.
(function () {
  "use strict";

  // ---------------------------------------------------------------- status
  var status = document.querySelector("[data-site-status]");
  if (status) {
    var timeEl = status.querySelector("[data-site-status-time]");
    var emojiEl = status.querySelector("[data-site-status-emoji]");
    var textEl = status.querySelector("[data-site-status-text]");
    var TZ = "Asia/Karachi";
    var ROTATE_MS = 9000;
    // [from hour, to hour (exclusive), emoji, sentences]. One sentence is
    // picked at random from the current slot and rotated every few seconds.
    var SCHEDULE = [
      [0, 7, "😴", [
        "I am probably sleeping.",
        "I am probably dreaming in DAGs.",
        "I am probably asleep while the nightly batch runs.",
        "I am probably offline, my cron jobs are not.",
        "I am probably asleep, hoping no pager goes off.",
        "I am probably recharging, like a warehouse on auto-suspend.",
        "I am probably asleep while backfills churn through history.",
        "I am probably counting partitions instead of sheep.",
      ]],
      [7, 9, "☕", [
        "I am probably having my first coffee.",
        "I am probably checking last night's pipeline runs.",
        "I am probably reading the overnight alerts with coffee.",
        "I am probably warming up, like a cold cache.",
        "I am probably triaging data-quality failures from overnight.",
        "I am probably skimming the dbt test results.",
      ]],
      [9, 13, "💻", [
        "I am probably building pipelines.",
        "I am probably writing a MERGE statement.",
        "I am probably reviewing a pull request.",
        "I am probably modelling a fact table.",
        "I am probably tuning a slow Snowflake query.",
        "I am probably debugging an Airflow DAG.",
        "I am probably arguing with a schema change.",
        "I am probably adding tests to a dbt model.",
        "I am probably reading a query plan.",
        "I am probably chasing a late-arriving partition.",
      ]],
      [13, 14, "🍽️", [
        "I am probably having lunch.",
        "I am probably away from the keyboard, eating.",
        "I am probably having lunch while a job retries.",
        "I am probably taking a break, the scheduler is not.",
      ]],
      [14, 18, "🛠️", [
        "I am probably working.",
        "I am probably refactoring an old ETL job.",
        "I am probably designing a medallion layer.",
        "I am probably wiring up CDC from a database.",
        "I am probably cutting cloud costs somewhere.",
        "I am probably optimising Spark shuffles.",
        "I am probably writing documentation nobody asked for.",
        "I am probably backfilling a table.",
        "I am probably in a design review.",
        "I am probably tracing lineage for a broken metric.",
      ]],
      [18, 20, "🚶", [
        "I am probably out for a walk.",
        "I am probably stepping away from the screen.",
        "I am probably thinking through a design on a walk.",
        "I am probably getting some fresh air.",
      ]],
      [20, 23, "📚", [
        "I am probably reading.",
        "I am probably reading Fundamentals of Data Engineering.",
        "I am probably catching up on Substack.",
        "I am probably tinkering with a side project.",
        "I am probably learning something new.",
        "I am probably reading about lakehouse table formats.",
      ]],
      [23, 24, "🌙", [
        "I am probably winding down.",
        "I am probably closing my laptop.",
        "I am probably queueing tomorrow's tasks.",
        "I am probably about to sleep.",
      ]],
    ];
    var clock = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" });
    var hourOf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });
    var slotNow = null;
    var lastSentence = "";
    var rotatedAt = 0;

    var pickSentence = function (slot) {
      var options = slot[3].filter(function (s) { return s !== lastSentence; });
      return options[(Math.random() * options.length) | 0] || slot[3][0];
    };

    var setSentence = function (text) {
      lastSentence = text;
      textEl.classList.add("is-changing");
      window.setTimeout(function () {
        textEl.textContent = text;
        textEl.classList.remove("is-changing");
      }, 260);
    };

    var tick = function () {
      var now = new Date();
      timeEl.textContent = clock.format(now);
      var hour = parseInt(hourOf.format(now), 10) % 24;
      var slot = SCHEDULE.filter(function (s) { return hour >= s[0] && hour < s[1]; })[0] || SCHEDULE[0];
      if (slot !== slotNow) {
        slotNow = slot;
        emojiEl.textContent = slot[2];
        lastSentence = pickSentence(slot);
        textEl.textContent = lastSentence;
        rotatedAt = Date.now();
      } else if (Date.now() - rotatedAt > ROTATE_MS) {
        rotatedAt = Date.now();
        setSentence(pickSentence(slot));
      }
    };
    tick();
    window.setInterval(tick, 1000);
  }

  // ---------------------------------------------------- double-click fade
  var EDITABLE = "input, textarea, select, [contenteditable], .command-palette";

  // A second click in quick succession would select a word; stop that, but
  // leave single-click drag selection alone.
  document.addEventListener("mousedown", function (event) {
    if (event.detail > 1 && !event.target.closest(EDITABLE)) event.preventDefault();
  });

  document.addEventListener("dblclick", function (event) {
    if (event.target.closest(EDITABLE)) return;
    var selection = window.getSelection && window.getSelection();
    if (selection) selection.removeAllRanges();
    var target = event.target.closest("p, li, h1, h2, h3, h4, h5, h6, a, span, td, th, dt, dd, figcaption, blockquote, label, code");
    if (!target || target === document.body) return;
    target.classList.remove("is-dblclick-returning");
    target.classList.add("is-dblclick-faded");
    window.clearTimeout(target._fadeTimer);
    target._fadeTimer = window.setTimeout(function () {
      target.classList.add("is-dblclick-returning");
      target.classList.remove("is-dblclick-faded");
      window.setTimeout(function () { target.classList.remove("is-dblclick-returning"); }, 1300);
    }, 2200);
  });
})();
