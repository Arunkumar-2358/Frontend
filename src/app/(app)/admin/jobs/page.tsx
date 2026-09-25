import type { JobStatus, Prisma } from "@contracts";
import { prisma } from "@/lib/db";
import { now } from "@/lib/clock";
import { formatDateTime } from "@contracts/shared/dates";
import { PageHeader, Card, Table, Td, Badge, Stat, Select, Button, Pagination } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { freezeKpisAction, runDueJobsAction } from "./actions";

export const metadata = { title: "Scheduled jobs" };

const PAGE_SIZE = 50;
const STATUSES: JobStatus[] = ["PENDING", "FAILED", "DONE", "CANCELLED"];
const TONE = { PENDING: "blue", FAILED: "red", DONE: "green", CANCELLED: "slate" } as const;

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const page = Math.max(1, Number(sp.page) || 1);
  const t = now();
  const where: Prisma.ScheduledJobWhereInput = { ...(status ? { status } : {}), ...(sp.type ? { type: sp.type } : {}) };
  const [counts, due, total, jobs, types, lastFreeze] = await Promise.all([
    prisma.scheduledJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.scheduledJob.count({ where: { status: "PENDING", runAt: { lte: t } } }),
    prisma.scheduledJob.count({ where }),
    prisma.scheduledJob.findMany({ where, orderBy: status === "DONE" ? { doneAt: "desc" } : { runAt: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.scheduledJob.findMany({ distinct: ["type"], select: { type: true }, orderBy: { type: "asc" } }),
    prisma.kpiSnapshot.findFirst({ orderBy: { frozenAt: "desc" } }),
  ]);
  const count = (s: JobStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const qs = (p: number) => `/admin/jobs?${new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter((e): e is [string, string] => !!e[1])).toString()}`;

  return (
    <>
      <PageHeader title="Scheduled jobs" subtitle="Reminders, check-ins, retention checks and recurring system jobs. Normally run by the worker (npm run worker)." />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Pending" value={count("PENDING")} hint={`${due} due now`} tone={due ? "amber" : undefined} />
        <Stat label="Failed" value={count("FAILED")} tone={count("FAILED") ? "red" : "green"} />
        <Stat label="Done" value={count("DONE")} />
        <Stat label="Last KPI freeze" value={<span className="text-base">{lastFreeze ? formatDateTime(lastFreeze.frozenAt) : "Never"}</span>} />
      </div>
      <Card className="mb-4">
        <div className="flex flex-wrap items-start gap-6">
          <ActionForm action={runDueJobsAction}>
            <Submit>Run due jobs now</Submit>
            <p className="mt-1 text-xs text-slate-400">Ensures the recurring jobs exist, then runs every job due by now.</p>
          </ActionForm>
          <ActionForm action={freezeKpisAction} confirm="Freeze the last completed week and month (if not already frozen) and raise auto red flags for missed targets?">
            <Submit variant="secondary">Freeze last completed period KPIs</Submit>
            <p className="mt-1 text-xs text-slate-400">Writes KPI snapshots and evaluates targets for the previous week and month.</p>
          </ActionForm>
        </div>
      </Card>
      <Card className="mb-4">
        <form action="/admin/jobs" className="flex flex-wrap items-end gap-2">
          <Select name="status" defaultValue={status ?? ""} placeholder="Any status" options={STATUSES} className="w-auto" />
          <Select name="type" defaultValue={sp.type ?? ""} placeholder="Any type" options={types.map((x) => ({ value: x.type, label: x.type }))} className="w-auto" />
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </Card>
      <Card pad={false}>
        <Table head={["Type", "Run at", "Status", "Attempts", "Done at", "Payload", "Last error"]} empty="No jobs.">
          {jobs.map((j) => (
            <tr key={j.id}>
              <Td className="font-mono text-xs whitespace-nowrap">{j.type}</Td>
              <Td className={j.status === "PENDING" && j.runAt <= t ? "whitespace-nowrap font-medium text-amber-700" : "whitespace-nowrap"}>{formatDateTime(j.runAt)}</Td>
              <Td><Badge tone={TONE[j.status]}>{j.status.charAt(0) + j.status.slice(1).toLowerCase()}</Badge></Td>
              <Td className="tabular-nums">{j.attempts}</Td>
              <Td className="whitespace-nowrap">{formatDateTime(j.doneAt) || "—"}</Td>
              <Td className="max-w-xs font-mono text-xs break-all text-slate-500">{JSON.stringify(j.payload).slice(0, 120)}</Td>
              <Td className="max-w-sm text-xs break-words text-red-600">{j.lastError ?? ""}</Td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={qs} />
      </Card>
    </>
  );
}
