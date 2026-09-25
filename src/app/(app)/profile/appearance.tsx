"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { applyThemePref, type ThemePref } from "@/lib/theme";
import { setThemeAction } from "./actions";

const OPTIONS: { value: ThemePref; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", hint: "Bright background, best in daylight", icon: Sun },
  { value: "dark", label: "Dark", hint: "Easier on the eyes in low light", icon: Moon },
  { value: "system", label: "System default", hint: "Follow this device's setting", icon: Monitor },
];

/** Miniature of the app shell in a given palette (fixed colours, so it previews correctly in either theme). */
function Preview({ mode }: { mode: "light" | "dark" }) {
  const c =
    mode === "light"
      ? { bg: "#fbfbfb", side: "#ffffff", card: "#ffffff", line: "#e5e7eb", text: "#24272c", muted: "#cbd5e1", head: "#ededed" }
      : { bg: "#0e1318", side: "#161c23", card: "#161c23", line: "#2a343f", text: "#e4e9ee", muted: "#384350", head: "#1d252e" };
  return (
    <div className="flex h-full w-full" style={{ background: c.bg }}>
      <div className="flex w-[30%] flex-col gap-1.5 p-2" style={{ background: c.side, borderRight: `1px solid ${c.line}` }}>
        <div className="h-3 w-3 rounded-[3px]" style={{ background: "#4d4e50" }} />
        <div className="mt-1 h-1.5 rounded" style={{ background: "#01637e" }} />
        <div className="h-1.5 rounded" style={{ background: c.muted }} />
        <div className="h-1.5 w-3/4 rounded" style={{ background: c.muted }} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div className="h-2 w-1/2 rounded" style={{ background: c.text, opacity: 0.8 }} />
        <div className="flex gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-6 flex-1 rounded" style={{ background: c.card, border: `1px solid ${c.line}` }} />
          ))}
        </div>
        <div className="flex-1 rounded" style={{ background: c.card, border: `1px solid ${c.line}` }}>
          <div className="h-2 rounded-t" style={{ background: c.head }} />
        </div>
        <div className="h-2 w-8 self-end rounded" style={{ background: "#01637e" }} />
      </div>
    </div>
  );
}

export function AppearancePicker({ initial }: { initial: ThemePref }) {
  const [pref, setPref] = useState<ThemePref>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const choose = (value: ThemePref) => {
    const previous = pref;
    setPref(value);
    applyThemePref(value); // instant, before the save round-trip
    start(async () => {
      const r = await setThemeAction(value);
      if (r.ok) setMsg({ ok: true, text: "Saved — applies on every device you sign in on." });
      else {
        setPref(previous);
        applyThemePref(previous);
        setMsg({ ok: false, text: r.error ?? "Could not save" });
      }
    });
  };

  return (
    <div>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => {
          const active = pref === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => choose(o.value)}
              className={clsx(
                "group relative overflow-hidden rounded-xl border-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                active ? "border-brand-600 shadow-sm" : "border-slate-200 hover:border-brand-300",
              )}
            >
              <div className="h-24 w-full overflow-hidden border-b border-slate-200">
                {o.value === "system" ? (
                  <div className="relative h-full w-full">
                    <div className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}>
                      <Preview mode="light" />
                    </div>
                    <div className="absolute inset-0" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>
                      <Preview mode="dark" />
                    </div>
                  </div>
                ) : (
                  <Preview mode={o.value} />
                )}
              </div>
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                <Icon size={18} className={active ? "mt-0.5 text-brand-600" : "mt-0.5 text-slate-500"} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{o.label}</div>
                  <div className="text-xs text-slate-500">{o.hint}</div>
                </div>
                {active && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {msg && <p className={clsx("mt-3 text-sm", msg.ok ? "text-emerald-700" : "text-red-700")}>{msg.text}</p>}
    </div>
  );
}
