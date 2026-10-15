// LogicGate demo loop: a metric definition is edited visually, the change is
// reviewed as a diff, approved, and the definition recompiles to SQL, Python
// and dbt. Runs only while on screen; reduced motion shows the final state.
(function () {
  "use strict";

  var CODE = {
    sql: function (days) {
      return [
        "SELECT customer_id",
        "FROM orders",
        "WHERE order_date >= CURRENT_DATE - INTERVAL '" + days + " days'",
        "GROUP BY customer_id",
        "HAVING COUNT(*) >= 1;",
      ].join("\n");
    },
    py: function (days) {
      return [
        "cutoff = today - pd.Timedelta(days=" + days + ")",
        "recent = orders[orders.order_date >= cutoff]",
        "active = (recent.groupby('customer_id')",
        "              .size().ge(1))",
      ].join("\n");
    },
    dbt: function (days) {
      return [
        "-- models/metrics/active_customers.sql",
        "select customer_id",
        "from {{ ref('orders') }}",
        "where order_date >= {{ dbt.dateadd('day', -" + days + ", 'current_date') }}",
        "group by customer_id",
      ].join("\n");
    },
  };

  function setup(root) {
    var status = root.querySelector("[data-lg-status]");
    var days = root.querySelector("[data-lg-days]");
    var change = root.querySelector("[data-lg-change]");
    var approval = root.querySelector("[data-lg-approval]");
    var approvalText = root.querySelector("[data-lg-approval-text]");
    var code = root.querySelector("[data-lg-code]");
    var tabs = root.querySelectorAll("[data-lg-tab]");
    var timers = [];
    var typing = null;
    var running = false;

    function later(ms, fn) {
      timers.push(window.setTimeout(fn, ms));
    }

    function clear() {
      timers.forEach(window.clearTimeout);
      timers = [];
      window.clearInterval(typing);
    }

    function tab(name) {
      Array.prototype.forEach.call(tabs, function (t) {
        t.classList.toggle("is-active", t.getAttribute("data-lg-tab") === name);
      });
    }

    function show(name, n) {
      tab(name);
      window.clearInterval(typing);
      code.textContent = CODE[name](n);
    }

    // Retype the code quickly, as if freshly compiled.
    function compile(name, n) {
      tab(name);
      var text = CODE[name](n);
      var i = 0;
      window.clearInterval(typing);
      code.textContent = "";
      code.classList.add("is-compiling");
      typing = window.setInterval(function () {
        i += 4;
        code.textContent = text.slice(0, i);
        if (i >= text.length) {
          window.clearInterval(typing);
          code.classList.remove("is-compiling");
        }
      }, 16);
    }

    function setStatus(text, state) {
      status.textContent = text;
      status.dataset.state = state;
    }

    function reset() {
      root.classList.remove("is-fading");
      days.textContent = "30 days";
      days.classList.remove("is-editing", "is-changed");
      change.classList.remove("is-visible");
      approval.classList.remove("is-visible", "is-approved");
      approvalText.textContent = "Awaiting approval · Data Lead";
      setStatus("v3 · Live", "live");
      show("sql", 30);
    }

    function cycle() {
      reset();
      later(1400, function () {
        days.classList.add("is-editing");
        setStatus("v4 · Draft", "draft");
        days.textContent = "";
        var target = "90 days";
        var k = 0;
        var t = window.setInterval(function () {
          k += 1;
          days.textContent = target.slice(0, k);
          if (k >= target.length) window.clearInterval(t);
        }, 70);
        timers.push(t);
      });
      later(2500, function () {
        days.classList.remove("is-editing");
        days.classList.add("is-changed");
        change.classList.add("is-visible");
      });
      later(3900, function () {
        approval.classList.add("is-visible");
        setStatus("v4 · In review", "review");
      });
      later(5300, function () {
        approval.classList.add("is-approved");
        approvalText.textContent = "Approved by Data Lead ✓";
        setStatus("v4 · Live", "live");
      });
      later(6200, function () { compile("sql", 90); });
      later(7800, function () { compile("py", 90); });
      later(9200, function () { compile("dbt", 90); });
      later(11200, function () { root.classList.add("is-fading"); });
      later(11700, function () { if (running) cycle(); });
    }

    function start() {
      if (running) return;
      running = true;
      cycle();
    }

    function stop() {
      running = false;
      clear();
    }

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      days.textContent = "90 days";
      days.classList.add("is-changed");
      change.classList.add("is-visible");
      approval.classList.add("is-visible", "is-approved");
      approvalText.textContent = "Approved by Data Lead ✓";
      setStatus("v4 · Live", "live");
      show("sql", 90);
      return;
    }

    reset();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) start();
        else stop();
      }, { threshold: 0.2 }).observe(root);
    } else {
      start();
    }
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-logicgate-demo]"), function (root) {
      if (!root._lgReady) {
        root._lgReady = true;
        setup(root);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
