import Link from "next/link";
import type { Stage } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { formatDate } from "@contracts/shared/dates";
import { hasRole, leadScope } from "@/lib/rbac";
import { leadSearchWhere } from "@/server/search/service";
import { PageHeader, Card, Field, Input, Select, Checkbox, Empty, LinkButton, StageBadge, btnClass } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { createEvaluationAction } from "../actions";

export const metadata = { title: "New evaluation" };

type SP = { vacancyId?: string; q?: string; candidateId?: string };

export default async function NewEvaluationPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  if (!hasRole(actor, "admin", "recruiter", "team3_leader")) return <Empty title="Only Team 3 can create evaluations" />;

  const [templates, vacancies] = await Promise.all([
    prisma.evalTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.vacancy.findMany({
      where: { OR: [{ status: { not: "CLOSED" } }, ...(sp.vacancyId ? [{ id: sp.vacancyId }] : [])], submissions: { some: {} } },
      orderBy: { postedAt: "desc" },
      take: 200,
      select: { id: true, code: true, title: true, clientOrg: { select: { name: true } } },
    }),
  ]);
  const vacancy = sp.vacancyId ? await prisma.vacancy.findUnique({ where: { id: sp.vacancyId }, select: { id: true, code: true, title: true } }) : null;

  type Option = { id: string; name: string; candidateCode: string; stage: Stage; hint?: string };
  let options: Option[] = [];
  if (vacancy) {
    const subs = await prisma.submission.findMany({
      where: { vacancyId: vacancy.id },
      include: { candidate: { select: { id: true, name: true, candidateCode: true, stage: true } } },
      orderBy: [{ matchScore: "desc" }, { submittedAt: "asc" }],
    });
    options = subs.map((s) => ({ ...s.candidate, hint: `submitted ${formatDate(s.submittedAt)}${s.matchScore !== null ? ` · match ${s.matchScore}` : ""}` }));
  } else if (sp.q?.trim()) {
    const q = sp.q.trim();
    options = await prisma.candidate.findMany({
      where: { AND: [leadScope(actor), { anonymizedAt: null }, leadSearchWhere(q) ?? {}] },
      select: { id: true, name: true, candidateCode: true, stage: true },
      orderBy: { candidateCode: "asc" },
      take: 25,
    });
  }
  if (sp.candidateId && !options.some((o) => o.id === sp.candidateId)) {
    const c = await prisma.candidate.findUnique({ where: { id: sp.candidateId }, select: { id: true, name: true, candidateCode: true, stage: true } });
    if (c) options.unshift(c);
  }

  return (
    <>
      <PageHeader title="New evaluation" subtitle="Pick a template and 1–3 candidates to compare" actions={<LinkButton href="/evaluations">← Scorecards</LinkButton>} />
      {!templates.length ? (
        <Empty title="No active scorecard templates">
          <Link className="text-brand-600 hover:underline" href="/evaluations/templates">Create a template</Link> first.
        </Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="1 · Candidates source">
            <form className="space-y-3">
              <Field label="Vacancy" hint="Candidates come from the vacancy's submissions.">
                <Select name="vacancyId" defaultValue={vacancy?.id ?? ""} placeholder="No vacancy — search candidates" options={vacancies.map((v) => ({ value: v.id, label: `${v.code} · ${v.title} (${v.clientOrg.name})` }))} />
              </Field>
              <Field label="Or search by code / name" hint="Used when no vacancy is chosen.">
                <Input name="q" defaultValue={sp.q ?? ""} placeholder="e.g. NTC000123" />
              </Field>
              {sp.candidateId && <input type="hidden" name="candidateId" value={sp.candidateId} />}
              <button type="submit" className={btnClass("secondary")}>Load candidates</button>
            </form>
          </Card>
          <Card title="2 · Evaluation" className="lg:col-span-2">
            <ActionForm action={createEvaluationAction} className="space-y-4">
              {vacancy && <input type="hidden" name="vacancyId" value={vacancy.id} />}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" required><Input name="title" required defaultValue={vacancy ? `${vacancy.code} ${vacancy.title} — interview panel` : ""} /></Field>
                <Field label="Template" required><Select name="templateId" required defaultValue={templates[0].id} options={templates.map((t) => ({ value: t.id, label: t.name }))} /></Field>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">
                  Candidates (1–3){vacancy ? ` — submissions for ${vacancy.code}` : ""}
                </div>
                {options.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.map((o) => (
                      <div key={o.id} className="rounded-lg border border-slate-200 p-2">
                        <Checkbox
                          name="candidateId"
                          value={o.id}
                          defaultChecked={o.id === sp.candidateId}
                          label={
                            <span>
                              {o.name} <span className="text-xs text-slate-400">{o.candidateCode}</span> <StageBadge stage={o.stage} />
                            </span>
                          }
                        />
                        {o.hint && <div className="ml-6 text-xs text-slate-400">{o.hint}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{vacancy ? "This vacancy has no submissions yet." : "Choose a vacancy or search for candidates, then click “Load candidates”."}</p>
                )}
              </div>
              <Submit>Create &amp; start scoring</Submit>
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
