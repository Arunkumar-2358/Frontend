import Link from "next/link";
import type { MainCategory } from "@contracts";
import { MAIN_CATEGORIES } from "@contracts/shared/fields";
import { formatDate, formatDateTime } from "@contracts/shared/dates";
import { api } from "@/lib/api/client";
import { PageHeader, Card, Table, Td, Badge, Select, Stat, Pagination, StageBadge, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { TierBadge } from "@/components/engagement";
import { allocateAction } from "./actions";
import { ALLOCATE_FORM_ID, BulkAllocateForm } from "./bulk-allocate";

export const metadata = { title: "Qualified → Team 2 allocation" };

const catLabel = (c: MainCategory | null) => (c ? humanize(c) : "No category");

export default async function AllocationPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const sp = await searchParams;
  const category = sp.category === "NONE" || (MAIN_CATEGORIES as readonly string[]).includes(sp.category ?? "") ? (sp.category as MainCategory | "NONE") : undefined;
  const { canAllocate, page, pageSize, total, categories, sourcers, pending, recent } = await api("GET /v1/allocation", {
    query: { category, page: Math.max(1, Number(sp.page) || 1) },
  });
  const pendingTotal = categories.reduce((n, c) => n + c.pending, 0);
  const sourcerOptions = sourcers.map((s) => ({
    value: s.id,
    label: `${s.name}${s.isLeader ? " (TL)" : ""} · ${s.category ? humanize(s.category) : "all categories"} · ${s.load} lead${s.load === 1 ? "" : "s"}`,
  }));
  const href = (c?: string, p?: number) => `/allocation?${new URLSearchParams({ ...(c ? { category: c } : {}), ...(p && p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Qualified → Team 2 allocation"
        subtitle={
          canAllocate
            ? "Enrolled and qualified leads land here first. Hand each category (Doctor, Pharmacy, …) to the Team 2 sourcer who works it — they then own the lead and its availability check-ins."
            : "Enrolled and qualified leads waiting for the Team 3 leader to allocate them to Team 2 (view only)."
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Waiting for allocation" value={pendingTotal} tone={pendingTotal ? "amber" : undefined} />
        <Stat label="Categories waiting" value={categories.length} />
        <Stat label="Team 2 sourcers" value={sourcers.length} />
        <Stat label="With Team 2" value={sourcers.reduce((n, s) => n + s.load, 0)} hint="Qualified + active leads" />
      </div>

      <div className="grid gap-6">
        <Card title="By category" pad={false}>
          <Table head={["Category", "Waiting", canAllocate ? "Allocate all to" : "Suggested sourcer"]} empty="Nothing to allocate — every qualified lead has a Team 2 owner.">
            {categories.map((c) => {
              const key = c.category ?? "NONE";
              const suggested = sourcers.find((s) => s.id === c.suggestedSourcerId);
              return (
                <tr key={key}>
                  <Td className="font-medium">
                    <Link className="text-brand-600 hover:underline" href={href(key)}>{catLabel(c.category)}</Link>
                  </Td>
                  <Td className="tabular-nums">{c.pending}</Td>
                  <Td>
                    {canAllocate ? (
                      <ActionForm action={allocateAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="category" value={key} />
                        <Select name="sourcerId" options={sourcerOptions} defaultValue={c.suggestedSourcerId ?? ""} placeholder="Choose a sourcer…" className="min-w-64 py-1 text-sm" required />
                        <Submit size="sm">Allocate {c.pending}</Submit>
                      </ActionForm>
                    ) : (
                      suggested?.name ?? <span className="text-slate-300">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>

        <Card
          title={`${category ? `${catLabel(category === "NONE" ? null : category)} — ` : ""}waiting leads (${total})`}
          actions={category && <Link className="text-sm text-brand-600 hover:underline" href={href()}>All categories</Link>}
          pad={false}
        >
          {canAllocate && pending.length > 0 && (
            <div className="border-b border-slate-100 px-5 pb-4">
              <BulkAllocateForm action={allocateAction} sourcers={sourcerOptions} />
            </div>
          )}
          <Table head={[...(canAllocate ? [""] : []), "Lead", "Category / role", "Location", "Experience", "Qualified", "Engagement", "Scrutinised by"]} empty="No qualified leads are waiting.">
            {pending.map((c) => (
              <tr key={c.id}>
                {canAllocate && (
                  <Td>
                    <input type="checkbox" name="ids" value={c.id} form={ALLOCATE_FORM_ID} aria-label={`Select ${c.name}`} className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  </Td>
                )}
                <Td>
                  <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${c.id}`}>{c.name}</Link>
                  <div className="text-xs text-slate-400">{c.candidateCode}</div>
                </Td>
                <Td>
                  {catLabel(c.mainCategory)}
                  <div className="text-xs text-slate-400">{[c.jobTitle, c.primarySpecialty].filter(Boolean).join(" · ")}</div>
                </Td>
                <Td>{c.currentLocation ?? <span className="text-slate-300">—</span>}</Td>
                <Td className="whitespace-nowrap">{c.experienceYears != null ? `${c.experienceYears} yrs` : <span className="text-slate-300">—</span>}</Td>
                <Td className="whitespace-nowrap">{formatDate(c.stageChangedAt)}</Td>
                <Td><TierBadge tier={c.tier} /></Td>
                <Td>{c.owner?.name ?? <span className="text-slate-300">—</span>}</Td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => href(category, p)} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Team 2 sourcers" pad={false}>
            <Table head={["Sourcer", "Works", "Qualified + active leads"]} empty="No active Team 2 members.">
              {sourcers.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium">{s.name}{s.isLeader && <Badge tone="brand" className="ml-2">TL</Badge>}</Td>
                  <Td>{s.category ? humanize(s.category) : "All categories"}</Td>
                  <Td className="tabular-nums">{s.load}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title="Recently allocated" pad={false}>
            <Table head={["When", "Lead", "To", "By", "Now"]} empty="No allocations yet.">
              {recent.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(r.allocatedAt)}</Td>
                  <Td>
                    <Link className="text-brand-600 hover:underline" href={`/leads/${r.id}`}>{r.name}</Link>
                    <div className="text-xs text-slate-400">{r.candidateCode} · {catLabel(r.mainCategory)}</div>
                  </Td>
                  <Td>{r.owner?.name ?? "—"}</Td>
                  <Td>{r.allocatedBy ?? "—"}</Td>
                  <Td><StageBadge stage={r.stage} /></Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
