import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { formatDate } from "@contracts/shared/dates";
import { hasRole } from "@/lib/rbac";
import { PageHeader, Card, Badge, Empty, LinkButton } from "@/components/ui";
import { toTree } from "./tree";

export const metadata = { title: "Scorecard templates" };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const canEdit = hasRole(actor, "admin", "team3_leader");
  const templates = await prisma.evalTemplate.findMany({ include: { criteria: true, _count: { select: { evaluations: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <>
      <PageHeader
        title="Scorecard templates"
        subtitle="Criteria and sub-criteria with weights — weights must add up to exactly 100%"
        actions={
          <>
            <LinkButton href="/evaluations">← Scorecards</LinkButton>
            {canEdit && <LinkButton href="/evaluations/templates/new" variant="primary">+ New template</LinkButton>}
          </>
        }
      />
      {sp.saved && <p role="status" className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Template saved.</p>}
      {!templates.length ? (
        <Empty title="No templates yet">{canEdit ? "Create one — the default criteria from the grading sheet are pre-filled." : "Ask an admin to create one."}</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((t) => {
            const tree = toTree(t.criteria);
            const total = t.criteria.filter((c) => !t.criteria.some((x) => x.parentId === c.id)).reduce((a, c) => a + c.weightPct, 0);
            return (
              <Card
                key={t.id}
                title={
                  <span className="inline-flex items-center gap-2">
                    {t.name}
                    {!t.active && <Badge>inactive</Badge>}
                    {sp.saved === t.id && <Badge tone="green">saved</Badge>}
                  </span>
                }
                actions={canEdit ? <LinkButton size="sm" href={`/evaluations/templates/${t.id}`}>{t._count.evaluations ? "View / copy" : "Edit"}</LinkButton> : undefined}
              >
                {t.description && <p className="mb-3 text-sm text-slate-500">{t.description}</p>}
                <ul className="space-y-1 text-sm">
                  {tree.map((c) => (
                    <li key={c.id}>
                      <div className="flex justify-between gap-2">
                        <span className={c.children.length ? "font-medium" : ""}>{c.name}</span>
                        <span className="tabular-nums text-slate-500">{c.weightPct}%</span>
                      </div>
                      {c.children.length > 0 && (
                        <ul className="mt-0.5 space-y-0.5 pl-5 text-slate-600">
                          {c.children.map((ch) => (
                            <li key={ch.id} className="flex justify-between gap-2">
                              <span>↳ {ch.name}</span>
                              <span className="tabular-nums text-slate-400">{ch.weightPct}%</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                  <span>{t._count.evaluations} evaluation(s) · updated {formatDate(t.updatedAt)}</span>
                  <span className={Math.abs(total - 100) < 1e-9 ? "font-medium text-emerald-600" : "font-medium text-red-600"}>Total {Math.round(total * 100) / 100}%</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
