(function () {
  function samePage(url) {
    return url.origin === window.location.origin &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search;
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest(".site-side-nav .nav-link");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== "_self") return;

    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;

    var url;
    try {
      url = new URL(href, window.location.href);
    } catch (_) {
      return;
    }

    if (samePage(url) && url.hash) return;

    event.preventDefault();

    document.querySelectorAll(".site-side-nav .nav-link.is-loading").forEach(function (item) {
      item.classList.remove("is-loading");
      item.removeAttribute("aria-busy");
    });

    link.classList.add("is-loading");
    link.setAttribute("aria-busy", "true");

    window.setTimeout(function () {
      window.location.href = url.href;
    }, 1150);
  });

  window.addEventListener("pageshow", function () {
    document.querySelectorAll(".site-side-nav .nav-link.is-loading").forEach(function (item) {
      item.classList.remove("is-loading");
      item.removeAttribute("aria-busy");
    });
  });
})();
