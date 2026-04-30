(function () {
  var modal = document.getElementById("command-palette");
  var backdrop = document.getElementById("command-palette-backdrop");
  var input = document.getElementById("command-palette-input");
  var list = document.getElementById("command-palette-results");
  if (!modal || !input || !list) return;

  var index = [];
  var indexLoaded = false;

  function siteRoot() {
    var p = document.documentElement.getAttribute("data-site-path") || "";
    if (p === "/" || !p) return "";
    return p.replace(/\/$/, "");
  }

  function withBase(path) {
    if (!path) return "/";
    if (path.startsWith("http")) return path;
    var root = siteRoot();
    var p = path.startsWith("/") ? path : "/" + path;
    if (!root) return p;
    return root + p;
  }

  var commands = [
    { title: "Home", url: withBase("/"), hint: "/home", cmd: "/home" },
    { title: "About", url: withBase("/about/"), hint: "/about", cmd: "/about" },
    { title: "Projects", url: withBase("/blog/"), hint: "/projects", cmd: "/projects" },
    { title: "Contact", url: withBase("/contact/"), hint: "/contact", cmd: "/contact" },
    { title: "Andromeda theme", url: "#theme-andromeda", hint: "/andromeda", cmd: "/andromeda" },
    { title: "Dracula theme", url: "#theme-dracula", hint: "/dracula", cmd: "/dracula" },
    { title: "Monokai theme", url: "#theme-monokai", hint: "/monokai", cmd: "/monokai" },
    { title: "Gruvbox Dark theme", url: "#theme-gruvbox-dark", hint: "/gruvbox", cmd: "/gruvbox" },
    { title: "Solarized Dark theme", url: "#theme-solarized-dark", hint: "/solarized", cmd: "/solarized" },
    { title: "VSCode Dark theme", url: "#theme-vscode-dark", hint: "/vscode", cmd: "/vscode" },
    { title: "Mono theme", url: "#theme-mono", hint: "/mono", cmd: "/mono" },
    { title: "GitHub profile", url: "https://github.com/azzammasood", hint: "/github", cmd: "/github" },
    {
      title: "LinkedIn",
      url: "https://www.linkedin.com/in/azzammasood/",
      hint: "/linkedin",
      cmd: "/linkedin",
    },
  ];

  function setCodeTheme(theme) {
    if (window.portfolioThemes && window.portfolioThemes.apply) {
      window.portfolioThemes.apply(theme);
      return;
    }
    var darkThemes = ["andromeda", "dracula", "monokai", "gruvbox-dark", "solarized-dark", "vscode-dark"];
    document.documentElement.dataset.codeTheme = theme;
    document.documentElement.classList.toggle("dark", darkThemes.indexOf(theme) !== -1);
    localStorage.setItem("code-theme", theme);
    localStorage.setItem("theme", darkThemes.indexOf(theme) !== -1 ? "dark" : "light");
  }

  function loadIndex() {
    if (indexLoaded) return Promise.resolve();
    return fetch(withBase("/searchindex.json"))
      .then(function (r) {
        if (!r.ok) throw new Error("no index");
        return r.json();
      })
      .then(function (data) {
        index = Array.isArray(data) ? data : data.pages || data.items || [];
        indexLoaded = true;
      })
      .catch(function () {
        index = [];
        indexLoaded = true;
      });
  }

  function normalize(s) {
    return (s || "").toLowerCase().trim();
  }

  function render(items) {
    list.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("li");
      empty.className = "px-3 py-6 text-center text-text-light dark:text-darkmode-text-light";
      empty.textContent = "No matches. Try a command or different keywords.";
      list.appendChild(empty);
      return;
    }
    items.forEach(function (item, i) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.className =
        "command-palette-item cursor-pointer rounded-lg px-3 py-2.5 text-text-dark hover:bg-light dark:text-white dark:hover:bg-darkmode-light";
      li.dataset.url = item.url;
      li.innerHTML =
        '<div class="font-medium">' +
        escapeHtml(item.title) +
        "</div>" +
        (item.summary
          ? '<div class="mt-0.5 line-clamp-2 text-xs text-text-light dark:text-darkmode-text-light">' +
            escapeHtml(item.summary) +
            "</div>"
          : "") +
        (item.hint
          ? '<div class="mt-1 text-xs text-primary dark:text-darkmode-primary">' +
            escapeHtml(item.hint) +
            "</div>"
          : "");
      li.addEventListener("mousedown", function (e) {
        e.preventDefault();
        go(item.url);
      });
      list.appendChild(li);
    });
  }

  function escapeHtml(t) {
    var d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  function go(url) {
    if (!url) return;
    if (url.indexOf("#theme-") === 0) {
      setCodeTheme(url.replace("#theme-", ""));
      close();
      return;
    }
    window.location.href = url;
  }

  function filter(q) {
    var n = normalize(q);
    if (!n) {
      render(
        commands.map(function (c) {
          return { title: c.title, url: c.url, summary: "", hint: c.hint };
        })
      );
      return;
    }

    if (n.startsWith("/")) {
      var hits = commands.filter(function (c) {
        return normalize(c.cmd).startsWith(n) || normalize(c.hint).startsWith(n);
      });
      render(
        hits.map(function (c) {
          return { title: c.title, url: c.url, summary: "", hint: c.hint };
        })
      );
      return;
    }

    var out = [];
    commands.forEach(function (c) {
      if (normalize(c.title).includes(n) || normalize(c.hint).includes(n)) {
        out.push({ title: c.title, url: c.url, summary: "", hint: c.hint });
      }
    });
    index.forEach(function (p) {
      var title = p.title || "";
      var summary = p.summary || p.description || "";
      var url = p.url || p.permalink || p.relpermalink || "";
      if (!url) return;
      if (normalize(title).includes(n) || normalize(summary).includes(n)) {
        out.push({ title: title, url: url, summary: summary.slice(0, 160), hint: "" });
      }
    });
    render(out.slice(0, 20));
  }

  function open() {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    input.value = "";
    document.body.style.overflow = "hidden";
    loadIndex().then(function () {
      filter("");
      input.focus();
    });
  }

  function close() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    input.value = "";
    list.innerHTML = "";
  }

  document.querySelectorAll('[data-target="search-modal"]').forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      open();
    });
  });

  document.querySelectorAll("[data-command-palette-open]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      open();
    });
  });

  if (backdrop) {
    backdrop.addEventListener("click", close);
  }

  document.querySelectorAll("[data-command-palette-close]").forEach(function (el) {
    el.addEventListener("click", close);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      close();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (modal.classList.contains("hidden")) open();
      else close();
    }
  });

  input.addEventListener("input", function () {
    filter(input.value);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var first = list.querySelector(".command-palette-item");
      if (first && first.dataset.url) go(first.dataset.url);
    }
  });
})();
