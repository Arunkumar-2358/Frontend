"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, PanelLeft, Search, X, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { NAV_ICONS } from "@/components/nav-icons";
import { NotificationBell, type BellItem } from "./notification-bell";

export type ShellNavGroup = { group: string; items: { href: string; label: string; badge?: number }[] };
export type ShellUser = { name: string; roleText: string; teamPill: string };

const SINGLE_GROUPS = new Set(["Home", "Pipeline", "Vacancies", "Account"]);

export function AppShell({
  groups,
  user,
  unread,
  notifications,
  signOut,
  children,
}: {
  groups: ShellNavGroup[];
  user: ShellUser;
  unread: number;
  notifications: BellItem[];
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("nt-sidebar-collapsed") === "1");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [path]);

  // "/" jumps to search from anywhere (unless the user is typing in a field)
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) return setMobileOpen((v) => !v);
    setCollapsed((v) => {
      try {
        localStorage.setItem("nt-sidebar-collapsed", v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const all = groups.flatMap((g) => g.items);
  const current = [...all].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(i.href));
  const currentGroup = groups.find((g) => g.items.some((i) => i === current))?.group;
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const NavLink = ({ href, label, badge, nested }: { href: string; label: string; badge?: number; nested?: boolean }) => {
    const Icon = NAV_ICONS[href];
    const active = isActive(href);
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={clsx(
          "group flex items-center gap-3 rounded-lg py-2 text-[14.5px] transition",
          collapsed ? "justify-center px-2" : nested ? "pr-3 pl-10" : "px-3",
          active ? "bg-brand-600 font-medium text-white shadow-sm" : "text-ink hover:bg-slate-100",
        )}
      >
        {(!nested || collapsed) && Icon && <Icon size={18} strokeWidth={1.8} className={active ? "text-white" : "text-slate-600 group-hover:text-brand-600"} />}
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && badge ? <span className={clsx("rounded-full px-1.5 text-[11px] font-semibold", active ? "bg-white text-brand-700" : "bg-accent text-white")}>{badge}</span> : null}
      </Link>
    );
  };

  const sidebar = (
    <aside className={clsx("no-print flex h-full flex-col border-r border-slate-200 bg-white", collapsed ? "w-[76px]" : "w-[272px]")}>
      <div className={clsx("flex items-center border-b border-slate-100 py-4", collapsed ? "justify-center px-2" : "justify-between px-5")}>
        <Link href="/dashboard" aria-label="Nextenti Recruit CRM home">
          <BrandMark compact={collapsed} />
        </Link>
        <button className="text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {groups.map((g) => {
          if (SINGLE_GROUPS.has(g.group) || collapsed) return g.items.map((i) => <NavLink key={i.href} {...i} />);
          const isOpen = open[g.group] ?? g.group === currentGroup;
          const GroupIcon = NAV_ICONS[g.items[0].href];
          return (
            <div key={g.group}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.group]: !isOpen }))}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] text-ink hover:bg-slate-100"
              >
                {GroupIcon && <GroupIcon size={18} strokeWidth={1.8} className="text-slate-600" />}
                <span className="flex-1 text-left">{g.group}</span>
                {isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
              </button>
              {isOpen && <div className="mt-0.5 space-y-0.5">{g.items.map((i) => <NavLink key={i.href} {...i} nested />)}</div>}
            </div>
          );
        })}
      </nav>
      <div className={clsx("border-t border-slate-100 py-4", collapsed ? "px-2" : "px-4")}>
        <div className={clsx("flex items-center gap-3", collapsed && "justify-center")}>
          <Link href="/profile" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white" title="My profile">
            {initials}
          </Link>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <Link href="/profile" className="block truncate text-sm font-medium text-ink hover:text-brand-600">{user.name}</Link>
              <div className="truncate text-xs text-slate-500">{user.roleText}</div>
            </div>
          )}
          {!collapsed && (
            <form action={signOut}>
              <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-accent" title="Sign out" aria-label="Sign out">
                <LogOut size={17} />
              </button>
            </form>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={toggleCollapsed} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Toggle sidebar">
            <PanelLeft size={20} strokeWidth={1.8} />
          </button>
          <nav className="hidden min-w-0 shrink-0 items-center gap-2 text-[15px] whitespace-nowrap md:flex" aria-label="Breadcrumb">
            <Link href="/dashboard" className="text-slate-500 hover:text-brand-600">Home</Link>
            {currentGroup && !SINGLE_GROUPS.has(currentGroup) && (
              <>
                <ChevronRight size={15} className="hidden text-slate-400 xl:block" />
                <span className="hidden text-slate-600 xl:inline">{currentGroup}</span>
              </>
            )}
            {current && current.href !== "/dashboard" && (
              <>
                <ChevronRight size={15} className="text-slate-400" />
                <Link href={current.href} className="truncate font-medium text-ink">{current.label}</Link>
              </>
            )}
          </nav>
          <form action="/search" className="mx-auto hidden w-full max-w-md min-w-40 lg:block" role="search">
            <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-500 focus-within:ring-2 focus-within:ring-brand-200">
              <Search size={17} />
              <input
                ref={searchRef}
                name="q"
                required
                placeholder="Search leads, vacancies, clients…"
                aria-label="Search"
                className="w-full bg-transparent text-sm text-ink placeholder:text-slate-500 focus:outline-none"
              />
              <kbd className="hidden rounded border border-slate-300 px-1.5 text-[11px] text-slate-500 xl:inline">/</kbd>
            </label>
          </form>
          <Link href="/search" className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Search">
            <Search size={20} />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap text-brand-700 ring-1 ring-brand-100 xl:inline">{user.teamPill}</span>
            <NotificationBell unread={unread} items={notifications} />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
