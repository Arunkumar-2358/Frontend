"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Bell, CheckCheck, ClipboardList, Flag, UserPlus, Upload, CalendarClock, Info } from "lucide-react";
import { markAllReadAction, markReadAction } from "@/app/(app)/notifications/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type BellItem = { id: string; kind: string; title: string; body: string | null; link: string | null; read: boolean; ago: string };

export const KIND_ICON = { TASK: ClipboardList, LEAD_ASSIGNED: UserPlus, RED_FLAG: Flag, CAPA: Flag, IMPORT: Upload, INTERVIEW: CalendarClock, SYSTEM: Info } as const;

/** Header bell: a Radix dropdown menu (arrow keys, Esc, focus return), non-modal like before. */
export function NotificationBell({ unread, items }: { unread: number; items: BellItem[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-full p-2 text-ink hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:outline-none" aria-label={`Notifications (${unread} unread)`}>
          <Bell size={22} strokeWidth={1.8} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] leading-[18px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] border-slate-200 bg-white p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-ink">Notifications</span>
          {unread > 0 && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault(); // keep the menu open, as before
                start(() => markAllReadAction());
              }}
              className="gap-1 px-1 py-0.5 text-xs font-medium text-brand-600 hover:underline data-[highlighted]:bg-transparent data-[highlighted]:underline"
            >
              <CheckCheck size={14} /> Mark all read
            </DropdownMenuItem>
          )}
        </div>
        <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
          {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-400">You&apos;re all caught up.</div>}
          {items.map((n) => {
            const Icon = KIND_ICON[n.kind as keyof typeof KIND_ICON] ?? Info;
            return (
              <DropdownMenuItem
                key={n.id}
                onSelect={() =>
                  start(async () => {
                    if (!n.read) await markReadAction(n.id);
                    if (n.link) router.push(n.link);
                  })
                }
                className={clsx("cursor-pointer items-stretch gap-3 rounded-none px-4 py-3 text-left data-[highlighted]:bg-slate-50", !n.read && "bg-brand-50/60")}
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
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuItem asChild className="block rounded-none border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 data-[highlighted]:bg-slate-50">
          <Link href="/notifications">View all notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
