"use client";

import { useEffect } from "react";
import { applyThemePref, parseThemePref, THEME_COOKIE, type ThemePref } from "@/lib/theme";

/** Follows the device setting live while the preference is "system". */
export function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (document.documentElement.getAttribute("data-theme") === "system") applyThemePref("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}

/** Brings this browser in line with the preference saved on the user's account (e.g. set on another device). */
export function ThemeSync({ pref }: { pref: ThemePref }) {
  useEffect(() => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith(`${THEME_COOKIE}=`))?.split("=")[1];
    if (parseThemePref(cookie) !== pref || document.documentElement.getAttribute("data-theme") !== pref) applyThemePref(pref);
  }, [pref]);
  return null;
}
