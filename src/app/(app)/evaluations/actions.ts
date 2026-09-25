"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { run, str, ids, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { createEvaluation, saveScores, saveTemplate, type CriterionInput } from "@/server/eval/service";

export async function createEvaluationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const title = str(fd, "title");
    const templateId = str(fd, "templateId");
    if (!title) throw new ValidationError("Title is required");
    if (!templateId) throw new ValidationError("Choose a template");
    const e = await createEvaluation(actor, { title, templateId, vacancyId: str(fd, "vacancyId") ?? null, candidateIds: ids(fd, "candidateId") });
    revalidatePath("/evaluations");
    redirect(`/evaluations/${e.id}`);
  });
}

export async function saveScoresAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const evaluationId = String(fd.get("evaluationId"));
    const scores: { criterionId: string; candidateId: string; score: number }[] = [];
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("s:") || typeof v !== "string" || v === "") continue;
      const [, criterionId, candidateId] = k.split(":");
      scores.push({ criterionId, candidateId, score: Number(v) });
    }
    if (!scores.length) throw new ValidationError("Enter at least one score");
    await saveScores(actor, evaluationId, scores);
    revalidatePath(`/evaluations/${evaluationId}`);
    return `Saved ${scores.length} score(s)`;
  });
}

type RawCriterion = { name?: unknown; weightPct?: unknown; children?: { name?: unknown; weightPct?: unknown }[] };

export async function saveTemplateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const name = str(fd, "name");
    if (!name) throw new ValidationError("Template name is required");
    let raw: RawCriterion[];
    try {
      raw = JSON.parse(String(fd.get("criteria") ?? "[]"));
    } catch {
      throw new ValidationError("Could not read the criteria");
    }
    if (!Array.isArray(raw)) throw new ValidationError("Could not read the criteria");
    const criteria: CriterionInput[] = raw.map((c) => {
      const children = (Array.isArray(c.children) ? c.children : []).map((ch) => ({ name: String(ch.name ?? "").trim(), weightPct: Number(ch.weightPct) || 0 }));
      return children.length ? { name: String(c.name ?? "").trim(), children } : { name: String(c.name ?? "").trim(), weightPct: Number(c.weightPct) || 0 };
    });
    if (criteria.some((c) => c.children?.some((ch) => !ch.name))) throw new ValidationError("Sub-criterion names are required");
    const id = str(fd, "id");
    if (await prisma.evalTemplate.findFirst({ where: { name, ...(id ? { id: { not: id } } : {}) } })) throw new ValidationError(`A template named "${name}" already exists`);
    const t = await saveTemplate(actor, { id, name, description: str(fd, "description"), criteria });
    revalidatePath("/evaluations/templates");
    redirect(`/evaluations/templates?saved=${t.id}`);
  });
}
