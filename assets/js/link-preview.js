// Hover preview for outbound links marked with data-link-preview: a small
// card with the page's image, title and destination domain, like a chat-app
// link unfurl. External pages (LinkedIn, Coursera) block live embedding, so
// the image comes from this site via data-preview-image.
(function () {
  "use strict";

  if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var card = null;
  var hideTimer = null;

  function build() {
    card = document.createElement("div");
    card.className = "link-preview";
    card.setAttribute("aria-hidden", "true");
    card.innerHTML =
      '<img class="link-preview__image" alt="" />' +
      '<span class="link-preview__body"><span class="link-preview__title"></span>' +
      '<span class="link-preview__domain"></span></span>';
    document.body.appendChild(card);
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

  function show(link, event) {
    if (!card) build();
    window.clearTimeout(hideTimer);
    var image = link.getAttribute("data-preview-image");
    var img = card.querySelector(".link-preview__image");
    img.hidden = !image;
    if (image) img.src = image;
    card.querySelector(".link-preview__title").textContent = link.getAttribute("data-preview-title") || link.textContent.trim();
    var domain = "";
    try {
      domain = new URL(link.href).hostname.replace(/^www\./, "");
    } catch (_) {}
    card.querySelector(".link-preview__domain").textContent = domain + " ↗";
    place(event);
    card.classList.add("is-visible");
  }

  function hide() {
    if (!card) return;
    card.classList.remove("is-visible");
  }

  document.addEventListener("pointerover", function (event) {
    var link = event.target.closest && event.target.closest("[data-link-preview]");
    if (link) show(link, event);
  });
  document.addEventListener("pointermove", function (event) {
    if (card && card.classList.contains("is-visible") && event.target.closest("[data-link-preview]")) place(event);
  });
  document.addEventListener("pointerout", function (event) {
    var link = event.target.closest && event.target.closest("[data-link-preview]");
    if (link && !link.contains(event.relatedTarget)) hideTimer = window.setTimeout(hide, 60);
  });
  window.addEventListener("scroll", hide, { passive: true });
})();
