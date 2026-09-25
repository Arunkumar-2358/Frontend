import { notFound } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireActor } from "@/lib/session";
import { hasRole } from "@contracts/shared/rbac";
import { DEFAULT_CRITERIA } from "@contracts/shared/labels";
import { PageHeader, Card, Empty, LinkButton } from "@/components/ui";
import { saveTemplateAction } from "../../actions";
import { TemplateEditor, type EditorCriterion } from "../template-editor";
import { toTree } from "../tree";

export const metadata = { title: "Edit scorecard template" };

async function loadTemplate(id: string) {
  try {
    return await api("GET /v1/evaluation-templates/{id}", { params: { id } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export default async function TemplateEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copy?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  if (!hasRole(actor, "admin", "team3_leader")) return <Empty title="Only admins and the Team 3 leader can edit scorecard templates" />;

  const sourceId = id === "new" ? sp.copy : id;
  const t = sourceId ? await loadTemplate(sourceId) : null;
  if (id !== "new" && !t) notFound();
  const used = id !== "new" && !!t?._count.evaluations;

  const criteria: EditorCriterion[] = t
    ? toTree(t.criteria).map((c) => (c.children.length ? { name: c.name, children: c.children.map((ch) => ({ name: ch.name, weightPct: ch.weightPct })) } : { name: c.name, weightPct: c.weightPct }))
    : DEFAULT_CRITERIA.map((c) => ({ name: c.name, weightPct: c.weightPct, children: c.children?.map((ch) => ({ ...ch })) }));

  return (
    <>
      <PageHeader
        title={id === "new" ? "New scorecard template" : `Edit “${t!.name}”`}
        subtitle="Add criteria, optionally split them into sub-criteria, and set weights. Saving is blocked unless the weights total exactly 100%."
        actions={<LinkButton href="/evaluations/templates">← Templates</LinkButton>}
      />
      {used ? (
        <Card>
          <p className="mb-3 text-sm text-slate-600">This template has already been used in {t!._count.evaluations} evaluation(s), so its criteria can’t be changed. Create a new version instead.</p>
          <LinkButton href={`/evaluations/templates/new?copy=${t!.id}`} variant="primary">Create a new version</LinkButton>
        </Card>
      ) : (
        <Card>
          <TemplateEditor
            action={saveTemplateAction}
            initial={{
              id: id === "new" ? undefined : t!.id,
              name: id === "new" ? (t ? `${t.name} v2` : "Employee grading template") : t!.name,
              description: t?.description ?? "",
              criteria,
            }}
          />
        </Card>
      )}
    </>
  );
}
