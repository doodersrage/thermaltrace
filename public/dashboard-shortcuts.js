/**
 * Dashboard command palette + keyboard shortcuts:
 *   / or Ctrl/Cmd+K — search pages and properties
 *   g then o/v/d/a/h/f/l/n/p/s — navigate
 *   s — focus snooze action
 *   ? — cheat sheet in the same dialog
 */
(function () {
  var chord = null;
  var chordTimer = null;
  var dialog = null;
  var input = null;
  var list = null;
  var hint = null;
  var items = [];
  var filtered = [];
  var selected = 0;
  var mode = "search";

  var pages = [
    { label: "Overview", path: "/dashboard", keys: "g o", keywords: "home status" },
    { label: "Live", path: "/dashboard/live", keys: "g v", keywords: "probes now" },
    { label: "Devices", path: "/dashboard/devices", keys: "g d", keywords: "sensors ingest" },
    { label: "Alerts", path: "/dashboard/alerts", keys: "g a", keywords: "freeze email" },
    { label: "History", path: "/dashboard/history", keys: "g h", keywords: "charts csv" },
    { label: "Household", path: "/dashboard/household", keys: "g f", keywords: "family invite" },
    { label: "Share links", path: "/dashboard/share/links", keys: "g l", keywords: "family live" },
    { label: "Plans", path: "/dashboard/plans", keys: "g n", keywords: "billing upgrade" },
    { label: "Portfolio", path: "/dashboard/portfolio", keys: "g p", keywords: "properties" },
    { label: "Settings", path: "/dashboard/settings", keys: "g s", keywords: "theme display" },
  ];

  var adminPages = [
    { label: "Ops", path: "/dashboard/ops", keys: "", keywords: "admin" },
    { label: "Feed health", path: "/dashboard/feeds", keys: "", keywords: "admin" },
    { label: "Jobs", path: "/dashboard/jobs", keys: "", keywords: "admin cron" },
    { label: "Email suppressions", path: "/dashboard/email-suppressions", keys: "", keywords: "admin bounce" },
    { label: "Users", path: "/dashboard/users", keys: "", keywords: "admin" },
    { label: "Contacts", path: "/dashboard/contacts", keys: "", keywords: "admin" },
  ];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function isTypingTarget(el) {
    if (!el || !(el instanceof Element)) return false;
    var tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return Boolean(el.closest("[contenteditable='true']"));
  }

  function commandData() {
    var node = document.getElementById("tt-dashboard-command-data");
    if (!node) return { isAdmin: false, showPortfolio: false, households: [], activeHouseholdId: null };
    try {
      return JSON.parse(node.getAttribute("data-payload") || "{}");
    } catch {
      return { isAdmin: false, showPortfolio: false, households: [], activeHouseholdId: null };
    }
  }

  function buildItems() {
    var data = commandData();
    var out = pages.slice();
    if (!data.showPortfolio) {
      out = out.filter(function (item) {
        return item.path !== "/dashboard/portfolio";
      });
    }
    if (data.isAdmin) out = out.concat(adminPages);
    (data.households || []).forEach(function (household) {
      if (!household || !household.id || !household.name) return;
      if (household.id === data.activeHouseholdId && (data.households || []).length < 2) return;
      out.push({
        label: "Switch to " + household.name,
        path: null,
        keys: "",
        keywords: "property household " + household.name,
        householdId: household.id,
      });
    });
    items = out;
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.id = "tt-command-dialog";
    dialog.className = "tt-command-dialog";
    dialog.setAttribute("aria-label", "Dashboard search");
    dialog.innerHTML =
      '<div class="tt-command-panel">' +
      '<input class="tt-command-input" type="search" placeholder="Go to a page or property…" autocomplete="off" aria-label="Search dashboard">' +
      '<ul class="tt-command-list" role="listbox"></ul>' +
      '<p class="tt-command-hint"></p>' +
      "</div>";
    document.body.appendChild(dialog);
    input = dialog.querySelector(".tt-command-input");
    list = dialog.querySelector(".tt-command-list");
    hint = dialog.querySelector(".tt-command-hint");

    input.addEventListener("input", function () {
      mode = "search";
      renderList(input.value);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selected = Math.min(filtered.length - 1, selected + 1);
        paintSelection();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selected = Math.max(0, selected - 1);
        paintSelection();
      } else if (event.key === "Enter") {
        event.preventDefault();
        runSelected();
      }
    });
    list.addEventListener("click", function (event) {
      var btn = event.target instanceof Element ? event.target.closest("[data-command-index]") : null;
      if (!btn) return;
      selected = Number(btn.getAttribute("data-command-index") || "0");
      runSelected();
    });
    dialog.addEventListener("close", function () {
      mode = "search";
      if (input) input.value = "";
    });
  }

  function paintSelection() {
    if (!list) return;
    Array.prototype.forEach.call(list.querySelectorAll(".tt-command-item"), function (btn, index) {
      btn.setAttribute("aria-selected", index === selected ? "true" : "false");
    });
  }

  function renderList(query) {
    if (!list || !hint) return;
    var q = (query || "").trim().toLowerCase();
    if (mode === "help") {
      list.innerHTML =
        "<li><button type='button' class='tt-command-item' disabled><span>g then o / v / d / a / h</span><kbd class='tt-command-kbd'>nav</kbd></button></li>" +
        "<li><button type='button' class='tt-command-item' disabled><span>/ or Ctrl+K</span><kbd class='tt-command-kbd'>search</kbd></button></li>" +
        "<li><button type='button' class='tt-command-item' disabled><span>s</span><kbd class='tt-command-kbd'>snooze</kbd></button></li>" +
        "<li><button type='button' class='tt-command-item' disabled><span>Esc</span><kbd class='tt-command-kbd'>close</kbd></button></li>";
      hint.textContent = "Type to search pages and properties.";
      filtered = [];
      return;
    }
    filtered = items.filter(function (item) {
      if (!q) return true;
      return (
        item.label.toLowerCase().indexOf(q) !== -1 ||
        (item.keywords && item.keywords.toLowerCase().indexOf(q) !== -1) ||
        (item.path && item.path.toLowerCase().indexOf(q) !== -1)
      );
    });
    selected = 0;
    if (filtered.length === 0) {
      list.innerHTML = "<li><p class='tt-command-empty'>No matches.</p></li>";
      hint.textContent = "Try Overview, Live, Alerts, or a property name.";
      return;
    }
    list.innerHTML = filtered
      .map(function (item, index) {
        var kbd = item.keys
          ? "<kbd class='tt-command-kbd'>" + item.keys + "</kbd>"
          : "";
        return (
          "<li><button type='button' class='tt-command-item' role='option' data-command-index='" +
          index +
          "' aria-selected='" +
          (index === 0 ? "true" : "false") +
          "'><span>" +
          escapeHtml(item.label) +
          "</span>" +
          kbd +
          "</button></li>"
        );
      })
      .join("");
    hint.textContent = "Enter to open · ? for shortcut list";
  }

  function runSelected() {
    var item = filtered[selected];
    if (!item) return;
    closeDialog();
    if (item.householdId) {
      var form = document.querySelector("[data-household-switch-form]");
      var select = form && form.querySelector("select[name='household_id']");
      if (form && select) {
        select.value = item.householdId;
        form.requestSubmit();
        return;
      }
    }
    if (item.path) location.assign(item.path);
  }

  function openDialog(nextMode) {
    ensureDialog();
    buildItems();
    mode = nextMode || "search";
    renderList(mode === "help" ? "" : (input && input.value) || "");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (mode === "search") input && input.focus();
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function dialogOpen() {
    return Boolean(dialog && dialog.open);
  }

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) return;
    if (dialogOpen() && event.key === "Escape") return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (dialogOpen()) closeDialog();
      else openDialog("search");
      return;
    }

    if (dialogOpen()) return;
    if (isTypingTarget(event.target)) return;

    if (event.key === "?" || (event.shiftKey && event.key === "/")) {
      event.preventDefault();
      openDialog("help");
      return;
    }

    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      openDialog("search");
      return;
    }

    if (chord === "g") {
      chord = null;
      if (chordTimer) clearTimeout(chordTimer);
      var map = {
        o: "/dashboard",
        v: "/dashboard/live",
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
        location.assign(map[event.key]);
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

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-tt-shortcut-help]")) {
      event.preventDefault();
      openDialog("search");
    }
  });
})();
