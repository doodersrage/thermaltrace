/**
 * Dashboard kiosk / shop mode: fullscreen + Screen Wake Lock for hands-free monitoring.
 */
import { useEffect, useState } from "preact/hooks";
import {
  KIOSK_ROUTE_STORAGE_KEY,
  KIOSK_STORAGE_KEY,
  kioskLandingPath,
  kioskRouteToRecord,
} from "../lib/dashboardKiosk";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

function readStoredFlag(): boolean {
  try {
    return localStorage.getItem(KIOSK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readLastRoute(): string | null {
  try {
    return localStorage.getItem(KIOSK_ROUTE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLastRoute(path: string | null) {
  try {
    if (path) localStorage.setItem(KIOSK_ROUTE_STORAGE_KEY, path);
  } catch {
    /* ignore */
  }
}

export default function KioskModeToggle() {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setActive(readStoredFlag());
    const nav = navigator as WakeLockNavigator;
    setSupported(
      typeof document !== "undefined" &&
        (Boolean(nav.wakeLock) || "fullscreenEnabled" in document),
    );
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-kiosk", active);
    try {
      localStorage.setItem(KIOSK_STORAGE_KEY, active ? "1" : "0");
    } catch {
      /* ignore */
    }

    const lockHolder: { current: WakeLockSentinelLike | null } = { current: null };
    let cancelled = false;
    const nav = navigator as WakeLockNavigator;

    async function requestWakeLock() {
      if (!active || !nav.wakeLock) return;
      try {
        const lock = await nav.wakeLock.request("screen");
        lockHolder.current = lock;
        lock.addEventListener?.("release", () => {
          if (!cancelled && document.body.classList.contains("is-kiosk")) {
            void requestWakeLock();
          }
        });
      } catch {
        /* user gesture / permission / unsupported */
      }
    }

    async function enterFullscreen() {
      if (!active || !document.fullscreenEnabled) return;
      if (document.fullscreenElement) return;
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* ignored */
      }
    }

    async function exitFullscreen() {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
    }

    if (active) {
      const recorded = kioskRouteToRecord(location.pathname);
      if (recorded) writeLastRoute(recorded);
      const landing = kioskLandingPath(location.pathname, readLastRoute());
      if (landing !== location.pathname) {
        location.assign(landing);
        return;
      }
      void enterFullscreen();
      void requestWakeLock();
    } else {
      void exitFullscreen();
      void lockHolder.current?.release();
      lockHolder.current = null;
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible" && active) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lockHolder.current?.release();
      document.body.classList.remove("is-kiosk");
    };
  }, [active]);

  if (!supported) return null;

  return (
    <button
      type="button"
      class="btn-ghost dashboard-kiosk-toggle"
      aria-pressed={active}
      title={
        active
          ? "Exit kiosk / shop mode"
          : "Kiosk / shop mode — fullscreen and keep screen awake"
      }
      onClick={() => setActive((v) => !v)}
    >
      {active ? "Exit kiosk" : "Kiosk mode"}
    </button>
  );
}
