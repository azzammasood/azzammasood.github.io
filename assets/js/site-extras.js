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
    // The status depends only on the time in Islamabad: [from hour, to hour
    // (exclusive), emoji, sentences]. Within a slot the sentence is chosen by
    // the hour, so it is stable across reloads and page changes and only
    // moves on as the clock does.
    var WEEKDAY = [
      [0, 7, "😴", ["I am probably sleeping."]],
      [7, 9, "☕", ["I am probably having coffee before work.", "I am probably reading the overnight alerts."]],
      [9, 12, "📊", [
        "I am probably checking pipeline statuses.",
        "I am probably reviewing dashboards from overnight runs.",
        "I am probably triaging failed jobs and data-quality checks.",
      ]],
      [12, 13, "🏗️", ["I am probably building pipelines."]],
      [13, 15, "🍽️", ["I am probably on my lunch break.", "I am probably still on my lunch break."]],
      [15, 19, "⚙️", [
        "I am probably optimizing slow queries.",
        "I am probably tuning pipelines for cost and speed.",
        "I am probably refactoring a data model.",
        "I am probably reviewing pull requests.",
      ]],
      [19, 21, "🌇", ["I am probably relaxing after work.", "I am probably having dinner."]],
      [21, 24, "🛠️", [
        "I am probably working on a side project.",
        "I am probably relaxing with a side project.",
        "I am probably tinkering with something new.",
      ]],
    ];
    var WEEKEND = [
      [0, 9, "😴", ["I am probably sleeping in."]],
      [9, 13, "🛋️", ["I am probably chilling.", "I am probably taking it slow this weekend.", "I am probably out with family."]],
      [13, 15, "🍽️", ["I am probably having a long lunch."]],
      [15, 19, "📚", [
        "I am probably going deep on data engineering internals.",
        "I am probably learning a new data tool.",
        "I am probably broadening into new parts of the stack.",
        "I am probably reading about table formats and query engines.",
      ]],
      [19, 24, "🛠️", ["I am probably relaxing.", "I am probably working on a side project.", "I am probably winding down."]],
    ];
    var clock = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" });
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23", weekday: "short" });
    var lastKey = "";

    var tick = function () {
      var now = new Date();
      timeEl.textContent = clock.format(now);
      var fields = {};
      parts.formatToParts(now).forEach(function (p) { fields[p.type] = p.value; });
      var hour = parseInt(fields.hour, 10) % 24;
      var weekend = fields.weekday === "Sat" || fields.weekday === "Sun";
      var schedule = weekend ? WEEKEND : WEEKDAY;
      var slot = schedule.filter(function (s) { return hour >= s[0] && hour < s[1]; })[0] || schedule[0];
      var sentence = slot[3][(hour - slot[0]) % slot[3].length];
      var key = slot[2] + sentence;
      if (key !== lastKey) {
        lastKey = key;
        emojiEl.textContent = slot[2];
        textEl.textContent = sentence;
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
