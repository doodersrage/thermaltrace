/**
 * Keep ReadingAgeBadge labels honest without a full page reload.
 * Badges expose data-iso="..." from SSR.
 */
(function () {
  var LAG_MS = 30 * 60 * 1000;
  var STALE_MS = 2 * 60 * 60 * 1000;

  function formatRelativeAge(iso) {
    if (!iso) return { label: "Never", lagging: true, stale: true };
    var parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return { label: "Never", lagging: true, stale: true };
    var ms = Date.now() - parsed;
    if (ms < 0) return { label: "just now", lagging: false, stale: false };
    var minutes = Math.floor(ms / 60000);
    var label;
    if (minutes < 1) label = "just now";
    else if (minutes < 60) label = minutes + "m ago";
    else {
      var hours = Math.floor(minutes / 60);
      label = hours < 48 ? hours + "h ago" : Math.floor(hours / 24) + "d ago";
    }
    return {
      label: label,
      lagging: ms >= LAG_MS,
      stale: ms >= STALE_MS,
    };
  }

  function tick() {
    document.querySelectorAll("[data-iso]").forEach(function (el) {
      var iso = el.getAttribute("data-iso");
      if (!iso) return;
      var age = formatRelativeAge(iso);
      el.textContent = age.label;
      el.classList.remove(
        "reading-age-badge--ok",
        "reading-age-badge--warning",
        "reading-age-badge--danger",
        "reading-age-badge--neutral",
      );
      var tone = age.stale ? "danger" : age.lagging ? "warning" : "ok";
      el.classList.add("reading-age-badge--" + tone);
    });

    document.querySelectorAll("[data-live-age-iso]").forEach(function (el) {
      var iso = el.getAttribute("data-live-age-iso");
      if (!iso) return;
      var age = formatRelativeAge(iso);
      el.textContent = age.label;
      if (el.hasAttribute("data-live-age-tone")) {
        el.setAttribute(
          "data-tone",
          age.stale || age.lagging ? "warning" : "success",
        );
      }
    });
  }

  tick();
  setInterval(tick, 30000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") tick();
  });
})();
