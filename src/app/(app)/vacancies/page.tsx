import Link from "next/link";
import type { Prisma, VacancyStatus, TeamCode, MainCategory } from "@contracts";
import { prisma } from "@/lib/db";
import { vacancySearchWhere } from "@/server/search/service";
import { requireActor } from "@/lib/session";
import { formatDateTime } from "@contracts/shared/dates";
import { getAllSettings } from "@/lib/settings";
import { hasRole } from "@/lib/rbac";
import { MAIN_CATEGORIES } from "@contracts/shared/fields";
import { sourcingStats } from "@/server/vacancies/service";
import { PageHeader, Card, Table, Td, Badge, Select, Field, Pagination, LinkButton, humanize, btnClass, Input } from "@/components/ui";
import { fmtMinutes, TEAM_LABEL, ORG_TYPE_LABEL, STATUS_TONE } from "./util";

export const metadata = { title: "Vacancies" };

const PAGE_SIZE = 25;
const STATUSES: VacancyStatus[] = ["OPEN", "PENDING", "CLOSED"];
const TEAMS: TeamCode[] = ["T3A", "T3B", "T3C"];

type SP = { q?: string; status?: string; category?: string; team?: string; org?: string; mine?: string; page?: string };

export default async function VacanciesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = vacancySearchWhere(sp.q);
  const filters: Prisma.VacancyWhereInput = {
    ...(STATUSES.includes(sp.status as VacancyStatus) ? { status: sp.status as VacancyStatus } : {}),
    ...((MAIN_CATEGORIES as readonly string[]).includes(sp.category ?? "") ? { category: sp.category as MainCategory } : {}),
    ...(TEAMS.includes(sp.team as TeamCode) ? { routedTeam: sp.team as TeamCode } : {}),
    ...(sp.org ? { clientOrgId: sp.org } : {}),
    ...(sp.mine === "1" ? { OR: [{ recruiterId: actor.id }, { sourcerId: actor.id }] } : {}),
  };
  const where: Prisma.VacancyWhereInput = search ? { AND: [filters, search] } : filters;
  const [total, vacancies, orgs, settings] = await Promise.all([
    prisma.vacancy.count({ where }),
    prisma.vacancy.findMany({
      where,
      include: { clientOrg: true, recruiter: { select: { name: true } }, sourcer: { select: { name: true } }, submissions: { select: { isNtSource: true, submittedAt: true } } },
      orderBy: [{ status: "asc" }, { postedAt: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.clientOrg.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getAllSettings(),
  ]);
  const canCreate = hasRole(actor, "admin", "sourcer", "team2_leader", "recruiter", "team3_leader");
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const k of ["q", "status", "category", "team", "org", "mine"] as const) if (sp[k]) u.set(k, sp[k]!);
    u.set("page", String(p));
    return `/vacancies?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Vacancies & matching"
        subtitle={`${total} vacancies · target ${settings.cvTargetPerVacancy} matching CVs per vacancy (≥${settings.cvMinTeam3bc} for Teams 3b/3c)`}
        actions={canCreate ? <LinkButton href="/vacancies/new" variant="primary">+ New vacancy</LinkButton> : undefined}
      />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
          <Field label="Search" className="sm:col-span-3 lg:col-span-1"><Input name="q" defaultValue={sp.q ?? ""} placeholder="Title, code, client, city…" /></Field>
          <Field label="Status"><Select name="status" defaultValue={sp.status ?? ""} placeholder="Any" options={STATUSES} /></Field>
          <Field label="Category"><Select name="category" defaultValue={sp.category ?? ""} placeholder="Any" options={[...MAIN_CATEGORIES]} /></Field>
          <Field label="Routed team"><Select name="team" defaultValue={sp.team ?? ""} placeholder="Any" options={TEAMS.map((t) => ({ value: t, label: TEAM_LABEL[t]! }))} /></Field>
          <Field label="Client org"><Select name="org" defaultValue={sp.org ?? ""} placeholder="Any" options={orgs.map((o) => ({ value: o.id, label: o.name }))} /></Field>
          <Field label="Assigned"><Select name="mine" defaultValue={sp.mine ?? ""} placeholder="Everyone" options={[{ value: "1", label: "Mine only" }]} /></Field>
          <div className="flex gap-2">
            <button type="submit" className={btnClass("primary")}>Filter</button>
            <Link href="/vacancies" className={btnClass("ghost")}>Reset</Link>
          </div>
        </form>
      </Card>
      <Card pad={false}>
        <Table head={["Vacancy", "Client org", "Location", "Team", "Recruiter / sourcer", "Posted", "CVs", "NT / non-NT", "TAT", "Status"]} empty="No vacancies match these filters.">
          {vacancies.map((v) => {
            const stats = sourcingStats(v, settings.cvTargetPerVacancy);
            const bc = v.routedTeam === "T3B" || v.routedTeam === "T3C";
            return (
              <tr key={v.id}>
                <Td>
                  <Link className="font-medium text-brand-600 hover:underline" href={`/vacancies/${v.id}`}>{v.title}</Link>
                  <div className="text-xs text-slate-400">{v.code} · {humanize(v.category)}{v.specialty ? ` · ${v.specialty}` : ""}</div>
                </Td>
                <Td>
                  {v.clientOrg.name}
                  <div><Badge tone={v.clientOrg.type === "GENERAL" ? "slate" : v.clientOrg.type === "EXISTING" ? "violet" : "cyan"}>{ORG_TYPE_LABEL[v.clientOrg.type]}</Badge></div>
                </Td>
                <Td>{v.location}</Td>
                <Td className="whitespace-nowrap">{TEAM_LABEL[v.routedTeam] ?? v.routedTeam}</Td>
                <Td className="whitespace-nowrap text-xs">
                  <div>R: {v.recruiter?.name ?? <span className="text-slate-300">—</span>}</div>
                  <div>S: {v.sourcer?.name ?? <span className="text-slate-300">—</span>}</div>
                </Td>
                <Td className="whitespace-nowrap">
                  {formatDateTime(v.postedAt)}
                  {v.addedBefore2pm && <div><Badge tone="green">before 2 pm</Badge></div>}
                </Td>
                <Td className="whitespace-nowrap">
                  <span className={stats.targetMet ? "font-semibold text-emerald-600" : ""}>{stats.submissions} / {stats.target}</span>
                  {bc && (
                    <div>
                      <Badge tone={stats.submissions >= settings.cvMinTeam3bc ? "green" : "amber"}>≥{settings.cvMinTeam3bc}: {stats.submissions >= settings.cvMinTeam3bc ? "met" : "not met"}</Badge>
                    </div>
                  )}
                </Td>
                <Td className="whitespace-nowrap tabular-nums">{stats.nt} / {stats.nonNt}</Td>
                <Td className="whitespace-nowrap text-xs">{fmtMinutes(stats.tatMinutes)}</Td>
                <Td><Badge tone={STATUS_TONE[v.status]}>{humanize(v.status)}</Badge></Td>
              </tr>
            );
          })}
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={qs} />
      </Card>
    </>
  );
}
