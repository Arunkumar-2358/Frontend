"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export const ADMIN_SECTIONS = [
  { href: "/admin/users", label: "Users & roles" },
  { href: "/admin/rules", label: "Assignment rules" },
  { href: "/admin/templates", label: "Message templates" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/holidays", label: "Holidays" },
  { href: "/admin/targets", label: "KPI targets" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/deletions", label: "Data deletion" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/jobs", label: "Scheduled jobs" },
];

export function AdminSubnav() {
  const path = usePathname();
  return (
    <nav className="no-print mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
      {ADMIN_SECTIONS.map((s) => {
        const active = path === s.href || path.startsWith(s.href + "/");
        return (
          <Link key={s.href} href={s.href} className={clsx("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap", active ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
