import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@contracts/shared/dates";
import { SHEETS, formatKpi } from "@contracts/shared/kpi";
import { PageHeader, Card, Table, Td, Empty, LinkButton, Badge, Input, Select, Button } from "@/components/ui";
import { AgentChart } from "./agent-chart";

export const metadata = { title: "KPI analysis" };

type SP = { period?: string; date?: string; sheet?: string };

export default async function KpiPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const data = await api("GET /v1/kpi", { query: { period: sp.period, date: sp.date, sheet: sp.sheet } });
  const { period: p, table, targets, flags, snapshotFrozenAt, canExport, seesAll: all } = data;
  const sheets = SHEETS.filter((s) => data.sheets.includes(s.sheet));
  if (!data.sheet || !table || !flags) {
    return (
      <>
        <PageHeader title="KPI analysis" />
        <Empty title="No KPI sheet applies to your role">KPIs are tracked for team agents, leaders and Team 4.</Empty>
      </>
    );
  }
  const sheet = data.sheet;
  const defs = data.metrics;
  const targetOf = new Map(targets.map((t) => [t.metricKey, t]));
  const missed = (key: string, v: number | null | undefined) => {
    const t = targetOf.get(key);
    if (!t || v === null || v === undefined) return false;
    return t.comparator === "lte" ? v > t.target : v < t.target;
  };
  const isPast = p.isPast;

  const qs = (over: Partial<SP>) => {
    const merged: Record<string, string | undefined> = { period: p.periodType, date: p.dateKey, sheet, ...over };
    const u = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1]));
    return `/kpi?${u.toString()}`;
  };

  const chartDefs = data.chartMetrics;
  const chartSeries = chartDefs.map((d) => ({ key: d.key.replace(/\./g, "_"), label: d.label }));
  const chartData = table.members.map((m) => ({ name: m.name, ...Object.fromEntries(chartDefs.map((d) => [d.key.replace(/\./g, "_"), m.values[d.key] ?? 0])) }));

  return (
    <>
      <PageHeader
        title="KPI analysis"
        subtitle={`${p.periodType === "WEEK" ? "Week (Mon–Sun)" : "Month"} · ${formatDate(p.start)} to ${formatDate(p.lastDay)} · computed live from events`}
        actions={canExport ? <LinkButton variant="primary" href={`/api/v1/kpi/export?period=${p.periodType}&date=${p.dateKey}`}>Export to Excel</LinkButton> : undefined}
      />

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3" action="/kpi">
          <input type="hidden" name="sheet" value={sheet} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Period</span>
            <Select name="period" defaultValue={p.periodType} options={[{ value: "WEEK", label: "Week (Mon–Sun)" }, { value: "MONTH", label: "Month" }]} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Any date in the period</span>
            <Input type="date" name="date" defaultValue={p.dateKey} />
          </label>
          <Button type="submit" variant="secondary">Show</Button>
          <div className="flex gap-2">
            <LinkButton size="sm" href={qs({ date: p.prevDate })}>← Previous</LinkButton>
            <LinkButton size="sm" href={qs({ date: undefined })}>Current</LinkButton>
            <LinkButton size="sm" href={qs({ date: p.nextDate })}>Next →</LinkButton>
          </div>
        </form>
      </Card>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {sheets.map((s) => (
          <Link
            key={s.sheet}
            href={qs({ sheet: s.sheet })}
            className={clsx("-mb-px rounded-t-lg border px-3 py-2 text-sm", s.sheet === sheet ? "border-slate-200 border-b-white bg-white font-medium text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {s.title}
          </Link>
        ))}
      </div>

      {snapshotFrozenAt ? (
        <p className="mb-3 text-sm text-slate-500">
          <Badge tone="violet">Frozen</Badge> This period was frozen at {formatDateTime(snapshotFrozenAt)}. Values below are recomputed live from events; the snapshot is the frozen record.
        </p>
      ) : isPast ? (
        <p className="mb-3 text-sm text-slate-400">This period has not been frozen yet.</p>
      ) : null}

      <Card pad={false} title={table.title} className="mb-4">
        <Table head={["#", "KPI", ...table.members.map((m) => m.name), ...(all ? ["Team total"] : []), "Target"]} empty="No agents on this sheet.">
          {defs.map((d, i) => {
            const t = targetOf.get(d.key);
            const cell = (v: number | null | undefined, key: string) => (
              <Td key={key} className={clsx("text-right tabular-nums whitespace-nowrap", missed(d.key, v) && "bg-red-50 font-medium text-red-700")}>{formatKpi(v ?? null, d.unit)}</Td>
            );
            return (
              <tr key={d.key}>
                <Td className="text-slate-400">{i + 1}</Td>
                <Td className="min-w-56">
                  <span title={d.description || d.label} className={clsx(d.description && "cursor-help underline decoration-slate-300 decoration-dotted underline-offset-2")}>{d.label}</span>
                  {d.teamOnly && <span className="ml-1 text-xs text-slate-400">(team only)</span>}
                </Td>
                {table.members.map((m) => (d.teamOnly ? <Td key={m.id} className="text-right text-slate-300">·</Td> : cell(m.values[d.key], m.id)))}
                {all && cell(table.team[d.key], "team")}
                <Td className="whitespace-nowrap text-slate-500">{t ? `${t.comparator === "lte" ? "≤" : "≥"} ${formatKpi(t.target, d.unit)}` : "—"}</Td>
              </tr>
            );
          })}
        </Table>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">Red cells miss the configured target. Hover a KPI name for its definition.</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Headline metrics per agent" className="lg:col-span-2">
          <AgentChart data={chartData} series={chartSeries} />
        </Card>
        <Card title={`Red flags · ${SHEETS.find((s) => s.sheet === sheet)?.team}`} actions={<Badge tone={flags.count ? "red" : "green"}>{flags.count}</Badge>}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Red flags noticed</div>
              <p className="mt-1 whitespace-pre-line text-slate-700">{flags.noticed || "None"}</p>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Action taken</div>
              <p className="mt-1 whitespace-pre-line text-slate-700">{flags.actions || "None"}</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
