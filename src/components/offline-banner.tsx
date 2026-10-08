"use client";

import { useEffect, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Registers the service worker (fast loading, offline page) and shows a clear
 * banner while the device is offline, since changes can't be saved then.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 print:hidden"
    >
      You&apos;re offline. You can look around, but changes won&apos;t save until you&apos;re back online.
    </div>
  );
}
