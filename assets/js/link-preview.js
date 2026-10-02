// Hover previews for links.
//   - Links to other pages on this site show a live, scaled-down render of
//     the destination page in an iframe.
//   - External links can't be framed (sites forbid it), so they show a
//     screenshot of the destination from WordPress's mShots service, falling
//     back to data-preview-image or the site's icon if that fails.
(function () {
  "use strict";

  if (window.self !== window.top) return; // never preview inside a preview
  if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var SHOW_DELAY = 260;
  var FRAME_W = 1280;
  var FRAME_H = 800;
  var SCALE = 0.25;
  var SKIP = ".command-palette, .code-theme-switcher__menu, .link-preview, .site-side-nav, [data-no-preview]";

  var card = null;
  var frame = null;
  var img = null;
  var titleEl = null;
  var domainEl = null;
  var showTimer = null;
  var current = null;
  var lastEvent = null;

  function build() {
    card = document.createElement("div");
    card.className = "link-preview";
    card.setAttribute("aria-hidden", "true");
    card.innerHTML =
      '<div class="link-preview__frame-wrap"><iframe class="link-preview__frame" tabindex="-1" loading="lazy" title=""></iframe></div>' +
      '<img class="link-preview__image" alt="" />' +
      '<span class="link-preview__body"><span class="link-preview__title"></span>' +
      '<span class="link-preview__domain"></span></span>';
    document.body.appendChild(card);
    frame = card.querySelector(".link-preview__frame");
    frame.style.width = FRAME_W + "px";
    frame.style.height = FRAME_H + "px";
    frame.style.transform = "scale(" + SCALE + ")";
    card.querySelector(".link-preview__frame-wrap").style.height = FRAME_H * SCALE + "px";
    img = card.querySelector(".link-preview__image");
    titleEl = card.querySelector(".link-preview__title");
    domainEl = card.querySelector(".link-preview__domain");
  }

  function classify(link) {
    var href = link.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#" || /^(mailto|tel|javascript):/i.test(href)) return null;
    var url;
    try {
      url = new URL(link.href);
    } catch (_) {
      return null;
    }
    if (url.origin === window.location.origin) {
      if (url.pathname === window.location.pathname) return null;
      return { kind: "page", url: url };
    }
    return { kind: link.hasAttribute("data-preview-image") ? "image" : "site", url: url };
  }

  function place(event) {
    var gap = 18;
    var rect = card.getBoundingClientRect();
    var x = event.clientX + gap;
    var y = event.clientY - rect.height - gap;
    if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - gap;
    if (y < 8) y = event.clientY + gap;
    card.style.transform = "translate(" + Math.round(x) + "px, " + Math.round(y) + "px)";
  }

  function show(link, info) {
    if (!card) build();
    var domain = info.url.hostname.replace(/^www\./, "");
    card.dataset.kind = info.kind;

    if (info.kind === "page") {
      var src = info.url.pathname + info.url.search;
      if (frame.getAttribute("src") !== src) {
        // Hide the previous page until the new one has loaded.
        card.classList.add("is-loading");
        frame.onload = function () {
          card.classList.remove("is-loading");
        };
        frame.setAttribute("src", src);
      }
      titleEl.textContent = (link.textContent || "").trim() || info.url.pathname;
      domainEl.textContent = info.url.pathname;
    } else {
      screenshot(link, info.url);
      titleEl.textContent = link.getAttribute("data-preview-title") || (link.textContent || "").trim() || domain;
      domainEl.textContent = domain + " ↗";
    }

    if (lastEvent) place(lastEvent);
    card.classList.add("is-visible");
  }

  // mShots answers with a 400x300 "generating" placeholder until the capture
  // is ready, so poll a few times before settling.
  function screenshot(link, url) {
    var fallback = link.getAttribute("data-preview-image") ||
      "https://www.google.com/s2/favicons?sz=128&domain=" + encodeURIComponent(url.hostname);
    var shot = "https://s0.wp.com/mshots/v1/" + encodeURIComponent(url.href) + "?w=1280&h=800";
    var tries = 0;
    card.dataset.kind = "shot";
    card.classList.add("is-loading");
    img.onerror = function () {
      img.onerror = null;
      img.onload = null;
      card.dataset.kind = link.hasAttribute("data-preview-image") ? "image" : "site";
      card.classList.remove("is-loading");
      img.src = fallback;
    };
    img.onload = function () {
      if (img.naturalWidth === 400 && img.naturalHeight === 300 && tries < 4 && current === link) {
        tries += 1;
        window.setTimeout(function () {
          if (current === link) img.src = shot + "&r=" + tries;
        }, 1800);
        return;
      }
      card.classList.remove("is-loading");
    };
    img.src = shot;
  }

  function hide() {
    window.clearTimeout(showTimer);
    current = null;
    if (card) card.classList.remove("is-visible");
  }

  document.addEventListener("pointerover", function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || link === current || link.closest(SKIP)) return;
    var info = classify(link);
    if (!info) return;
    current = link;
    lastEvent = event;
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(function () {
      if (current === link) show(link, info);
    }, SHOW_DELAY);
  });

  document.addEventListener("pointermove", function (event) {
    lastEvent = event;
    if (card && card.classList.contains("is-visible")) place(event);
  });

  document.addEventListener("pointerout", function (event) {
    if (!current) return;
    if (!current.contains(event.relatedTarget)) hide();
  });

  document.addEventListener("click", hide, true);
  window.addEventListener("scroll", hide, { passive: true });
})();
