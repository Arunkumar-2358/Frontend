import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@contracts/shared/dates";
import { timeAgo } from "@contracts/shared/ago";
import { PageHeader, Card, Pagination, LinkButton, Badge, humanize } from "@/components/ui";
import { MarkAllButton, OpenNotification } from "./client";

export const metadata = { title: "Notifications" };
const KINDS = ["TASK", "LEAD_ASSIGNED", "RED_FLAG", "CAPA", "IMPORT", "INTERVIEW", "SYSTEM"];

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string; kind?: string }> }) {
  const sp = await searchParams;
  const { rows, total, unread, page, pageSize } = await api("GET /v1/notifications", {
    query: { page: Math.max(1, Number(sp.page) || 1), unread: sp.filter === "unread" || undefined, kind: sp.kind && KINDS.includes(sp.kind) ? sp.kind : undefined },
  });
  const href = (p: Record<string, string | undefined>) => "/notifications?" + new URLSearchParams(Object.entries({ filter: sp.filter, kind: sp.kind, ...p }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Notifications" subtitle={`${unread} unread · assignments, tasks, red flags, CAPA, imports and interview alerts`} actions={unread > 0 ? <MarkAllButton /> : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton size="sm" variant={!sp.filter && !sp.kind ? "primary" : "secondary"} href="/notifications">All</LinkButton>
        <LinkButton size="sm" variant={sp.filter === "unread" ? "primary" : "secondary"} href={href({ filter: "unread", page: undefined })}>Unread</LinkButton>
        {KINDS.map((k) => (
          <LinkButton key={k} size="sm" variant={sp.kind === k ? "primary" : "secondary"} href={href({ kind: sp.kind === k ? undefined : k, page: undefined })}>{humanize(k)}</LinkButton>
        ))}
      </div>
      <Card pad={false}>
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">No notifications here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((n) => (
              <li key={n.id} className={clsx("flex items-start gap-3 px-4 py-3", !n.readAt && "bg-brand-50/50")}>
                <Badge tone={n.kind === "RED_FLAG" || n.kind === "CAPA" ? "red" : "blue"} className="mt-0.5">{humanize(n.kind)}</Badge>
                <div className="min-w-0 flex-1">
                  <div className={clsx("text-sm", n.readAt ? "text-slate-700" : "font-semibold text-ink")}>{n.title}</div>
                  {n.body && <div className="text-sm text-slate-500">{n.body}</div>}
                  <div className="text-xs text-slate-400" title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</div>
                </div>
                {n.link ? <OpenNotification id={n.id} link={n.link} read={!!n.readAt} /> : !n.readAt ? <OpenNotification id={n.id} read={false} /> : null}
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => href({ page: String(p) })} />
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        Tip: overdue work is in <Link href="/tasks" className="text-brand-600 hover:underline">My tasks</Link>.
      </p>
    </>
  );
}
