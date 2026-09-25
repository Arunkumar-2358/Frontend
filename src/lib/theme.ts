/** Theme preference shared by server and client (no server-only imports). */
export const THEME_COOKIE = "nt_theme";
export const THEME_PREFS = ["light", "dark", "system"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];

export function parseThemePref(v: unknown): ThemePref {
  return THEME_PREFS.includes(v as ThemePref) ? (v as ThemePref) : "system";
}

/** Runs before first paint (inline in <head>) so the page never flashes the wrong theme. */
export const THEME_BOOT_SCRIPT = `(function(){try{var e=document.documentElement,p=e.getAttribute('data-theme')||'system',d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

/** Apply a preference on the client immediately (and remember it in the cookie). */
export function applyThemePref(pref: ThemePref) {
  const el = document.documentElement;
  el.setAttribute("data-theme", pref);
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  document.cookie = `${THEME_COOKIE}=${pref}; path=/; max-age=31536000; samesite=lax`;
}
