import type { EvalCriterion } from "@contracts";

export type CriterionTree = { id: string; name: string; weightPct: number; children: { id: string; name: string; weightPct: number }[] };

/** Flat EvalCriterion rows (sortOrder) → parent/children tree. */
export function toTree(rows: EvalCriterion[]): CriterionTree[] {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted
    .filter((c) => !c.parentId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      weightPct: c.weightPct,
      children: sorted.filter((ch) => ch.parentId === c.id).map((ch) => ({ id: ch.id, name: ch.name, weightPct: ch.weightPct })),
    }));
}
