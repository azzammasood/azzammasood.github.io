// Code motion: every visible piece of the page is "written" in as it enters
// the viewport instead of fading in.
//   - headings, nav and short labels decode character by character behind a
//     caret, with a few scrambled glyphs running ahead of it
//   - paragraphs and list items stream in word by word, like tokens, with the
//     newest words briefly syntax-highlighted
//   - buttons, chips and icons boot open in stepped slices while their label
//     resolves from noise
//   - images, tables and code blocks render top to bottom in scanlines
// Everything runs off one requestAnimationFrame loop, is scheduled in
// document order per lane (top bar / side nav / sidebar / content) and restores the original DOM
// once finished.
(function () {
  "use strict";

  var root = document.documentElement;

  function disarm() {
    root.classList.remove("cm-armed");
  }

  if (
    !root.classList.contains("cm-armed") ||
    !("IntersectionObserver" in window) ||
    !window.requestAnimationFrame ||
    (window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  ) {
    disarm();
    return;
  }

  var GLYPHS = "01<>/{}[]()=+*#$%&_;:~^|!?";
  var SKIP =
    "script,style,noscript,template,.sr-only,[hidden],[aria-hidden='true'],[data-cm-skip]," +
    ".code-theme-switcher__menu,.command-palette,#search-modal,.search-modal";
  var DECODE =
    "h1,h2,h3,h4,h5,h6,.site-name-link,.top-contact-link,.site-side-nav .nav-link," +
    ".landing-hero__kicker,.project-row__stack-label,.experience-entry__eyebrow";
  var CHIP =
    "button,kbd,.landing-button,.btn,.site-search-trigger,.code-theme-switcher,.top-github-link," +
    ".projects-page__rail a,.contact-list a,.about-skill,.experience-stack-item," +
    ".project-row__stack > span:not(.project-row__stack-label),.nav-toggle-label";
  var RENDER =
    "img,picture,video,iframe,canvas,svg,pre,table,.experience-company-header";
  var DRAW = "hr";
  var SHORT_TEXT = 42;

  var raf = window.requestAnimationFrame;
  var tasks = [];
  var running = false;
  var lanes = {};

  function now() {
    return window.performance && performance.now
      ? performance.now()
      : Date.now();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function glyph() {
    return GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
  }

  function matches(el, selector) {
    return (el.matches || el.msMatchesSelector).call(el, selector);
  }

  function hasOwnText(el) {
    for (var node = el.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 3 && /\S/.test(node.data)) return true;
    }
    return false;
  }

  function isRendered(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  // ---------------------------------------------------------------------------
  // Target collection
  // ---------------------------------------------------------------------------

  function classify(el) {
    if (matches(el, DECODE)) return "decode";
    if (matches(el, CHIP)) return "chip";
    if (matches(el, RENDER)) return "render";
    if (matches(el, DRAW)) return "draw";
    if (hasOwnText(el)) {
      return (el.textContent || "").trim().length <= SHORT_TEXT
        ? "decode"
        : "stream";
    }
    return null;
  }

  function collect(container, out) {
    for (var el = container.firstElementChild; el; el = el.nextElementSibling) {
      if (matches(el, SKIP)) continue;
      var kind = classify(el);
      if (kind) {
        out.push({ el: el, kind: kind });
      } else {
        collect(el, out);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Text splitting (always reversible)
  // ---------------------------------------------------------------------------

  function textNodes(el) {
    var list = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!/\S/.test(node.data)) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        if (parent && parent !== el && parent.closest("svg," + SKIP))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) list.push(walker.currentNode);
    return list;
  }

  // mode "char" wraps every non-space character, mode "word" every word. Custom
  // tag names keep existing selectors such as ".stack span" from matching them.
  function split(el, mode) {
    var units = [];
    var swaps = [];
    textNodes(el).forEach(function (node) {
      var wrap = document.createElement("cm-t");
      node.data.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          wrap.appendChild(document.createTextNode(part));
          return;
        }
        if (mode === "word") {
          var word = document.createElement("cm-w");
          word.textContent = part;
          wrap.appendChild(word);
          units.push(word);
          return;
        }
        var group = document.createElement("cm-wd");
        for (var i = 0; i < part.length; i += 1) {
          var ch = document.createElement("cm-c");
          ch.textContent = part.charAt(i);
          group.appendChild(ch);
          units.push(ch);
        }
        wrap.appendChild(group);
      });
      node.parentNode.replaceChild(wrap, node);
      swaps.push([wrap, node]);
    });
    return {
      units: units,
      restore: function () {
        swaps.forEach(function (pair) {
          if (pair[0].parentNode)
            pair[0].parentNode.replaceChild(pair[1], pair[0]);
        });
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  function setCaret(list, index, cls) {
    if (list._caret === index) return;
    if (list._caret != null && list[list._caret])
      list[list._caret].classList.remove(cls);
    if (index != null && list[index]) list[index].classList.add(cls);
    list._caret = index;
  }

  // Characters type in behind a caret; a short run of scrambled glyphs leads it.
  // With resolveAll, every character starts scrambled and resolves left to right.
  function decode(el, opts) {
    var parts = split(el, "char");
    var chars = parts.units;
    var count = chars.length;
    var ahead = opts.resolveAll ? count : Math.min(4, count);
    var duration =
      opts.duration || clamp(count * (opts.perChar || 30), 260, 1000);
    var lastScramble = 0;
    var keepCaret = el.hasAttribute("data-cm-caret");

    el.classList.add("cm-decoding");
    if (!el.hasAttribute("aria-label") && !matches(el, "a,button")) {
      el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
      el._cmLabel = true;
    }

    return {
      duration: duration,
      step: function (p, time) {
        var done = Math.floor(p * count);
        var scramble = time - lastScramble > 45;
        if (scramble) lastScramble = time;
        for (var i = 0; i < count; i += 1) {
          var ch = chars[i];
          if (i < done) {
            if (ch._s !== 2) {
              ch._s = 2;
              ch.className = "is-on";
            }
          } else if (i < done + ahead) {
            if (ch._s !== 1) {
              ch._s = 1;
              ch.className = "is-g";
              ch.setAttribute("data-g", glyph());
            } else if (scramble) {
              ch.setAttribute("data-g", glyph());
            }
          } else if (ch._s) {
            ch._s = 0;
            ch.className = "";
          }
        }
        if (!opts.resolveAll)
          setCaret(chars, clamp(done + ahead - 1, 0, count - 1), "is-caret");
      },
      finish: function () {
        parts.restore();
        el.classList.remove("cm-decoding");
        if (el._cmLabel) {
          el.removeAttribute("aria-label");
          el._cmLabel = false;
        }
        if (keepCaret) el.classList.add("cm-caret-live");
      },
    };
  }

  // Words stream in like tokens; the freshest ones glow in the accent colour.
  function stream(el) {
    var parts = split(el, "word");
    var words = parts.units;
    var count = words.length;
    var duration = clamp(count * 16, 260, 1200);
    var shown = 0;

    el.classList.add("cm-streaming");

    return {
      duration: duration,
      step: function (p) {
        var target = Math.ceil(p * count);
        while (shown < target) {
          var word = words[shown];
          word.className = "is-on is-fresh";
          (function (w) {
            window.setTimeout(function () {
              w.classList.remove("is-fresh");
            }, 140);
          })(word);
          shown += 1;
        }
        setCaret(words, shown ? shown - 1 : null, "is-caret");
      },
      finish: function () {
        setCaret(words, null, "is-caret");
        // Let the last highlighted tokens cool down before unwrapping.
        window.setTimeout(function () {
          parts.restore();
          el.classList.remove("cm-streaming");
        }, 700);
      },
    };
  }

  function cssAnimation(el, cls, duration) {
    return {
      duration: duration,
      start: function () {
        el.classList.add(cls);
      },
      step: function () {},
      finish: function () {
        el.classList.remove(cls);
      },
    };
  }

  // A single scanline rides down the element while it renders in slices.
  function render(el) {
    var anim = cssAnimation(el, "cm-render", 760);
    var start = anim.start;
    anim.start = function () {
      start();
      var rect = el.getBoundingClientRect();
      if (rect.height < 24 || rect.width < 24) return;
      var line = document.createElement("div");
      line.className = "cm-scanline";
      line.setAttribute("aria-hidden", "true");
      line.style.left = rect.left + window.scrollX + "px";
      line.style.top = rect.top + window.scrollY + "px";
      line.style.width = rect.width + "px";
      line.style.setProperty("--cm-h", rect.height + "px");
      document.body.appendChild(line);
      window.setTimeout(function () {
        if (line.parentNode) line.parentNode.removeChild(line);
      }, 900);
    };
    return anim;
  }

  function chip(el) {
    var anim = cssAnimation(el, "cm-chip", 460);
    if (!textNodes(el).length) return anim;
    var label = decode(el, { resolveAll: true, duration: 460 });
    var start = anim.start;
    return {
      duration: 460,
      start: start,
      step: label.step,
      finish: function () {
        label.finish();
        anim.finish();
      },
    };
  }

  function perChar(el) {
    if (el.hasAttribute("data-cm-caret")) return 90;
    if (el.closest(".header")) return 30;
    return /^H[12]$/.test(el.tagName) ? 36 : 30;
  }

  // Rough length of an item's animation, used to overlap the queue naturally.
  function estimate(item) {
    var length = (item.el.textContent || "").replace(/\s+/g, "").length;
    if (item.kind === "decode")
      return clamp(length * perChar(item.el), 260, 1000);
    if (item.kind === "stream") return clamp((length / 5.5) * 16, 260, 1200);
    if (item.kind === "render") return 760;
    return 460;
  }

  function build(item) {
    var el = item.el;
    switch (item.kind) {
      case "decode":
        return decode(el, { perChar: perChar(el) });
      case "stream":
        return stream(el);
      case "chip":
        return chip(el);
      case "render":
        return render(el);
      default:
        return cssAnimation(el, "cm-draw", 620);
    }
  }

  // ---------------------------------------------------------------------------
  // Scheduler
  // ---------------------------------------------------------------------------

  function tick(time) {
    for (var i = tasks.length - 1; i >= 0; i -= 1) {
      var task = tasks[i];
      if (time < task.at) continue;
      if (!task.anim) {
        task.anim = build(task.item);
        task.item.el.classList.remove("cm-pending");
        if (task.anim.start) task.anim.start();
        task.at = time;
      }
      var p = clamp((time - task.at) / task.anim.duration, 0, 1);
      task.anim.step(p, time);
      if (p >= 1) {
        task.anim.finish();
        tasks.splice(i, 1);
      }
    }
    if (tasks.length) {
      raf(tick);
    } else {
      running = false;
    }
  }

  function schedule(item) {
    var t = now();
    // Top bar, side nav, sidebars and page content each type in their own sequence, in parallel.
    var el = item.el;
    var lane = el.closest(".site-side-nav")
      ? "nav"
      : el.closest(".header")
        ? "top"
        : el.closest("aside,.projects-page__rail")
          ? "aside"
          : "content";
    var cursor = Math.max(t, lanes[lane] || 0);
    // Fast scrolling can queue a lot at once; compress the stagger so nothing lags behind.
    var backlog = cursor - t;
    // The next item starts while this one is still finishing, like a fast typist.
    var gap = backlog > 900 ? 24 : clamp(estimate(item) * 0.35, 60, 300);
    lanes[lane] = cursor + gap;
    tasks.push({ item: item, at: cursor });
    if (!running) {
      running = true;
      raf(tick);
    }
  }

  function byDocumentOrder(a, b) {
    return a.target.compareDocumentPosition(b.target) &
      Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1;
  }

  var items = new Map();
  var observer = new IntersectionObserver(
    function (entries) {
      entries
        .filter(function (entry) {
          return entry.isIntersecting;
        })
        .sort(byDocumentOrder)
        .forEach(function (entry) {
          observer.unobserve(entry.target);
          var item = items.get(entry.target);
          items.delete(entry.target);
          if (item) schedule(item);
        });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.01 },
  );

  function init() {
    var containers = document.querySelectorAll(".header .navbar, main, footer");
    var found = [];
    Array.prototype.forEach.call(containers, function (container) {
      collect(container, found);
    });

    found.forEach(function (item) {
      if (items.has(item.el)) return;
      // Things that are not on screen right now (collapsed menus, etc.) are
      // simply left alone rather than hidden until they happen to intersect.
      if (!isRendered(item.el)) return;
      item.el.classList.add("cm-pending");
      items.set(item.el, item);
      observer.observe(item.el);
    });

    disarm();
  }

  // The site's persistent caret after the hero name.
  var hero = document.querySelector("body.is-home .landing-hero__name h1");
  if (hero) hero.setAttribute("data-cm-caret", "");

  init();

  window.addEventListener("beforeprint", function () {
    items.forEach(function (_, el) {
      el.classList.remove("cm-pending");
    });
  });
})();
