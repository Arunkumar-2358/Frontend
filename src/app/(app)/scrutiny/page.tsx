import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@contracts/shared/dates";
import { fieldLabel } from "@contracts/shared/fields";
import { PageHeader, Card, Table, Td, Badge, Input, Progress, Pagination, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { scrutinizeAction, verifyAndQualifyAction } from "./actions";

export const metadata = { title: "Enrolment scrutiny" };

const TABS = [
  { key: "incomplete", label: "Incomplete" },
  { key: "complete", label: "Complete · awaiting verification" },
  { key: "all", label: "All enrolled" },
] as const;

export default async function ScrutinyPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const sp = await searchParams;
  const requested = TABS.find((t) => t.key === sp.tab)?.key;
  const { isLeader, tab, page, pageSize, counts, total, mandatory, leads } = await api("GET /v1/scrutiny", { query: { tab: requested, page: Math.max(1, Number(sp.page) || 1) } });

  return (
    <>
      <PageHeader
        title="Enrolment scrutiny"
        subtitle={
          <>
            {isLeader ? "All enrolled leads" : "Enrolled leads you own"} · mandatory SOP fields: {mandatory.map(fieldLabel).join(", ")}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/scrutiny?tab=${t.key}`}
            className={clsx("rounded-full border px-3 py-1 text-sm", t.key === tab ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")}
          >
            {t.label} <span className="ml-1 tabular-nums opacity-75">{counts[t.key]}</span>
          </Link>
        ))}
      </div>
      <Card pad={false}>
        <Table head={["Lead", "Category", "Enrolled", "Completeness", "Missing mandatory fields", "Scrutinised", "Collect-details task", "Actions"]} empty="No enrolled leads in this view.">
          {leads.map((lead) => {
            const { missing, pct, task } = lead;
            return (
              <tr key={lead.id}>
                <Td>
                  <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${lead.id}`}>{lead.name}</Link>
                  <div className="text-xs text-slate-400">{lead.candidateCode}{lead.owner ? ` · ${lead.owner.name}` : ""}</div>
                </Td>
                <Td>{lead.mainCategory ? humanize(lead.mainCategory) : "—"}</Td>
                <Td className="whitespace-nowrap">{formatDate(lead.enrolledAt ?? lead.stageChangedAt)}</Td>
                <Td><Progress value={pct} /></Td>
                <Td className="max-w-64">
                  {missing.length ? (
                    <div className="flex flex-wrap gap-1">
                      {missing.map((k) => <Badge key={k} tone="red">{fieldLabel(k)}</Badge>)}
                    </div>
                  ) : (
                    <Badge tone="green">None</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {lead.scrutinizedAt ? (
                    <>
                      <Badge tone="green">Yes</Badge>
                      <div className="text-xs text-slate-400">{formatDate(lead.scrutinizedAt)}{lead.scrutinizedById ? ` · ${lead.scrutinizerName ?? ""}` : ""}</div>
                    </>
                  ) : (
                    <Badge tone="amber">Not yet</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {task ? (
                    <>
                      <Badge tone="amber">Open</Badge>
                      <div className="text-xs text-slate-400">Due {formatDateTime(task.dueAt)}{task.assignee ? ` · ${task.assignee.name}` : ""}</div>
                    </>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </Td>
                <Td className="min-w-72 space-y-2">
                  <ActionForm action={scrutinizeAction} className="flex gap-2">
                    <input type="hidden" name="candidateId" value={lead.id} />
                    <Input name="remark" placeholder="Scrutiny remark (optional)" className="py-1 text-xs" />
                    <Submit size="sm" variant="secondary">Scrutinise</Submit>
                  </ActionForm>
                  {isLeader && (
                    <ActionForm action={verifyAndQualifyAction} className="flex gap-2">
                      <input type="hidden" name="candidateId" value={lead.id} />
                      <Input name="tlRemark" placeholder="TL remark" defaultValue={lead.tlRemarks ?? ""} className="py-1 text-xs" />
                      <Submit size="sm" variant="success">Verify &amp; qualify</Submit>
                    </ActionForm>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => `/scrutiny?tab=${tab}&page=${p}`} />
      </Card>
    </>
  );
}
