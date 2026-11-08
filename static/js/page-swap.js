// Client-side page changes: an internal link fetches the next page and swaps
// <main> in place (title, body class and the active nav entry follow), so the
// 3D backdrop (static/js/partition-scene.js) keeps running and simply
// re-forms, and the new content types in through code-motion as usual.
// Anything unusual (fetch failure, downloads, external links, modifier keys)
// falls back to a normal navigation.
(function () {
  "use strict";

  if (!window.fetch || !window.history || !window.history.pushState || !window.DOMParser) return;
  var main = document.querySelector("main");
  if (!main) return;
  var busy = false;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function isPage(url) {
    return url.origin === window.location.origin && !/\.(pdf|zip|png|jpe?g|webp|gif|svg|xml|json|txt|mp4|webm)$/i.test(url.pathname);
  }

  function samePath(a, b) {
    return a.replace(/\/$/, "") === b.replace(/\/$/, "");
  }

  function setNavActive(path) {
    document.querySelectorAll(".site-side-nav .nav-link").forEach(function (link) {
      var url;
      try {
        url = new URL(link.getAttribute("href"), window.location.href);
      } catch (error) {
        return;
      }
      link.classList.toggle("active", samePath(url.pathname, path));
      link.classList.remove("is-loading");
      link.removeAttribute("aria-busy");
    });
  }

  // Scripts inserted through innerHTML do not run; re-create them so page
  // features (about-bloom, logicgate-demo) start on the swapped content.
  function runScripts(container) {
    Array.prototype.forEach.call(container.querySelectorAll("script"), function (old) {
      var script = document.createElement("script");
      if (old.src) script.src = old.src;
      else script.textContent = old.textContent;
      script.async = false;
      old.parentNode.replaceChild(script, old);
    });
  }

  function swap(url, push) {
    if (busy) return;
    busy = true;
    document.querySelectorAll(".site-side-nav .nav-link").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if (samePath(href, url.pathname)) {
        link.classList.add("is-loading");
        link.setAttribute("aria-busy", "true");
      }
    });
    main.classList.add("is-leaving");
    var leave = new Promise(function (resolve) {
      window.setTimeout(resolve, 280);
    });
    var load = fetch(url.href, { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    });

    Promise.all([load, leave])
      .then(function (results) {
        var doc = new DOMParser().parseFromString(results[0], "text/html");
        var next = doc.querySelector("main");
        if (!next) throw new Error("no main");
        if (push) history.pushState({ swap: true }, "", url.href);
        document.title = doc.title;
        document.body.className = doc.body.className;
        var brand = doc.querySelector(".header .order-0");
        var here = document.querySelector(".header .order-0");
        if (brand && here) here.innerHTML = brand.innerHTML;
        main.innerHTML = next.innerHTML;
        runScripts(main);
        window.scrollTo(0, 0);
        setNavActive(url.pathname);
        // The 3D scene lives on the home page only.
        if (window.__partitionScene) {
          if (document.body.classList.contains("is-home")) window.__partitionScene.enter();
          else window.__partitionScene.leave();
        }
        if (window.codeMotion && window.codeMotion.arm) window.codeMotion.arm(main);
        main.classList.remove("is-leaving");
        if (url.hash) {
          var target = document.getElementById(url.hash.slice(1));
          if (target) target.scrollIntoView();
        }
        document.dispatchEvent(new CustomEvent("page:swapped", { detail: { url: url.href } }));
        busy = false;
      })
      .catch(function () {
        window.location.href = url.href;
      });
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    var url;
    try {
      url = new URL(link.getAttribute("href"), window.location.href);
    } catch (error) {
      return;
    }
    if (!isPage(url)) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    event.preventDefault();
    swap(url, true);
  }, true);

  window.addEventListener("popstate", function () {
    swap(new URL(window.location.href), false);
  });
})();
