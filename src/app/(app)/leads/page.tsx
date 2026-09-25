import Link from "next/link";
import type { LeadBoard, LeadListPage, LeadSourceFilter, MainCategory, Stage } from "@contracts";
import { api } from "@/lib/api/client";
import { requireActor } from "@/lib/session";
import { formatDateTime } from "@contracts/shared/dates";
import { PIPELINE, EXIT_STAGES, STAGE_LABEL } from "@contracts/shared/lifecycle";
import { MAIN_CATEGORIES, LEAD_SOURCES, isNtSourceFor } from "@contracts/shared/fields";
import { PageHeader, Card, Table, Td, Badge, StageBadge, Progress, Pagination, LinkButton, Input, Select, Button, humanize, STAGE_TONE } from "@/components/ui";

export const metadata = { title: "Leads & talent pool" };

const ALL_STAGES = [...PIPELINE, ...EXIT_STAGES];

type SP = { page?: string; stage?: string; category?: string; owner?: string; source?: string; cold?: string; q?: string; view?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireActor();
  const sp = await searchParams;
  const view = sp.view === "kanban" ? "kanban" : "list";
  const page = Math.max(1, Number(sp.page) || 1);

  const stage = ALL_STAGES.includes(sp.stage as Stage) ? (sp.stage as Stage) : undefined;
  const category = (MAIN_CATEGORIES as readonly string[]).includes(sp.category ?? "") ? (sp.category as MainCategory) : undefined;
  const source = sp.source === "NT_ALL" || sp.source === "NON_NT" || (LEAD_SOURCES as readonly string[]).includes(sp.source ?? "") ? sp.source : undefined;
  const q = sp.q?.trim() || undefined;

  // Filters common to list and board (the board ignores the stage filter — it is the columns).
  const { owners, list, board } = await api("GET /v1/leads", {
    query: {
      view,
      page: view === "list" ? page : undefined,
      stage: view === "list" ? stage : undefined,
      category,
      owner: sp.owner || undefined,
      source: source as LeadSourceFilter | undefined,
      cold: sp.cold === "1" ? true : undefined,
      q,
    },
  });

  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged: SP = { ...sp, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  return (
    <>
      <PageHeader
        title="Leads & talent pool"
        subtitle="Every candidate you can see, at every life-cycle stage."
        actions={
          <>
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm shadow-xs">
              <Link href={qs({ view: undefined, page: undefined })} className={view === "list" ? "rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-900" : "px-3 py-1.5 text-slate-500 hover:text-slate-800"}>List</Link>
              <Link href={qs({ view: "kanban", page: undefined, stage: undefined })} className={view === "kanban" ? "rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-900" : "px-3 py-1.5 text-slate-500 hover:text-slate-800"}>Kanban</Link>
            </div>
            <LinkButton href="/leads/new" variant="primary">+ New lead</LinkButton>
          </>
        }
      />

      <Card className="mb-4">
        <form method="get" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {view === "kanban" && <input type="hidden" name="view" value="kanban" />}
          <Input name="q" defaultValue={q} placeholder="Name, code, mobile, email, specialty, location…" className="col-span-2 md:col-span-4 xl:col-span-2" />
          {view === "list" && (
            <Select name="stage" defaultValue={stage ?? ""} placeholder="All stages" options={ALL_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} />
          )}
          <Select name="category" defaultValue={category ?? ""} placeholder="All categories" options={[...MAIN_CATEGORIES]} />
          <Select
            name="owner"
            defaultValue={sp.owner ?? ""}
            placeholder="Any owner"
            options={[{ value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...owners.map((u) => ({ value: u.id, label: u.name }))]}
          />
          <Select
            name="source"
            defaultValue={source ?? ""}
            placeholder="Any source"
            options={[{ value: "NT_ALL", label: "All NT sources" }, { value: "NON_NT", label: "All non-NT portals" }, ...LEAD_SOURCES.map((s) => ({ value: s, label: humanize(s) }))]}
          />
          <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-4 xl:col-span-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="cold" value="1" defaultChecked={sp.cold === "1"} className="h-4 w-4 rounded border-slate-300" />
              Cold only
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm">Filter</Button>
              <LinkButton href={view === "kanban" ? "/leads?view=kanban" : "/leads"} size="sm" variant="ghost">Reset</LinkButton>
            </div>
          </div>
        </form>
      </Card>

      {board ? <Kanban board={board} qs={qs} /> : list ? <LeadList list={list} qs={qs} /> : null}
    </>
  );
}

function LeadList({ list, qs }: { list: LeadListPage; qs: (o: Partial<SP>) => string }) {
  const { total, rows, page, pageSize } = list;
  const t = Date.now();
  return (
    <Card pad={false}>
      <Table head={["Code", "Name", "Category / specialty", "Location", "Stage", "Owner", "Completeness", "Next follow-up", "Mobile"]} empty="No leads match these filters.">
        {rows.map((c) => {
          const overdue = c.nextFollowupAt && c.nextFollowupAt.getTime() <= t;
          return (
            <tr key={c.id} className="hover:bg-slate-50">
              <Td className="font-mono text-xs whitespace-nowrap">
                <Link href={`/leads/${c.id}`} className="text-brand-600 hover:underline">{c.candidateCode}</Link>
              </Td>
              <Td className="whitespace-nowrap">
                <Link href={`/leads/${c.id}`} className="font-medium text-slate-900 hover:underline">{c.name}</Link>
                {!isNtSourceFor(c.source) && <Badge tone="amber" className="ml-1.5">non-NT</Badge>}
              </Td>
              <Td>
                <div>{c.mainCategory ? humanize(c.mainCategory) : <span className="text-slate-300">—</span>}</div>
                {(c.primarySpecialty || c.jobTitle) && <div className="text-xs text-slate-500">{c.primarySpecialty ?? c.jobTitle}</div>}
              </Td>
              <Td className="whitespace-nowrap">{c.currentLocation ?? c.preferredLocations[0] ?? <span className="text-slate-300">—</span>}</Td>
              <Td><StageBadge stage={c.stage} cold={c.isCold} /></Td>
              <Td className="whitespace-nowrap">{c.owner?.name ?? <span className="text-slate-400">Unassigned</span>}</Td>
              <Td><Progress value={c.profileCompletenessPct} /></Td>
              <Td className={overdue ? "whitespace-nowrap font-medium text-red-600" : "whitespace-nowrap"}>{c.nextFollowupAt ? formatDateTime(c.nextFollowupAt) : <span className="text-slate-300">—</span>}</Td>
              <Td className="font-mono text-xs whitespace-nowrap">{c.mobileMasked}</Td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => qs({ page: String(p) })} />
    </Card>
  );
}

function Kanban({ board, qs }: { board: LeadBoard; qs: (o: Partial<SP>) => string }) {
  const KANBAN_CARDS = board.cardsPerColumn;
  const countOf = (s: Stage) => board.counts[s] ?? 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">Exits</span>
        {EXIT_STAGES.map((s) => (
          <Link key={s} href={qs({ view: undefined, stage: s, page: undefined })} className="hover:opacity-80">
            <Badge tone={STAGE_TONE[s]}>
              {STAGE_LABEL[s]} · {countOf(s).toLocaleString("en-IN")}
            </Badge>
          </Link>
        ))}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3" style={{ minWidth: `${PIPELINE.length * 16.5}rem` }}>
          {PIPELINE.map((s) => {
            const n = countOf(s);
            return (
              <div key={s} className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <Link href={qs({ view: undefined, stage: s, page: undefined })} className="text-sm font-semibold text-slate-800 hover:underline">
                    {STAGE_LABEL[s]}
                  </Link>
                  <Badge tone={STAGE_TONE[s]}>{n.toLocaleString("en-IN")}</Badge>
                </div>
                <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
                  {(board.columns[s] ?? []).map((c) => (
                    <Link key={c.id} href={`/leads/${c.id}`} className="block rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs hover:border-brand-300">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{c.name}</span>
                        {c.isCold && <Badge tone="blue">❄</Badge>}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">{c.candidateCode}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        {c.mainCategory && <Badge>{humanize(c.mainCategory)}</Badge>}
                        {c.primarySpecialty && <span className="truncate">{c.primarySpecialty}</span>}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{c.owner?.name ?? "Unassigned"}</div>
                    </Link>
                  ))}
                  {n === 0 && <p className="px-1 py-6 text-center text-xs text-slate-400">No leads</p>}
                  {n > KANBAN_CARDS && (
                    <Link href={qs({ view: undefined, stage: s, page: undefined })} className="px-1 py-1 text-center text-xs text-brand-600 hover:underline">
                      +{(n - KANBAN_CARDS).toLocaleString("en-IN")} more in list view
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
