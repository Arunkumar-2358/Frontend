"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/client";
import { run, str, ids, FormError, type ActionState } from "@/lib/action";
import type { CriterionInput } from "@contracts/shared/labels";

export async function createEvaluationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const e = await api("POST /v1/evaluations", { body: { title: str(fd, "title"), templateId: str(fd, "templateId"), vacancyId: str(fd, "vacancyId") ?? null, candidateIds: ids(fd, "candidateId") } });
    revalidatePath("/evaluations");
    redirect(`/evaluations/${e.id}`);
  });
}

export async function saveScoresAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const evaluationId = String(fd.get("evaluationId"));
    const scores: { criterionId: string; candidateId: string; score: number }[] = [];
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("s:") || typeof v !== "string" || v === "") continue;
      const [, criterionId, candidateId] = k.split(":");
      scores.push({ criterionId, candidateId, score: Number(v) });
    }
    const { message } = await api("POST /v1/evaluations/{id}/scores", { params: { id: evaluationId }, body: { scores } });
    revalidatePath(`/evaluations/${evaluationId}`);
    return message;
  });
}

type RawCriterion = { name?: unknown; weightPct?: unknown; children?: { name?: unknown; weightPct?: unknown }[] };

export async function saveTemplateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    let raw: RawCriterion[];
    try {
      raw = JSON.parse(String(fd.get("criteria") ?? "[]"));
    } catch {
      throw new FormError("Could not read the criteria");
    }
    if (!Array.isArray(raw)) throw new FormError("Could not read the criteria");
    const criteria: CriterionInput[] = raw.map((c) => {
      const children = (Array.isArray(c.children) ? c.children : []).map((ch) => ({ name: String(ch.name ?? "").trim(), weightPct: Number(ch.weightPct) || 0 }));
      return children.length ? { name: String(c.name ?? "").trim(), children } : { name: String(c.name ?? "").trim(), weightPct: Number(c.weightPct) || 0 };
    });
    const t = await api("POST /v1/evaluation-templates", { body: { id: str(fd, "id"), name: str(fd, "name"), description: str(fd, "description"), criteria } });
    revalidatePath("/evaluations/templates");
    redirect(`/evaluations/templates?saved=${t.id}`);
  });
}
