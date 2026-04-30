(function () {
  var modal = document.getElementById("command-palette");
  var backdrop = document.getElementById("command-palette-backdrop");
  var input = document.getElementById("command-palette-input");
  var list = document.getElementById("command-palette-results");
  var title = document.getElementById("command-palette-title");
  if (!modal || !input || !list) return;

  var mode = "search";
  var index = [];
  var indexLoaded = false;

  var themes = [
    ["Andromeda", "andromeda", "/andromeda"],
    ["Dracula", "dracula", "/dracula"],
    ["Monokai", "monokai", "/monokai"],
    ["Gruvbox Dark", "gruvbox-dark", "/gruvbox"],
    ["Solarized Dark", "solarized-dark", "/solarized"],
    ["VSCode Dark", "vscode-dark", "/vscode"],
    ["Abyss", "abyss", "/abyss"],
    ["Neo Brutal", "neo-brutal", "/neo-brutal"],
    ["Cyberpunk", "cyberpunk", "/cyberpunk"],
    ["Tokyo Night", "tokyo-night", "/tokyo"],
    ["Mono", "mono", "/mono"],
  ];
  var styles = [
    ["Minimal", "minimal", "/style-minimal"],
    ["Material", "material", "/style-material"],
    ["NeoBrutalism", "neobrutalism", "/style-neobrutal"],
    ["Terminal", "terminal", "/style-terminal"],
    ["Glassmorphism", "glassmorphism", "/style-glass"],
  ];
  var shortcuts = [
    ["Command Palette (Global)", "Ctrl + Shift + P"],
    ["Search", "Ctrl + K"],
    ["Theme Picker", "Ctrl + P"],
    ["Style Switcher", "Ctrl + S"],
    ["Help / Shortcuts List", "Ctrl + /"],
    ["View Source on GitHub", "Ctrl + Shift + G"],
  ];

  function siteRoot() {
    var p = document.documentElement.getAttribute("data-site-path") || "";
    return p === "/" || !p ? "" : p.replace(/\/$/, "");
  }
  function withBase(path) {
    if (!path) return "/";
    if (path.startsWith("http")) return path;
    var p = path.startsWith("/") ? path : "/" + path;
    return siteRoot() ? siteRoot() + p : p;
  }

  var commands = [
    { title: "Home", url: withBase("/"), hint: "/home", cmd: "/home", summary: "Open the landing page" },
    { title: "About", url: withBase("/about/"), hint: "/about", cmd: "/about", summary: "Open about" },
    { title: "Projects", url: withBase("/blog/"), hint: "/projects", cmd: "/projects", summary: "Open projects" },
    { title: "Contact", url: withBase("/contact/"), hint: "/contact", cmd: "/contact", summary: "Open contact" },
    { title: "Search", url: "#mode-search", hint: "Ctrl + K", cmd: "/search", summary: "Search site content" },
    { title: "Theme Picker", url: "#mode-themes", hint: "Ctrl + P", cmd: "/themes", summary: "Switch color theme" },
    { title: "Style Switcher", url: "#mode-styles", hint: "Ctrl + S", cmd: "/styles", summary: "Switch UI style" },
    { title: "Help / Shortcuts", url: "#mode-help", hint: "Ctrl + /", cmd: "/help", summary: "Show shortcuts" },
    { title: "View Source on GitHub", url: "https://github.com/azzammasood/azzammasood.github.io", hint: "Ctrl + Shift + G", cmd: "/source", summary: "Open repository" },
  ]
    .concat(themes.map(function (t) { return { title: t[0] + " theme", url: "#theme-" + t[1], hint: t[2], cmd: t[2], summary: "Apply color theme" }; }))
    .concat(styles.map(function (s) { return { title: s[0] + " style", url: "#style-" + s[1], hint: s[2], cmd: s[2], summary: "Apply UI style" }; }));

  function applyTheme(id) {
    if (window.portfolioThemes && window.portfolioThemes.apply) window.portfolioThemes.apply(id);
    else {
      document.documentElement.dataset.codeTheme = id;
      document.documentElement.classList.toggle("dark", id !== "mono" && id !== "neo-brutal");
      localStorage.setItem("code-theme", id);
    }
  }
  function applyStyle(id) {
    if (window.portfolioStyles && window.portfolioStyles.apply) window.portfolioStyles.apply(id);
    else {
      document.documentElement.dataset.uiStyle = id;
      localStorage.setItem("ui-style", id);
    }
  }
  function loadIndex() {
    if (indexLoaded) return Promise.resolve();
    return fetch(withBase("/searchindex.json")).then(function (r) { return r.ok ? r.json() : []; }).then(function (data) {
      index = Array.isArray(data) ? data : data.pages || data.items || [];
      indexLoaded = true;
    }).catch(function () { index = []; indexLoaded = true; });
  }
  function normalize(s) { return (s || "").toLowerCase().trim(); }
  function escapeHtml(t) {
    var d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }
  function item(title, url, summary, hint) { return { title: title, url: url, summary: summary || "", hint: hint || "" }; }
  function render(items) {
    list.innerHTML = "";
    if (!items.length) items = [item("No matches", "", "Try another command or keyword.", "")];
    items.forEach(function (it) {
      var li = document.createElement("li");
      li.className = "command-palette-item cursor-pointer rounded-lg px-3 py-2.5 text-text-dark hover:bg-light dark:text-white dark:hover:bg-darkmode-light";
      li.dataset.url = it.url || "";
      li.innerHTML = '<div class="flex items-center justify-between gap-4"><span class="font-medium">' + escapeHtml(it.title) + '</span>' + (it.hint ? '<kbd class="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] dark:border-darkmode-border">' + escapeHtml(it.hint) + "</kbd>" : "") + "</div>" + (it.summary ? '<div class="mt-0.5 text-xs text-text-light dark:text-darkmode-text-light">' + escapeHtml(it.summary) + "</div>" : "");
      li.addEventListener("mousedown", function (e) { e.preventDefault(); go(it.url); });
      list.appendChild(li);
    });
  }
  function setMode(next) {
    mode = next;
    var labels = { search: "Search", commands: "Command Palette", themes: "Theme Picker", styles: "Style Switcher", help: "Shortcuts" };
    if (title) title.textContent = labels[mode] || "Command Palette";
    input.placeholder = mode === "search" ? "Search site content" : mode === "themes" ? "Pick a theme" : mode === "styles" ? "Pick a UI style" : "Type a command";
  }
  function showDefault() {
    if (mode === "themes") return render(themes.map(function (t) { return item(t[0], "#theme-" + t[1], "Apply color theme", t[2]); }));
    if (mode === "styles") return render(styles.map(function (s) { return item(s[0], "#style-" + s[1], "Apply UI style", s[2]); }));
    if (mode === "help") return render(shortcuts.map(function (s) { return item(s[0], "", "", s[1]); }));
    if (mode === "commands") return render(commands.map(function (c) { return item(c.title, c.url, c.summary, c.hint); }));
    render([]);
  }
  function filter(q) {
    var n = normalize(q);
    if (!n) return showDefault();
    var source = mode === "themes" ? themes.map(function (t) { return item(t[0], "#theme-" + t[1], "Apply color theme", t[2]); })
      : mode === "styles" ? styles.map(function (s) { return item(s[0], "#style-" + s[1], "Apply UI style", s[2]); })
      : commands.map(function (c) { return item(c.title, c.url, c.summary, c.hint); });
    var out = source.filter(function (x) { return normalize(x.title + " " + x.summary + " " + x.hint).indexOf(n) !== -1; });
    if (mode === "search") {
      index.forEach(function (p) {
        var text = (p.title || "") + " " + (p.summary || p.description || "");
        if (normalize(text).indexOf(n) !== -1) out.push(item(p.title, p.url || p.permalink || p.relpermalink, (p.summary || p.description || "").slice(0, 150), ""));
      });
    }
    render(out.slice(0, 24));
  }
  function open(nextMode) {
    setMode(nextMode || "search");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    input.value = "";
    document.body.style.overflow = "hidden";
    (mode === "search" ? loadIndex() : Promise.resolve()).then(function () { showDefault(); input.focus(); });
  }
  function close() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    input.value = "";
    list.innerHTML = "";
  }
  function go(url) {
    if (!url) return;
    if (url === "#mode-search") return open("search");
    if (url === "#mode-themes") return open("themes");
    if (url === "#mode-styles") return open("styles");
    if (url === "#mode-help") return open("help");
    if (url.indexOf("#theme-") === 0) { applyTheme(url.replace("#theme-", "")); close(); return; }
    if (url.indexOf("#style-") === 0) { applyStyle(url.replace("#style-", "")); close(); return; }
    window.location.href = url;
  }

  document.querySelectorAll('[data-target="search-modal"],[data-command-palette-open]').forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); open(el.hasAttribute("data-command-palette-open") ? "commands" : "search"); });
  });
  document.querySelectorAll("[data-code-theme-toggle]").forEach(function (el) {
    el.addEventListener("dblclick", function (e) { e.preventDefault(); open("themes"); });
  });
  if (backdrop) backdrop.addEventListener("click", close);
  document.querySelectorAll("[data-command-palette-close]").forEach(function (el) { el.addEventListener("click", close); });
  document.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if (e.key === "Escape" && !modal.classList.contains("hidden")) close();
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && k === "p") { e.preventDefault(); open("commands"); }
    else if ((e.ctrlKey || e.metaKey) && k === "k") { e.preventDefault(); open("search"); }
    else if ((e.ctrlKey || e.metaKey) && k === "p") { e.preventDefault(); open("themes"); }
    else if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); open("styles"); }
    else if ((e.ctrlKey || e.metaKey) && k === "/") { e.preventDefault(); open("help"); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && k === "g") { e.preventDefault(); window.location.href = "https://github.com/azzammasood/azzammasood.github.io"; }
  });
  input.addEventListener("input", function () { filter(input.value); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var first = list.querySelector(".command-palette-item");
      if (first && first.dataset.url) go(first.dataset.url);
    }
  });
})();
