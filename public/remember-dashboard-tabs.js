/**
 * Remember last History / Devices query strings and restore on bare URLs.
 */
(function () {
  var HISTORY_KEY = "tt-last-history-qs";
  var DEVICES_KEY = "tt-last-devices-qs";

  function pathOnly(pathname) {
    return pathname.replace(/\/+$/, "") || "/";
  }

  function remember(key, search) {
    try {
      if (search && search !== "?") {
        localStorage.setItem(key, search);
      }
    } catch (_) {}
  }

  function restore(key, barePaths) {
    var path = pathOnly(location.pathname);
    if (barePaths.indexOf(path) === -1) return;
    if (location.search && location.search !== "?") {
      remember(key, location.search);
      return;
    }
    try {
      var saved = localStorage.getItem(key);
      if (saved && saved !== "?" && saved.indexOf("=") !== -1) {
        location.replace(path + saved);
      }
    } catch (_) {}
  }

  var path = pathOnly(location.pathname);
  if (path === "/dashboard/history") {
    if (location.search && location.search !== "?") {
      remember(HISTORY_KEY, location.search);
    } else {
      restore(HISTORY_KEY, ["/dashboard/history"]);
    }
  }

  if (path === "/dashboard/devices" || path === "/dashboard/devices") {
    if (location.search && location.search !== "?") {
      remember(DEVICES_KEY, location.search);
    } else {
      restore(DEVICES_KEY, ["/dashboard/devices", "/dashboard/devices"]);
    }
  }

  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      var action = form.getAttribute("action") || "";
      var method = (form.getAttribute("method") || "get").toLowerCase();
      if (method !== "get") return;
      if (action.indexOf("/dashboard/history") !== -1 || path === "/dashboard/history") {
        try {
          var fd = new FormData(form);
          var params = new URLSearchParams();
          fd.forEach(function (value, name) {
            if (value != null && String(value) !== "") params.set(name, String(value));
          });
          var qs = params.toString();
          if (qs) remember(HISTORY_KEY, "?" + qs);
        } catch (_) {}
      }
    },
    true,
  );
})();
