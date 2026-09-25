import Link from "next/link";
import type { Prisma } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { now } from "@/lib/clock";
import { formatDate, formatDateTime, startOfIstMonth, startOfIstWeek } from "@contracts/shared/dates";
import { isStageLeader } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import { PageHeader, Card, Table, Td, Badge, Input, Stat, Pagination, StageBadge, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { availabilityCheckAction, setColdAction } from "./actions";

export const metadata = { title: "Availability check-ins" };

const PAGE_SIZE = 25;

function CheckForms({ id, isCold, stage }: { id: string; isCold: boolean; stage: string }) {
  return (
    <div className="min-w-72 space-y-2">
      <ActionForm action={availabilityCheckAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="candidateId" value={id} />
        <Input name="notes" placeholder="Check-in notes" className="min-w-40 flex-1 py-1 text-xs" />
        {stage === "QUALIFIED" && <Submit size="sm" variant="success" name="available" value="yes">Available → Active</Submit>}
        <Submit size="sm" variant="secondary" name="available" value="no">Not available (cold)</Submit>
      </ActionForm>
      <ActionForm action={setColdAction}>
        <input type="hidden" name="candidateId" value={id} />
        <input type="hidden" name="cold" value={isCold ? "false" : "true"} />
        <Submit size="sm" variant="ghost">{isCold ? "Mark warm" : "Mark cold ❄"}</Submit>
      </ActionForm>
    </div>
  );
}

function LeadCell({ c }: { c: { id: string; name: string; candidateCode: string; mainCategory: string | null; owner: { name: string } | null } }) {
  return (
    <>
      <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${c.id}`}>{c.name}</Link>
      <div className="text-xs text-slate-400">
        {c.candidateCode}
        {c.mainCategory ? ` · ${humanize(c.mainCategory)}` : ""}
        {c.owner ? ` · ${c.owner.name}` : ""}
      </div>
    </>
  );
}

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ page?: string; cold?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const coldOnly = sp.cold === "1";
  const isLeader = isStageLeader(actor, "QUALIFIED");
  const scope: Prisma.CandidateWhereInput = { anonymizedAt: null, ...(isLeader ? {} : { ownerUserId: actor.id }) };
  const t = now();
  const weekStart = startOfIstWeek(t);
  const monthStart = startOfIstMonth(t);
  const convWhere = (from: Date): Prisma.AvailabilityCheckWhereInput => ({ available: true, wasCold: true, checkedAt: { gte: from }, candidate: scope });
  const qualifiedWhere: Prisma.CandidateWhereInput = { ...scope, stage: "QUALIFIED", ...(coldOnly ? { isCold: true } : {}) };

  const [dueTasks, qualified, qualifiedTotal, coldCount, convWeek, convMonth, recent, interval] = await Promise.all([
    prisma.task.findMany({
      where: { type: "AVAILABILITY_CHECK", status: "OPEN", candidate: scope },
      include: { candidate: { include: { owner: { select: { name: true } }, availabilityChecks: { orderBy: { checkedAt: "desc" }, take: 1 } } } },
      orderBy: { dueAt: "asc" },
      take: 200,
    }),
    prisma.candidate.findMany({
      where: qualifiedWhere,
      include: { owner: { select: { name: true } }, availabilityChecks: { orderBy: { checkedAt: "desc" }, take: 1 } },
      orderBy: [{ isCold: "desc" }, { stageChangedAt: "asc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.candidate.count({ where: qualifiedWhere }),
    prisma.candidate.count({ where: { ...scope, stage: "QUALIFIED", isCold: true } }),
    prisma.availabilityCheck.count({ where: convWhere(weekStart) }),
    prisma.availabilityCheck.count({ where: convWhere(monthStart) }),
    prisma.availabilityCheck.findMany({
      where: { available: true, wasCold: true, candidate: scope },
      include: { candidate: { select: { id: true, name: true, candidateCode: true, stage: true, isCold: true } } },
      orderBy: { checkedAt: "desc" },
      take: 10,
    }),
    getSetting("availabilityCheckIntervalDays"),
  ]);

  const ids = [...new Set([...qualified.map((c) => c.id), ...dueTasks.map((d) => d.candidateId).filter((x): x is string => !!x)])];
  const jobs = await prisma.scheduledJob.findMany({ where: { status: "PENDING", dedupeKey: { in: ids.map((id) => `avail:${id}`) } }, select: { dedupeKey: true, runAt: true } });
  const nextRun = new Map(jobs.map((j) => [j.dedupeKey!.slice("avail:".length), j.runAt]));
  const checkers = await prisma.user.findMany({ where: { id: { in: recent.map((r) => r.byUserId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const checkerName = new Map(checkers.map((u) => [u.id, u.name]));

  return (
    <>
      <PageHeader
        title="Availability check-ins"
        subtitle={`${isLeader ? "All qualified leads" : "Qualified leads you own"} · the system schedules a check-in every ${interval} days while a lead is Qualified`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Due check-ins" value={dueTasks.length} tone={dueTasks.length ? "amber" : undefined} />
        <Stat label="Cold leads" value={coldCount} hint="Qualified, not available" />
        <Stat label="Cold → warm this week" value={convWeek} tone={convWeek ? "green" : undefined} hint={`since ${formatDate(weekStart)}`} />
        <Stat label="Cold → warm this month" value={convMonth} tone={convMonth ? "green" : undefined} hint={`since ${formatDate(monthStart)}`} />
      </div>

      <div className="grid gap-6">
        <Card title="Due now" pad={false}>
          <Table head={["Due", "Lead", "Status", "Last check", "Next scheduled", "Check-in"]} empty="No availability check-ins are due.">
            {dueTasks.map((task) => {
              const c = task.candidate!;
              const last = c.availabilityChecks[0];
              const overdue = task.dueAt.getTime() <= t.getTime();
              return (
                <tr key={task.id}>
                  <Td className={overdue ? "whitespace-nowrap font-medium text-red-600" : "whitespace-nowrap"}>{formatDateTime(task.dueAt)}</Td>
                  <Td><LeadCell c={c} /></Td>
                  <Td><StageBadge stage={c.stage} cold={c.isCold} />{!c.isCold && <Badge tone="amber" className="ml-1">warm</Badge>}</Td>
                  <Td className="whitespace-nowrap">{last ? <>{formatDate(last.checkedAt)} <Badge tone={last.available ? "green" : "blue"}>{last.available ? "available" : "not available"}</Badge></> : <span className="text-slate-300">never</span>}</Td>
                  <Td className="whitespace-nowrap">{formatDate(nextRun.get(c.id)) || <span className="text-slate-300">—</span>}</Td>
                  <Td><CheckForms id={c.id} isCold={c.isCold} stage={c.stage} /></Td>
                </tr>
              );
            })}
          </Table>
        </Card>

        <Card
          title={`Qualified leads (${qualifiedTotal})`}
          actions={<Link className="text-sm text-brand-600 hover:underline" href={coldOnly ? "/availability" : "/availability?cold=1"}>{coldOnly ? "Show all" : "Cold only"}</Link>}
          pad={false}
        >
          <Table head={["Lead", "Cold / warm", "Qualified since", "Last check", "Next scheduled check", "Check-in"]} empty="No qualified leads.">
            {qualified.map((c) => {
              const last = c.availabilityChecks[0];
              return (
                <tr key={c.id}>
                  <Td><LeadCell c={c} /></Td>
                  <Td className="whitespace-nowrap">
                    {c.isCold ? <Badge tone="blue">❄ cold</Badge> : <Badge tone="amber">warm</Badge>}
                    {c.coldSince && <div className="text-xs text-slate-400">since {formatDate(c.coldSince)}</div>}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(c.stageChangedAt)}</Td>
                  <Td className="whitespace-nowrap">
                    {last ? (
                      <>
                        {formatDate(last.checkedAt)} <Badge tone={last.available ? "green" : "blue"}>{last.available ? "available" : "not available"}</Badge>
                        {last.notes && <div className="max-w-48 truncate text-xs text-slate-400" title={last.notes}>{last.notes}</div>}
                      </>
                    ) : (
                      <span className="text-slate-300">never</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(nextRun.get(c.id)) || <span className="text-slate-300">not scheduled</span>}</Td>
                  <Td><CheckForms id={c.id} isCold={c.isCold} stage={c.stage} /></Td>
                </tr>
              );
            })}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={qualifiedTotal} hrefFor={(p) => `/availability?page=${p}${coldOnly ? "&cold=1" : ""}`} />
        </Card>

        <Card title="Recent cold → warm conversions" pad={false}>
          <Table head={["Converted", "Lead", "Current stage", "By", "Notes"]} empty="No cold → warm conversions yet.">
            {recent.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap">{formatDateTime(r.checkedAt)}</Td>
                <Td>
                  <Link className="text-brand-600 hover:underline" href={`/leads/${r.candidate.id}`}>{r.candidate.name}</Link>
                  <span className="ml-1 text-xs text-slate-400">{r.candidate.candidateCode}</span>
                </Td>
                <Td><StageBadge stage={r.candidate.stage} cold={r.candidate.isCold} /></Td>
                <Td>{r.byUserId ? checkerName.get(r.byUserId) ?? "—" : "System"}</Td>
                <Td>{r.notes ?? ""}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
