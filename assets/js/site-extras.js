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
    // [from hour, to hour (exclusive), emoji, status]
    var SCHEDULE = [
      [0, 8, "😴", "I am probably sleeping."],
      [8, 10, "☕", "I am probably having coffee."],
      [10, 13, "💻", "I am probably building pipelines."],
      [13, 14, "🍽️", "I am probably having lunch."],
      [14, 18, "💻", "I am probably working."],
      [18, 20, "🚶", "I am probably out for a walk."],
      [20, 23, "📚", "I am probably reading."],
      [23, 24, "🌙", "I am probably winding down."],
    ];
    var clock = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" });
    var hourOf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });
    var lastText = "";

    var tick = function () {
      var now = new Date();
      timeEl.textContent = clock.format(now);
      var hour = parseInt(hourOf.format(now), 10) % 24;
      var slot = SCHEDULE.filter(function (s) { return hour >= s[0] && hour < s[1]; })[0] || SCHEDULE[0];
      if (slot[3] !== lastText) {
        emojiEl.textContent = slot[2];
        textEl.textContent = slot[3];
        lastText = slot[3];
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
