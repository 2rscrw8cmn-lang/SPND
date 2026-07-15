"use client";

import { useEffect, useState } from "react";

export function AppLifecycle() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;
  return <div className="offline-banner" role="status"><strong>Offline</strong><span>Showing last-known values. Changes cannot be saved until you reconnect.</span></div>;
}
