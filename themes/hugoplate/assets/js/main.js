// main script
(function () {
  "use strict";

  function setupThemeCursor() {
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    var root = document.documentElement;

    function token(name, fallback) {
      return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
    }

    function cursorUrl(svg, x, y) {
      return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + x + " " + y;
    }

    function paintCursor() {
      var lightCursorTheme = root.dataset.codeTheme === "mono" || root.dataset.codeTheme === "kodama-grove";
      var fill = lightCursorTheme ? "#ffffff" : token("--color-primary", "#111111");
      var stroke = "#000000";
      var shadow = "rgba(0,0,0,.28)";

      var arrowSvg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">',
        '<path d="M5 3.75 21.25 17.2l-8.02 1.08-3.58 7.24L5 3.75Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2.4" stroke-linejoin="round"/>',
        '<path d="m13.23 18.28 2.86 5.05" stroke="' + shadow + '" stroke-width="1.6" stroke-linecap="round"/>',
        "</svg>",
      ].join("");

      var pointerSvg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">',
        '<path d="M11.45 3.7c1.26 0 2.28 1.02 2.28 2.28v7.08l.62-.72a2.23 2.23 0 0 1 3.31-.1l.45.5.38-.34a2.23 2.23 0 0 1 3.12.18l.35.4.31-.2a2.19 2.19 0 0 1 3.15 1.93v5.16c0 4.2-3.03 7.13-7.37 7.13h-3.41c-2.4 0-4.37-1.01-5.78-3.04L5.1 18.5a2.28 2.28 0 0 1 3.55-2.83l.52.62V5.98c0-1.26 1.02-2.28 2.28-2.28Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2.2" stroke-linejoin="round"/>',
        '<path d="M13.73 13.06v4.88M18.11 12.74v5.2M21.96 12.98v4.96" stroke="' + stroke + '" stroke-width="1.35" stroke-linecap="round" opacity=".75"/>',
        "</svg>",
      ].join("");

      root.style.setProperty("--portfolio-cursor-default", cursorUrl(arrowSvg, 5, 4));
      root.style.setProperty("--portfolio-cursor-pointer", cursorUrl(pointerSvg, 11, 4));
    }

    paintCursor();

    new MutationObserver(paintCursor).observe(root, {
      attributes: true,
      attributeFilter: ["data-code-theme", "class"],
    });

    window.addEventListener("storage", function (event) {
      if (event.key === "code-theme" || event.key === "theme") {
        window.requestAnimationFrame(paintCursor);
      }
    });
  }

  function setupHomeEntranceMotion() {
    var body = document.body;
    if (!body || !body.classList.contains("is-home") || !body.classList.contains("home-motion-stage")) {
      return;
    }

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      body.classList.remove("home-motion-stage");
      return;
    }

    body.classList.add("home-motion-ready");
  }

  setupThemeCursor();
  setupHomeEntranceMotion();

  // Testimonial Slider
  // ----------------------------------------
  new Swiper(".testimonial-slider", {
    spaceBetween: 24,
    loop: true,
    pagination: {
      el: ".testimonial-slider-pagination",
      type: "bullets",
      clickable: true,
    },
    breakpoints: {
      768: {
        slidesPerView: 2,
      },
      992: {
        slidesPerView: 3,
      },
    },
  });
})();
