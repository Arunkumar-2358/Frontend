import Link from "next/link";
import type { Prisma, Stage } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { now } from "@/lib/clock";
import { addDays, formatDate, formatDateTime, periodRange, startOfIstDay } from "@contracts/shared/dates";
import { hasRole, leaderTeams, leadScope, stagesOwnedBy } from "@/lib/rbac";
import { EXIT_STAGES, PIPELINE, STAGE_LABEL } from "@/server/lifecycle/rules";
import { SHEETS, formatKpi } from "@/kpi/definitions";
import { computeSheet, sheetMembers } from "@/kpi/engine";
import { PageHeader, Card, Stat, Table, Td, Badge, StageBadge, LinkButton, humanize } from "@/components/ui";
import { headlineMetrics } from "../kpi/helpers";

export const metadata = { title: "Dashboard" };

function StageCounts({ stages, counts, hrefFor }: { stages: Stage[]; counts: Map<Stage, number>; hrefFor?: (s: Stage) => string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {stages.map((s) => {
        const inner = (
          <>
            <div className="text-xs text-slate-500">{STAGE_LABEL[s]}</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{(counts.get(s) ?? 0).toLocaleString("en-IN")}</div>
          </>
        );
        return hrefFor ? (
          <Link key={s} href={hrefFor(s)} className="rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">{inner}</Link>
        ) : (
          <div key={s} className="rounded-lg border border-slate-200 px-3 py-2">{inner}</div>
        );
      })}
    </div>
  );
}

async function stageCounts(where: Prisma.CandidateWhereInput) {
  const rows = await prisma.candidate.groupBy({ by: ["stage"], where, _count: { _all: true } });
  return new Map(rows.map((r) => [r.stage, r._count._all]));
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const t = now();
  const dayStart = startOfIstDay(t);
  const dayEnd = addDays(dayStart, 1);
  const lt = leaderTeams(actor);
  const isCoord = hasRole(actor, "admin", "ta_coordinator");
  const isDA = hasRole(actor, "data_analyst");

  const [openTasks, overdueTasks, topTasks, myStages, followupsToday] = await Promise.all([
    prisma.task.count({ where: { assigneeId: actor.id, status: "OPEN" } }),
    prisma.task.count({ where: { assigneeId: actor.id, status: "OPEN", dueAt: { lte: t } } }),
    prisma.task.findMany({ where: { assigneeId: actor.id, status: "OPEN" }, orderBy: { dueAt: "asc" }, take: 5, include: { candidate: { select: { id: true, name: true, candidateCode: true } } } }),
    stageCounts({ AND: [leadScope(actor), { ownerUserId: actor.id }] }),
    prisma.task.findMany({
      where: { assigneeId: actor.id, status: "OPEN", type: { in: ["FOLLOW_UP", "RECALL"] }, dueAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { dueAt: "asc" },
      take: 10,
      include: { candidate: { select: { id: true, name: true, candidateCode: true, stage: true } } },
    }),
  ]);
  const myTotal = [...myStages.values()].reduce((a, b) => a + b, 0);

  // Team leaders: pipeline for owned stages + weekly KPI summary
  const leaderStages = lt.length ? stagesOwnedBy(lt) : [];
  const teamPipeline = lt.length ? await stageCounts({ stage: { in: leaderStages } }) : null;
  const week = periodRange("WEEK", t);
  const leaderSheets = SHEETS.filter((s) => lt.includes(s.team));
  const kpiSummaries = await Promise.all(
    leaderSheets.map(async (s) => {
      const ids = (await sheetMembers(s.sheet)).map((m) => m.id);
      const values = await computeSheet(s.sheet, week.start, week.end, ids);
      return { s, values };
    }),
  );

  // Coordinator / admin
  const orgFunnel = isCoord ? await stageCounts({}) : null;
  const [openFlags, overdueCapas, recentFlags] = isCoord
    ? await Promise.all([
        prisma.redFlag.count({ where: { status: { not: "CLOSED" } } }),
        prisma.redFlag.count({ where: { status: { in: ["OPEN", "CAPA_SUGGESTED"] }, dueDate: { lt: t } } }),
        prisma.redFlag.findMany({ where: { status: { not: "CLOSED" } }, orderBy: [{ dueDate: "asc" }, { raisedOn: "desc" }], take: 5, include: { agent: { select: { name: true } } } }),
      ])
    : [0, 0, []];

  // Data analyst
  const [mappingCount, stuckMapping, batches] = isDA
    ? await Promise.all([
        prisma.candidate.count({ where: { stage: "MAPPING" } }),
        prisma.candidate.findMany({ where: { stage: "MAPPING" }, orderBy: { stageChangedAt: "asc" }, take: 5, select: { id: true, name: true, candidateCode: true, stageChangedAt: true, mainCategory: true } }),
        prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      ])
    : [0, [], []];

  return (
    <>
      <PageHeader title={`Hello, ${actor.name}`} subtitle={`${formatDate(t)} · IST`} />
      {sp.denied === "1" && <p role="alert" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">You don&apos;t have access to that page.</p>}

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Open tasks" value={openTasks} />
        <Stat label="Overdue" value={overdueTasks} tone={overdueTasks ? "red" : "green"} />
        <Stat label="Follow-ups today" value={followupsToday.length} tone={followupsToday.length ? "amber" : undefined} />
        <Stat label="My leads" value={myTotal.toLocaleString("en-IN")} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="My next tasks" actions={<LinkButton size="sm" href="/tasks">All tasks</LinkButton>} pad={false}>
          <Table head={["Due", "Task", "Lead"]} empty="No open tasks.">
            {topTasks.map((k) => (
              <tr key={k.id}>
                <Td className={k.dueAt <= t ? "whitespace-nowrap font-medium text-red-600" : "whitespace-nowrap"}>{formatDateTime(k.dueAt)}</Td>
                <Td>
                  {k.title} <Badge>{humanize(k.type)}</Badge>
                </Td>
                <Td>
                  {k.candidate ? <Link className="text-brand-600 hover:underline" href={`/leads/${k.candidate.id}`}>{k.candidate.name}</Link> : k.refType === "red_flag" ? <Link className="text-brand-600 hover:underline" href={`/red-flags/${k.refId}`}>Red flag</Link> : "—"}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Follow-ups due today" pad={false}>
          <Table head={["Time", "Lead", "Type"]} empty="No follow-ups due today.">
            {followupsToday.map((k) => (
              <tr key={k.id}>
                <Td className="whitespace-nowrap">{formatDateTime(k.dueAt).slice(11)}</Td>
                <Td>{k.candidate ? <Link className="text-brand-600 hover:underline" href={`/leads/${k.candidate.id}`}>{k.candidate.name} <span className="text-xs text-slate-400">{k.candidate.candidateCode}</span></Link> : k.title}</Td>
                <Td>{humanize(k.type)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      {myTotal > 0 && (
        <Card title="My leads by stage" className="mb-4">
          <StageCounts stages={[...PIPELINE, ...EXIT_STAGES].filter((s) => myStages.get(s))} counts={myStages} hrefFor={(s) => `/leads?stage=${s}&owner=me`} />
        </Card>
      )}

      {teamPipeline && (
        <Card title="Team pipeline (stages your team owns)" className="mb-4">
          <StageCounts stages={leaderStages} counts={teamPipeline} hrefFor={(s) => `/leads?stage=${s}`} />
        </Card>
      )}

      {kpiSummaries.length > 0 && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          {kpiSummaries.map(({ s, values }) => (
            <Card key={s.sheet} title={`${s.title} · this week`} actions={<LinkButton size="sm" href={`/kpi?sheet=${s.sheet}`}>Full sheet</LinkButton>}>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {headlineMetrics(s.sheet).map((d) => (
                  <div key={d.key} title={d.description || d.label}>
                    <dt className="text-xs text-slate-500">{d.label}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatKpi(values[d.key] ?? null, d.unit)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-slate-400">{formatDate(week.start)} – {formatDate(addDays(week.end, -1))}</p>
            </Card>
          ))}
        </div>
      )}

      {orgFunnel && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Open red flags" value={openFlags} tone={openFlags ? "amber" : "green"} />
            <Stat label="Overdue CAPAs" value={overdueCapas} tone={overdueCapas ? "red" : "green"} hint="Open / CAPA suggested past due date" />
            <Stat label="Successful placements" value={orgFunnel.get("SUCCESSFUL") ?? 0} />
            <Stat label="Leads in pipeline" value={PIPELINE.filter((s) => s !== "SUCCESSFUL").reduce((a, s) => a + (orgFunnel.get(s) ?? 0), 0).toLocaleString("en-IN")} />
          </div>
          <Card title="Organisation funnel" className="mb-4">
            <StageCounts stages={PIPELINE} counts={orgFunnel} hrefFor={(s) => `/leads?stage=${s}`} />
            <div className="mt-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Exits</div>
            <div className="mt-2">
              <StageCounts stages={EXIT_STAGES} counts={orgFunnel} hrefFor={(s) => `/leads?stage=${s}`} />
            </div>
          </Card>
          <Card title="Open red flags" actions={<LinkButton size="sm" href="/red-flags">All red flags</LinkButton>} pad={false} className="mb-4">
            <Table head={["Raised", "Team", "Description", "Agent", "Due", "Status"]} empty="No open red flags.">
              {recentFlags.map((f) => {
                const overdue = !!f.dueDate && f.dueDate < t;
                return (
                  <tr key={f.id}>
                    <Td className="whitespace-nowrap">{formatDate(f.raisedOn)}</Td>
                    <Td>{f.teamCode}</Td>
                    <Td><Link className="text-brand-600 hover:underline" href={`/red-flags/${f.id}`}>{f.description}</Link></Td>
                    <Td>{f.agent?.name ?? "—"}</Td>
                    <Td className={overdue ? "whitespace-nowrap font-medium text-red-600" : "whitespace-nowrap"}>{formatDate(f.dueDate) || "—"}</Td>
                    <Td><Badge tone={f.status === "OPEN" ? "red" : "amber"}>{humanize(f.status)}</Badge></Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </>
      )}

      {isDA && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={`Leads stuck in Mapping (${mappingCount.toLocaleString("en-IN")})`} actions={<LinkButton size="sm" href="/leads?stage=MAPPING">Open list</LinkButton>} pad={false}>
            <Table head={["Lead", "Category", "In Mapping since"]} empty="Nothing waiting in Mapping.">
              {stuckMapping.map((c) => (
                <tr key={c.id}>
                  <Td><Link className="text-brand-600 hover:underline" href={`/leads/${c.id}`}>{c.name}</Link> <span className="text-xs text-slate-400">{c.candidateCode}</span></Td>
                  <Td>{c.mainCategory ? humanize(c.mainCategory) : <Badge tone="amber">Unassigned</Badge>}</Td>
                  <Td className="whitespace-nowrap"><StageBadge stage="MAPPING" /> {formatDate(c.stageChangedAt)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Latest import batches" actions={<LinkButton size="sm" href="/import">Data import</LinkButton>} pad={false}>
            <Table head={["Uploaded", "File", "Total", "Dup.", "Invalid", "Accepted", "Status"]} empty="No imports yet.">
              {batches.map((b) => (
                <tr key={b.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(b.createdAt)}</Td>
                  <Td><Link className="text-brand-600 hover:underline" href={`/import/${b.id}`}>{b.fileName}</Link></Td>
                  <Td className="tabular-nums">{b.totalRows}</Td>
                  <Td className="tabular-nums">{b.duplicateRows}</Td>
                  <Td className="tabular-nums">{b.invalidRows}</Td>
                  <Td className="tabular-nums">{b.acceptedRows}</Td>
                  <Td><Badge tone={b.status === "COMPLETED" ? "green" : b.status === "FAILED" ? "red" : "amber"}>{humanize(b.status)}</Badge></Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
