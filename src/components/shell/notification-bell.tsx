"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Bell, CheckCheck, ClipboardList, Flag, UserPlus, Upload, CalendarClock, Info } from "lucide-react";
import { markAllReadAction, markReadAction } from "@/app/(app)/notifications/actions";

export type BellItem = { id: string; kind: string; title: string; body: string | null; link: string | null; read: boolean; ago: string };

export const KIND_ICON = { TASK: ClipboardList, LEAD_ASSIGNED: UserPlus, RED_FLAG: Flag, CAPA: Flag, IMPORT: Upload, INTERVIEW: CalendarClock, SYSTEM: Info } as const;

export function NotificationBell({ unread, items }: { unread: number; items: BellItem[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-full p-2 text-ink hover:bg-slate-100" aria-label={`Notifications (${unread} unread)`}>
        <Bell size={22} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] leading-[18px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unread > 0 && (
              <button onClick={() => start(() => markAllReadAction())} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400">You&apos;re all caught up.</li>}
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind as keyof typeof KIND_ICON] ?? Info;
              return (
                <li key={n.id}>
                  <button
                    onClick={() =>
                      start(async () => {
                        if (!n.read) await markReadAction(n.id);
                        setOpen(false);
                        if (n.link) router.push(n.link);
                      })
                    }
                    className={clsx("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.read && "bg-brand-50/60")}
                  >
                    <span className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.kind === "RED_FLAG" || n.kind === "CAPA" ? "bg-red-50 text-accent" : "bg-brand-100 text-brand-700")}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block text-sm", n.read ? "text-slate-700" : "font-semibold text-ink")}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                      <span className="block text-[11px] text-slate-400">{n.ago}</span>
                    </span>
                    {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
