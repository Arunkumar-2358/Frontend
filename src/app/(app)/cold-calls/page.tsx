import Link from "next/link";
import clsx from "clsx";
import type { MainCategory } from "@contracts";
import { MAIN_CATEGORIES } from "@contracts/shared/fields";
import { OUTCOME_LABEL } from "@contracts/shared/labels";
import { formatDate, formatDateTime } from "@contracts/shared/dates";
import { api } from "@/lib/api/client";
import { PageHeader, Card, Table, Td, Input, Select, Stat, Pagination, StageBadge, LinkButton, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { TierBadge } from "@/components/engagement";
import { BulkAllocateForm } from "../allocation/bulk-allocate";
import { OutcomeForm } from "./outcome-form";
import { allocateColdCallsAction } from "./actions";

export const metadata = { title: "Cold-lead calls" };

const POOL_FORM_ID = "cold-allocate-ticked";
const catLabel = (c: MainCategory | null) => (c ? humanize(c) : "No category");

export default async function ColdCallsPage({ searchParams }: { searchParams: Promise<{ scope?: string; page?: string; category?: string }> }) {
  const sp = await searchParams;
  const category = sp.category === "NONE" || (MAIN_CATEGORIES as readonly string[]).includes(sp.category ?? "") ? (sp.category as MainCategory | "NONE") : undefined;
  const { isLeader, scope, page, pageSize, total, maxAttempts, today, rows, pool } = await api("GET /v1/cold-calls", {
    query: { scope: sp.scope === "team" ? "team" : undefined, page: Math.max(1, Number(sp.page) || 1), category },
  });
  const t = new Date();
  const href = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ scope: scope === "team" ? "team" : undefined, category, ...over }).filter((e): e is [string, string] => !!e[1]));
    return `/cold-calls${q.size ? `?${q}` : ""}`;
  };
  const callerOptions = (pool?.callers ?? []).map((c) => ({
    value: c.id,
    label: `${c.name}${c.isLeader ? " (TL)" : ""} · ${c.category ? humanize(c.category) : "all categories"} · ${c.openCalls} open call${c.openCalls === 1 ? "" : "s"}`,
  }));

  return (
    <>
      <PageHeader
        title="Cold-lead calls"
        subtitle={`Qualified leads with no platform visit for more than the warm window. Call and ask if they need a job — “yes” makes them Super active. Unanswered calls come back as a recall, up to ${maxAttempts} attempts.`}
        actions={
          isLeader ? (
            <>
              <LinkButton href={href({ scope: undefined, page: undefined })} variant={scope === "mine" ? "primary" : "secondary"}>My calls</LinkButton>
              <LinkButton href={href({ scope: "team", page: undefined })} variant={scope === "team" ? "primary" : "secondary"}>Whole team</LinkButton>
            </>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Allocated today" value={today.allocated} />
        <Stat label="Calls made today" value={today.calls} />
        <Stat label="Answered today" value={today.answered} />
        <Stat label="Super active today" value={today.superActive} tone={today.superActive ? "green" : undefined} />
      </div>

      <div className="grid gap-6">
        <Card title={`${scope === "team" ? "Team's" : "Your"} calls to make (${total})`} pad={false}>
          <Table head={["Due", "Lead", "Engagement", "Call", ...(scope === "team" ? ["Caller"] : []), "Outcome"]} empty="No cold-lead calls to make. The Team 2 leader allocates them from the pool.">
            {rows.map((r) => {
              const overdue = r.dueAt.getTime() <= t.getTime();
              return (
                <tr key={r.id}>
                  <Td className={clsx("whitespace-nowrap", overdue && "font-medium text-red-600")}>{formatDateTime(r.dueAt)}</Td>
                  <Td>
                    <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${r.candidate.id}`}>{r.candidate.name}</Link>
                    <div className="text-xs text-slate-400">
                      {r.candidate.candidateCode}
                      {r.candidate.mainCategory ? ` · ${humanize(r.candidate.mainCategory)}` : ""}
                      {r.candidate.owner ? ` · owner ${r.candidate.owner.name}` : ""}
                    </div>
                    <div className="mt-1"><StageBadge stage={r.candidate.stage} /></div>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <TierBadge tier={r.candidate.tier} />
                    <div className="mt-1 text-xs text-slate-500">Last active: {formatDate(r.candidate.lastEngagedAt) || "never"}</div>
                    <div className="text-xs text-slate-400">WhatsApp: {r.candidate.reengageSentAt ? `sent ${formatDate(r.candidate.reengageSentAt)}` : "not sent"}</div>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <div className="text-sm font-medium">{r.attempt === 1 ? "First call" : `Recall · attempt ${r.attempt} of ${maxAttempts}`}</div>
                    {r.lastCall && <div className="text-xs text-slate-400">Last: {OUTCOME_LABEL[r.lastCall.outcome]} · {formatDateTime(r.lastCall.at)}</div>}
                    <Link className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline" href={`/cold-calls/call/${r.candidate.id}`}>📞 Show number</Link>
                  </Td>
                  {scope === "team" && <Td>{r.assignee?.name ?? "—"}</Td>}
                  <Td className="min-w-64"><OutcomeForm candidateId={r.candidate.id} /></Td>
                </tr>
              );
            })}
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => href({ page: String(p) })} />
        </Card>

        {pool && (
          <Card title={`Cold leads waiting to be allocated (${pool.categories.reduce((n, c) => n + c.waiting, 0)})`} pad={false}>
            <Table head={["Category", "Waiting", "Allocate to"]} empty="No cold leads are waiting — every cold lead has been allocated for a call.">
              {pool.categories.map((c) => {
                const key = c.category ?? "NONE";
                return (
                  <tr key={key}>
                    <Td className="font-medium"><Link className="text-brand-600 hover:underline" href={href({ category: key, page: undefined })}>{catLabel(c.category)}</Link></Td>
                    <Td className="tabular-nums">{c.waiting}</Td>
                    <Td>
                      <ActionForm action={allocateColdCallsAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="category" value={key} />
                        <Select name="callerId" options={callerOptions} defaultValue={c.suggestedCallerId ?? ""} placeholder="Choose who calls…" className="min-w-64 py-1 text-sm" required />
                        <label className="flex items-center gap-1 text-xs text-slate-500">
                          How many
                          <Input name="count" type="number" min={1} max={c.waiting} defaultValue={c.waiting} className="w-20 py-1 text-sm" />
                        </label>
                        <Submit size="sm">Allocate</Submit>
                      </ActionForm>
                    </Td>
                  </tr>
                );
              })}
            </Table>

            {pool.leads.length > 0 && (
              <div className="border-t border-slate-100 px-5 pt-4 pb-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-ink">{category ? `${catLabel(category === "NONE" ? null : category)} — waiting leads` : "Waiting leads"} ({pool.total})</h3>
                  {category && <Link className="text-sm text-brand-600 hover:underline" href={href({ category: undefined })}>All categories</Link>}
                </div>
                <BulkAllocateForm action={allocateColdCallsAction} sourcers={callerOptions} formId={POOL_FORM_ID} field="callerId" label="Allocate ticked cold leads to" placeholder="Choose who calls…" />
              </div>
            )}
            {pool.leads.length > 0 && (
              <Table head={["", "Lead", "Last active", "WhatsApp", "Owner"]}>
                {pool.leads.map((l) => (
                  <tr key={l.id}>
                    <Td><input type="checkbox" name="ids" value={l.id} form={POOL_FORM_ID} aria-label={`Select ${l.name}`} className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" /></Td>
                    <Td>
                      <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${l.id}`}>{l.name}</Link>
                      <div className="text-xs text-slate-400">{l.candidateCode} · {catLabel(l.mainCategory)}</div>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(l.lastEngagedAt) || "never"}</Td>
                    <Td className="whitespace-nowrap text-xs">{l.reengageSentAt ? `sent ${formatDate(l.reengageSentAt)}` : <span className="text-slate-300">not sent</span>}</Td>
                    <Td>{l.owner?.name ?? "—"}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
