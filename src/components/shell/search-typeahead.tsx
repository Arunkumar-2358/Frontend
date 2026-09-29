"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import clsx from "clsx";
import { Search, Loader2 } from "lucide-react";
import type { SearchResults } from "@contracts";
import { StageBadge, Badge, humanize } from "@/components/ui";

/**
 * Header search box with a live suggestions dropdown, so picking a lead/vacancy/client
 * doesn't need a full round trip to the /search results page. Falls back to that page
 * (form submit, or "See all results") for anything beyond the top few matches per group.
 */
export function SearchTypeahead() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // "/" jumps to the search box from anywhere, unless the user is already typing somewhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced fetch through the same-origin /api/v1 proxy (cookie auth, no CORS).
  useEffect(() => {
    const query = q.trim();
    abortRef.current?.abort();
    if (query.length < 2) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { result: SearchResults | null } | null) => setResult(body?.result ?? null))
        .catch((e: unknown) => {
          if (!(e instanceof DOMException && e.name === "AbortError")) setResult(null);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const items = result
    ? [
        ...result.leads.map((c) => ({ key: `lead-${c.id}`, href: `/leads/${c.id}` })),
        ...result.vacancies.map((v) => ({ key: `vac-${v.id}`, href: `/vacancies/${v.id}` })),
        ...result.clients.map((o) => ({ key: `org-${o.id}`, href: `/vacancies?org=${o.id}` })),
      ]
    : [];

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      go(items[active].href);
    }
  };

  const trimmed = q.trim();
  const total = result ? result.leadCount + result.vacancyCount + result.clients.length + result.people.length : 0;
  const showPanel = open && trimmed.length >= 2;

  return (
    <div ref={boxRef} className="relative mx-auto hidden w-full max-w-md min-w-40 lg:block">
      <form action="/search" role="search">
        <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-500 focus-within:ring-2 focus-within:ring-brand-200">
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
          <input
            ref={inputRef}
            name="q"
            required
            autoComplete="off"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search leads, vacancies, clients…"
            aria-label="Search"
            className="w-full bg-transparent text-sm text-ink placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden rounded border border-slate-300 px-1.5 text-[11px] text-slate-500 xl:inline">/</kbd>
        </label>
      </form>

      {showPanel && (
        <div className="absolute top-full left-0 z-40 mt-2 max-h-[70vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
          {!result ? (
            <p className="px-4 py-3 text-sm text-slate-500">{loading ? "Searching…" : "Keep typing…"}</p>
          ) : total === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Nothing found for “{trimmed}”.</p>
          ) : (
            <>
              {result.leads.length > 0 && (
                <Section title={`Leads · ${result.leadCount}`}>
                  {result.leads.map((c) => (
                    <Row key={c.id} active={items[active]?.key === `lead-${c.id}`} onClick={() => go(`/leads/${c.id}`)}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink">{c.name}</div>
                        <div className="truncate text-xs text-slate-500">
                          {c.candidateCode}
                          {c.currentLocation ? ` · ${c.currentLocation}` : ""}
                        </div>
                      </div>
                      <StageBadge stage={c.stage} cold={c.isCold} />
                    </Row>
                  ))}
                </Section>
              )}
              {result.vacancies.length > 0 && (
                <Section title={`Vacancies · ${result.vacancyCount}`}>
                  {result.vacancies.map((v) => (
                    <Row key={v.id} active={items[active]?.key === `vac-${v.id}`} onClick={() => go(`/vacancies/${v.id}`)}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink">{v.title}</div>
                        <div className="truncate text-xs text-slate-500">
                          {v.clientOrg.name} · {v.location}
                        </div>
                      </div>
                      <Badge tone={v.status === "OPEN" ? "green" : v.status === "PENDING" ? "amber" : "slate"}>{humanize(v.status)}</Badge>
                    </Row>
                  ))}
                </Section>
              )}
              {result.clients.length > 0 && (
                <Section title={`Clients · ${result.clients.length}`}>
                  {result.clients.map((o) => (
                    <Row key={o.id} active={items[active]?.key === `org-${o.id}`} onClick={() => go(`/vacancies?org=${o.id}`)}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink">{o.name}</div>
                        <div className="truncate text-xs text-slate-500">{o.city ?? "—"}</div>
                      </div>
                    </Row>
                  ))}
                </Section>
              )}
              {result.people.length > 0 && (
                <Section title={`People · ${result.people.length}`}>
                  {result.people.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink">{u.name}</div>
                        <div className="truncate text-xs text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  ))}
                </Section>
              )}
              <Link
                href={`/search?q=${encodeURIComponent(trimmed)}`}
                onClick={() => setOpen(false)}
                className="block border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-slate-50"
              >
                See all {total} result{total === 1 ? "" : "s"} for “{trimmed}” →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-1 last:border-0">
      <div className="px-4 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{title}</div>
      {children}
    </div>
  );
}

function Row({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      // Prevent the input from losing focus (and the panel closing) before the click registers.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx("flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50", active && "bg-slate-50")}
    >
      {children}
    </button>
  );
}
