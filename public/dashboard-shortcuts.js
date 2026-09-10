/**
 * Dashboard keyboard shortcuts:
 *   g then o/d/a/h/f/l/p/s — navigate
 *   s — focus snooze action
 *   ? — cheat sheet
 */
(function () {
  var chord = null;
  var chordTimer = null;
  var sheet = null;

  function isTypingTarget(el) {
    if (!el || !(el instanceof Element)) return false;
    var tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return Boolean(el.closest("[contenteditable='true']"));
  }

  function go(path) {
    location.assign(path);
  }

  function hideSheet() {
    if (sheet) sheet.hidden = true;
  }

  function showSheet() {
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "tt-shortcut-sheet";
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-label", "Keyboard shortcuts");
      sheet.innerHTML =
        '<div class="tt-shortcut-panel">' +
        "<h2>Keyboard shortcuts</h2>" +
        "<ul>" +
        "<li><kbd>g</kbd> then <kbd>o</kbd> Overview</li>" +
        "<li><kbd>g</kbd> then <kbd>d</kbd> Devices</li>" +
        "<li><kbd>g</kbd> then <kbd>a</kbd> Alerts</li>" +
        "<li><kbd>g</kbd> then <kbd>h</kbd> History</li>" +
        "<li><kbd>g</kbd> then <kbd>f</kbd> Household</li>" +
        "<li><kbd>g</kbd> then <kbd>l</kbd> Share links</li>" +
        "<li><kbd>g</kbd> then <kbd>n</kbd> Plans</li>" +
        "<li><kbd>g</kbd> then <kbd>p</kbd> Portfolio</li>" +
        "<li><kbd>g</kbd> then <kbd>s</kbd> Settings</li>" +
        "<li><kbd>s</kbd> Focus snooze</li>" +
        "<li><kbd>?</kbd> This cheat sheet</li>" +
        "<li><kbd>Esc</kbd> Close</li>" +
        "</ul>" +
        '<button type="button" class="btn-secondary btn-sm" data-close>Close</button>' +
        "</div>";
      document.body.appendChild(sheet);
      sheet.addEventListener("click", function (event) {
        if (event.target === sheet || event.target.getAttribute("data-close") != null) {
          hideSheet();
        }
      });
      var style = document.createElement("style");
      style.textContent =
        "#tt-shortcut-sheet{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:10000}" +
        "#tt-shortcut-sheet[hidden]{display:none!important}" +
        ".tt-shortcut-panel{background:var(--color-surface,#111);color:var(--color-text,#eee);border:1px solid var(--color-border,#333);border-radius:.75rem;padding:1.25rem;max-width:22rem;width:90%}" +
        ".tt-shortcut-panel ul{padding-left:1.1rem;margin:0.75rem 0 1rem}" +
        ".tt-shortcut-panel kbd{font-size:.75rem;border:1px solid var(--color-border,#444);padding:.1rem .35rem;border-radius:.25rem}";
      document.head.appendChild(style);
    }
    sheet.hidden = false;
  }

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;

    if (event.key === "Escape") {
      hideSheet();
      chord = null;
      return;
    }

    if (event.key === "?" || (event.shiftKey && event.key === "/")) {
      event.preventDefault();
      showSheet();
      return;
    }

    if (chord === "g") {
      chord = null;
      if (chordTimer) clearTimeout(chordTimer);
      var map = {
        o: "/dashboard",
        d: "/dashboard/devices",
        a: "/dashboard/alerts",
        h: "/dashboard/history",
        f: "/dashboard/household",
        l: "/dashboard/share/links",
        n: "/dashboard/plans",
        p: "/dashboard/portfolio",
        s: "/dashboard/settings",
      };
      if (map[event.key]) {
        event.preventDefault();
        go(map[event.key]);
      }
      return;
    }

    if (event.key === "g") {
      chord = "g";
      if (chordTimer) clearTimeout(chordTimer);
      chordTimer = setTimeout(function () {
        chord = null;
      }, 1200);
      return;
    }

    if (event.key === "s") {
      var snooze = document.getElementById("overview-snooze-action");
      if (snooze) {
        event.preventDefault();
        snooze.focus();
      }
    }
  });
})();
