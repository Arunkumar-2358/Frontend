import Link from "next/link";
import clsx from "clsx";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { formatDateTime } from "@contracts/shared/dates";
import { hasRole } from "@/lib/rbac";
import { evaluationResults } from "@/server/eval/service";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { saveScoresAction } from "../actions";
import { PrintButton } from "./print-button";

export const metadata = { title: "Scorecard" };

const SCORE_OPTIONS = [1, 2, 3, 4, 5];
const fmt = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: d }));

export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!(await prisma.evaluation.findUnique({ where: { id }, select: { id: true } }))) notFound();
  const { evaluation, criteria, leaves, results } = await evaluationResults(id);
  const canScore = hasRole(actor, "admin", "recruiter", "team3_leader");
  const parentIds = new Set(criteria.filter((c) => c.parentId).map((c) => c.parentId));
  const topLevel = criteria.filter((c) => !c.parentId);
  const childrenOf = (pid: string) => criteria.filter((c) => c.parentId === pid);
  type GridRow = { c: (typeof criteria)[number]; kind: "parent" | "child" | "leaf" };
  const rows: GridRow[] = topLevel.flatMap((c): GridRow[] => (parentIds.has(c.id) ? [{ c, kind: "parent" }, ...childrenOf(c.id).map((ch): GridRow => ({ c: ch, kind: "child" }))] : [{ c, kind: "leaf" }]));
  const allComplete = results.every((r) => r.complete);
  const bestTotal = Math.max(0, ...results.map((r) => r.total));
  const isWinner = (r: (typeof results)[number]) => r.rank === 1 && r.total > 0 && bestTotal > 0;
  const bySlot = [...results].sort((a, b) => a.slot - b.slot);
  const ranked = [...results].sort((a, b) => a.rank - b.rank);

  return (
    <>
      <PageHeader
        title={evaluation.title}
        subtitle={
          <>
            Template: {evaluation.template.name}
            {evaluation.vacancy && (
              <>
                {" · "}
                <Link className="text-brand-600 hover:underline" href={`/vacancies/${evaluation.vacancy.id}`}>{evaluation.vacancy.code} · {evaluation.vacancy.title}</Link>
              </>
            )}
            {" · created "}
            {formatDateTime(evaluation.createdAt)}
          </>
        }
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <LinkButton href="/evaluations">← Scorecards</LinkButton>
            <PrintButton />
            <a href={`/api/evaluations/${evaluation.id}/export`} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50">
              Export .xlsx
            </a>
          </div>
        }
      />

      <div className="grid gap-6">
        <Card title="Results" actions={!allComplete ? <Badge tone="amber">Incomplete — not all criteria scored</Badge> : <Badge tone="green">Complete</Badge>}>
          <div className="grid gap-3 sm:grid-cols-3">
            {ranked.map((r) => (
              <div key={r.candidateId} className={clsx("rounded-xl border p-4", isWinner(r) ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">Rank {r.rank}</span>
                  <span className="flex gap-1">
                    {isWinner(r) && <Badge tone="green">🏆 Top</Badge>}
                    {!r.complete && <Badge tone="amber">incomplete</Badge>}
                  </span>
                </div>
                <div className="mt-1 font-semibold text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-400">{r.code} · Alternative {r.slot}</div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-2xl font-semibold tabular-nums">{fmt(r.total)}</span>
                  <span className="text-sm text-slate-500">/ 5</span>
                  <span className="text-lg font-medium tabular-nums text-slate-700">{fmt(r.scaled, 1)}</span>
                  <span className="text-sm text-slate-500">/ 100</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Scoring grid" pad={false}>
          <ActionForm action={saveScoresAction}>
            <input type="hidden" name="evaluationId" value={evaluation.id} />
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">Criterion</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">Weight</th>
                    {bySlot.map((r) => (
                      <th key={r.candidateId} className={clsx("px-3 py-2 text-left text-xs font-semibold text-slate-600", isWinner(r) && "bg-emerald-50")}>
                        <div className="normal-case">{r.name}</div>
                        <div className="font-normal text-slate-400">{r.code} · score (net)</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map(({ c, kind }) => (
                    <tr key={c.id} className={kind === "parent" ? "bg-slate-50/60" : undefined}>
                      <td className={clsx("px-3 py-2", kind === "parent" ? "font-semibold text-slate-800" : kind === "child" ? "pl-8 text-slate-700" : "font-medium text-slate-800")}>
                        {kind === "child" && <span className="mr-1 text-slate-300">↳</span>}
                        {c.name}
                      </td>
                      <td className={clsx("px-3 py-2 text-right tabular-nums", kind === "parent" ? "text-slate-400" : "text-slate-700")}>{fmt(c.weightPct)}%</td>
                      {bySlot.map((r) => {
                        if (kind === "parent") {
                          const kids = childrenOf(c.id);
                          const nets = kids.map((k) => r.perCriterion[k.id]?.net).filter((n): n is number => n !== null && n !== undefined);
                          return <td key={r.candidateId} className="px-3 py-2 text-xs text-slate-400 tabular-nums">{nets.length ? `net ${fmt(nets.reduce((a, b) => a + b, 0), 3)}` : ""}</td>;
                        }
                        const cell = r.perCriterion[c.id];
                        return (
                          <td key={r.candidateId} className={clsx("px-3 py-2", isWinner(r) && "bg-emerald-50/40")}>
                            <div className="flex items-center gap-2">
                              {canScore ? (
                                <select
                                  name={`s:${c.id}:${r.candidateId}`}
                                  defaultValue={cell?.score ?? ""}
                                  aria-label={`${c.name} — ${r.name}`}
                                  className={clsx("rounded-md border px-2 py-1 text-sm", cell?.score ? "border-slate-300" : "border-amber-300 bg-amber-50")}
                                >
                                  <option value="">–</option>
                                  {SCORE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : (
                                <span className="tabular-nums">{cell?.score ?? "—"}</span>
                              )}
                              <span className="text-xs text-slate-400 tabular-nums">{cell?.net !== null && cell?.net !== undefined ? fmt(cell.net, 3) : ""}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-3 py-2">Total (out of 5)</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(leaves.reduce((a, l) => a + l.weightPct, 0))}%</td>
                    {bySlot.map((r) => <td key={r.candidateId} className={clsx("px-3 py-2 tabular-nums", isWinner(r) && "text-emerald-700")}>{fmt(r.total, 3)}</td>)}
                  </tr>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-3 py-2">Scaled (out of 100)</td>
                    <td />
                    {bySlot.map((r) => <td key={r.candidateId} className={clsx("px-3 py-2 tabular-nums", isWinner(r) && "text-emerald-700")}>{fmt(r.scaled, 1)}</td>)}
                  </tr>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-3 py-2">Rank</td>
                    <td />
                    {bySlot.map((r) => (
                      <td key={r.candidateId} className="px-3 py-2">
                        {r.rank}
                        {!r.complete && <Badge tone="amber" className="ml-2">incomplete</Badge>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {canScore && (
              <div className="no-print flex items-center gap-3 border-t border-slate-100 px-4 py-3">
                <Submit>Save scores</Submit>
                <span className="text-xs text-slate-500">Score each criterion 1–5. Net = weight % × score; total out of 5, scaled ×20 to 100.</span>
              </div>
            )}
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
