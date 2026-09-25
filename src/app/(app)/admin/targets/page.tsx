import { prisma } from "@/lib/db";
import { KPI_BY_KEY, KPI_DEFINITIONS, SHEETS } from "@/kpi/definitions";
import { PageHeader, Card, Table, Td, Input, Select, Field, Button } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { deleteTargetAction, saveTargetAction } from "./actions";
import { TARGETABLE_UNITS } from "./units";

export const metadata = { title: "KPI targets" };

const UNIT_SUFFIX: Record<string, string> = { pct: "%", minutes: "min", count: "", avg: "avg" };

export default async function TargetsPage({ searchParams }: { searchParams: Promise<{ sheet?: string }> }) {
  const sp = await searchParams;
  const targets = await prisma.kpiTarget.findMany({ orderBy: [{ teamCode: "asc" }, { metricKey: "asc" }, { periodType: "asc" }] });
  const sheetTitle = Object.fromEntries(SHEETS.map((s) => [s.sheet, s.title]));
  const metricOpts = KPI_DEFINITIONS.filter((d) => TARGETABLE_UNITS.includes(d.unit) && (!sp.sheet || d.sheet === sp.sheet)).map((d) => ({ value: d.key, label: `${sheetTitle[d.sheet].split(" – ")[0]} · ${d.label}${UNIT_SUFFIX[d.unit] ? ` (${UNIT_SUFFIX[d.unit]})` : ""}` }));
  const teamOpts = [...new Set(SHEETS.map((s) => s.team))].map((t) => ({ value: t, label: t }));
  const periodOpts = [{ value: "WEEK", label: "Week" }, { value: "MONTH", label: "Month" }];
  const cmpOpts = [{ value: "gte", label: "≥ (at least)" }, { value: "lte", label: "≤ (at most)" }];
  const shown = targets.filter((t) => !sp.sheet || KPI_BY_KEY[t.metricKey]?.sheet === sp.sheet);
  const cls = "py-1 text-xs";

  return (
    <>
      <PageHeader title="KPI targets" subtitle="Targets per metric, team and period. Missed targets colour the KPI sheet red and raise automatic red flags when the period is frozen." />
      <Card className="mb-4">
        <form action="/admin/targets" className="flex flex-wrap items-end gap-2">
          <Select name="sheet" defaultValue={sp.sheet ?? ""} placeholder="All sheets" options={SHEETS.map((s) => ({ value: s.sheet, label: s.title }))} className="w-auto" />
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </Card>

      <Card title="Add / replace target" className="mb-4">
        <ActionForm action={saveTargetAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Metric" required className="lg:col-span-2"><Select name="metricKey" required placeholder="Choose metric…" options={metricOpts} /></Field>
          <Field label="Team" hint="Blank = the sheet's team"><Select name="teamCode" placeholder="Sheet's team" options={teamOpts} /></Field>
          <Field label="Period" required><Select name="periodType" defaultValue="WEEK" options={periodOpts} /></Field>
          <Field label="Comparator"><Select name="comparator" defaultValue="gte" options={cmpOpts} /></Field>
          <Field label="Target" required><Input type="number" step="any" name="target" required /></Field>
          <div className="lg:col-span-6"><Submit>Save target</Submit></div>
        </ActionForm>
      </Card>

      <Card pad={false}>
        <Table head={["Metric", "Target (team · period · comparator · value)", ""]} empty="No targets.">
          {shown.map((t) => {
            const d = KPI_BY_KEY[t.metricKey];
            return (
              <tr key={t.id}>
                <Td className="min-w-64">
                  <div className="font-medium text-slate-900" title={d?.description}>{d?.label ?? t.metricKey}</div>
                  <div className="text-xs text-slate-400">{d ? sheetTitle[d.sheet] : "Unknown metric"} · <span className="font-mono">{t.metricKey}</span></div>
                </Td>
                <Td>
                  <ActionForm action={saveTargetAction} className="flex flex-wrap items-center gap-1">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="metricKey" value={t.metricKey} />
                    <Select name="teamCode" defaultValue={t.teamCode} options={teamOpts} className={`w-20 ${cls}`} />
                    <Select name="periodType" defaultValue={t.periodType} options={periodOpts} className={`w-24 ${cls}`} />
                    <Select name="comparator" defaultValue={t.comparator} options={cmpOpts} className={`w-32 ${cls}`} />
                    <Input type="number" step="any" name="target" defaultValue={t.target} className={`w-24 ${cls}`} />
                    <span className="text-xs text-slate-400">{d ? UNIT_SUFFIX[d.unit] : ""}</span>
                    <Submit size="sm" variant="secondary">Save</Submit>
                  </ActionForm>
                </Td>
                <Td>
                  <ActionForm action={deleteTargetAction} confirm="Delete this target?">
                    <input type="hidden" name="id" value={t.id} />
                    <Submit size="sm" variant="ghost">Delete</Submit>
                  </ActionForm>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
