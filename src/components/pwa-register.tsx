"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Registers the service worker once per app load, and follows a notification tap to its page. */
export function PwaRegister() {
  const router = useRouter();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* PWA features are an enhancement; failing quietly keeps the app usable */
    });
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "notification-click" && typeof e.data.url === "string") router.push(e.data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);
  return null;
}
