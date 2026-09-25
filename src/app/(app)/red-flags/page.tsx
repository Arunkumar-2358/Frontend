import Link from "next/link";
import type { Prisma, RedFlagStatus, TeamCode } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { now } from "@/lib/clock";
import { formatDate, periodRange } from "@contracts/shared/dates";
import { canManageRedFlags } from "@/lib/rbac";
import { SHEETS, formatKpi, metricsFor } from "@/kpi/definitions";
import { PageHeader, Card, Table, Td, Badge, Select, Button, Pagination, LinkButton } from "@/components/ui";
import { RaiseRedFlagForm } from "./raise-form";
import { redFlagScope, STATUS_LABEL, STATUS_TONE } from "./scope";

export const metadata = { title: "Red flags & CAPA" };

const PAGE_SIZE = 25;
const TEAM_CODES: TeamCode[] = ["T1A", "T1B", "T2", "T3A", "T3B", "T3C", "T4"];
const STATUSES: RedFlagStatus[] = ["OPEN", "CAPA_SUGGESTED", "IMPLEMENTED", "CLOSED"];
const PERIODS = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

type SP = { team?: string; status?: string; source?: string; period?: string; page?: string };

function periodFilter(p: string | undefined): { gte: Date; lt: Date } | undefined {
  if (!p) return undefined;
  const kind = p.endsWith("month") ? "MONTH" : "WEEK";
  const cur = periodRange(kind, now());
  const r = p.startsWith("last") ? periodRange(kind, new Date(cur.start.getTime() - 60_000)) : cur;
  return { gte: r.start, lt: r.end };
}

export default async function RedFlagsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const manage = canManageRedFlags(actor);
  const page = Math.max(1, Number(sp.page) || 1);
  const range = periodFilter(sp.period);
  const where: Prisma.RedFlagWhereInput = {
    AND: [
      redFlagScope(actor),
      {
        ...(sp.team && TEAM_CODES.includes(sp.team as TeamCode) ? { teamCode: sp.team as TeamCode } : {}),
        ...(sp.status === "NOT_CLOSED" ? { status: { not: "CLOSED" } } : sp.status && STATUSES.includes(sp.status as RedFlagStatus) ? { status: sp.status as RedFlagStatus } : {}),
        ...(sp.source === "auto" ? { autoRaised: true } : sp.source === "manual" ? { autoRaised: false } : {}),
        ...(range ? { raisedOn: range } : {}),
      },
    ],
  };
  const [total, flags, teams] = await Promise.all([
    prisma.redFlag.count({ where }),
    prisma.redFlag.findMany({
      where,
      orderBy: [{ raisedOn: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { agent: { select: { name: true } }, actionOwner: { select: { name: true } } },
    }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
  ]);

  let raiseProps: Parameters<typeof RaiseRedFlagForm>[0] | null = null;
  if (manage) {
    const [users, targets] = await Promise.all([
      prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, roles: { select: { team: { select: { code: true } } } } } }),
      prisma.kpiTarget.findMany({ where: { periodType: "WEEK" } }),
    ]);
    raiseProps = {
      teams: teams.map((t) => ({ code: t.code, name: t.name })),
      members: users.map((u) => ({ id: u.id, name: u.name, teams: [...new Set(u.roles.map((r) => r.team.code))] })),
      kpis: SHEETS.flatMap((s) =>
        metricsFor(s.sheet).map((d) => {
          const t = targets.find((x) => x.metricKey === d.key && x.teamCode === s.team);
          return { key: d.key, label: d.label, team: s.team, sheetTitle: s.title, target: t ? `${t.comparator === "lte" ? "≤" : "≥"} ${formatKpi(t.target, d.unit)}` : undefined };
        }),
      ),
    };
  }

  const t = now();
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter((e): e is [string, string] => !!e[1]));
    return `/red-flags?${u.toString()}`;
  };

  return (
    <>
      <PageHeader title="Red flags & CAPA" subtitle={manage ? "Raise deviations, suggest CAPA and verify closure within 1 working day." : "Red flags for your teams and flags where you are the action owner (read-only unless you own the action)."} />

      {raiseProps && (
        <details className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Raise red flag</summary>
          <div className="border-t border-slate-100 p-4">
            <RaiseRedFlagForm {...raiseProps} />
          </div>
        </details>
      )}

      <Card className="mb-4">
        <form action="/red-flags" className="flex flex-wrap items-end gap-3">
          <Select name="team" defaultValue={sp.team ?? ""} placeholder="All teams" options={teams.map((x) => ({ value: x.code, label: x.name }))} className="w-auto" />
          <Select name="status" defaultValue={sp.status ?? ""} placeholder="Any status" options={[{ value: "NOT_CLOSED", label: "Not closed" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} className="w-auto" />
          <Select name="source" defaultValue={sp.source ?? ""} placeholder="Auto + manual" options={[{ value: "auto", label: "Auto-raised (KPI target)" }, { value: "manual", label: "Manual" }]} className="w-auto" />
          <Select name="period" defaultValue={sp.period ?? ""} placeholder="Any period" options={PERIODS} className="w-auto" />
          <Button type="submit" variant="secondary">Filter</Button>
          <LinkButton href="/red-flags" variant="ghost">Reset</LinkButton>
        </form>
      </Card>

      <Card pad={false}>
        <Table
          head={["Date", "Team", "Description", "Agent", "KPI deviated", "Target / standard", "Actual", "Raised on", "CAPA suggested", "Expected outcome", "Due date", "Completion date", "Action owner", "Corrective action implemented", "Achieved outcome", "Status", "Closed ≤ 1 WD"]}
          empty="No red flags match."
        >
          {flags.map((f) => {
            const overdue = !!f.dueDate && f.status !== "CLOSED" && f.dueDate < t;
            return (
              <tr key={f.id} className={overdue ? "bg-red-50/40" : undefined}>
                <Td className="whitespace-nowrap">{formatDate(f.date)}</Td>
                <Td>{f.teamCode}</Td>
                <Td className="min-w-64">
                  <Link href={`/red-flags/${f.id}`} className="text-brand-600 hover:underline">{f.description}</Link>
                  {f.autoRaised && <Badge tone="violet" className="ml-1">auto</Badge>}
                </Td>
                <Td>{f.agent?.name ?? "—"}</Td>
                <Td>{f.kpiDeviated ?? "—"}</Td>
                <Td className="whitespace-nowrap">{f.targetStandard ?? "—"}</Td>
                <Td className="whitespace-nowrap">{f.actual ?? "—"}</Td>
                <Td className="whitespace-nowrap">{formatDate(f.raisedOn)}</Td>
                <Td className="min-w-48">{f.capaSuggested ?? "—"}</Td>
                <Td className="min-w-40">{f.expectedOutcome ?? "—"}</Td>
                <Td className={overdue ? "whitespace-nowrap font-medium text-red-600" : "whitespace-nowrap"}>{formatDate(f.dueDate) || "—"}{overdue && " · overdue"}</Td>
                <Td className="whitespace-nowrap">{formatDate(f.completionDate) || "—"}</Td>
                <Td>{f.actionOwner?.name ?? "—"}</Td>
                <Td className="min-w-48">{f.correctiveActionImplemented ?? "—"}</Td>
                <Td className="min-w-40">{f.achievedOutcome ?? "—"}</Td>
                <Td><Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge></Td>
                <Td>{f.closedWithin1WorkingDay === null ? <span className="text-slate-300">—</span> : f.closedWithin1WorkingDay ? <Badge tone="green">Yes</Badge> : <Badge tone="red">No</Badge>}</Td>
              </tr>
            );
          })}
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={qs} />
      </Card>
    </>
  );
}
