import clsx from "clsx";
import type { DailyRow } from "@contracts";
import { DAILY_COMBINED, DAILY_LAYOUT, monthLabel, type DailyColumn, type DailyKpi, type DailySection } from "@contracts/shared/daily-dashboard";
import { api } from "@/lib/api/client";
import { PageHeader, Card, Table, Td, Badge, Input, Select, Button, LinkButton } from "@/components/ui";

export const metadata = { title: "Daily dashboard" };

const SHEET_LABEL = {
  T1A: "TA team 1 (TA leads)",
  T2: "TA team 2 (sourcers)",
  T3A: "TA team 3a (general)",
  T3B: "TA team 3b (existing clients)",
  T3C: "TA team 3c (free-trial orgs)",
  T3: "TA team 3 (3a + 3b consolidated)",
} as const;

const tat = (h: number | null) => (h === null ? "" : h < 48 ? `${h} hrs` : `${Math.round((h / 24) * 10) / 10} days`);

function Head({ children }: { children: string }) {
  return <span className="block min-w-24 max-w-44 text-xs leading-snug font-medium whitespace-normal normal-case">{children}</span>;
}

function Cell({ c, row }: { c: DailyColumn; row: DailyRow }) {
  if (c.kind === "flags") {
    if (row.kind !== "day") return row.flagCount && !row.future ? <span className="tabular-nums">{row.flagCount}</span> : null;
    return (
      <div className="max-w-64 space-y-1">
        {row.flags.map((f, i) => (
          <div key={i} className="text-xs">
            <span className="text-red-700">⚑ {f.description}</span>
            {f.action && <span className="text-slate-500"> · action: {f.action}</span>}
            <Badge tone={f.status === "CLOSED" ? "green" : "amber"} className="ml-1">{f.status === "CLOSED" ? "closed" : "open"}</Badge>
            {f.tatHours !== null && <span className="text-slate-400"> · TAT {tat(f.tatHours)}</span>}
          </div>
        ))}
      </div>
    );
  }
  if (c.kind === "postings") {
    return (
      <div className="max-w-64 space-y-1 text-xs">
        {row.postings.map((p) => (
          <div key={p.code}>
            <span className="font-medium">{p.code} {p.title}</span>
            {p[c.field] && <span className="text-slate-500">: {p[c.field]}</span>}
          </div>
        ))}
      </div>
    );
  }
  const v = row.values[c.key];
  return v === null || v === undefined ? null : <span className="tabular-nums">{v}</span>;
}

function SectionTable({ section, days, weeks, total }: { section: DailySection; days: DailyRow[]; weeks: DailyRow[]; total: DailyRow }) {
  const rows: { row: DailyRow; label: string; strong?: boolean; divider?: boolean }[] = [
    ...days.map((d) => ({ row: d, label: d.label })),
    { row: total, label: "Total", strong: true },
    ...weeks.map((w, i) => ({ row: w, label: w.label, divider: i === 0 })),
    { row: total, label: "Monthly", strong: true },
  ];
  return (
    <Table head={["Date", ...section.columns.map((c) => <Head key={c.key}>{c.label}</Head>)]}>
      {rows.map(({ row, label, strong, divider }, i) => (
        <tr key={`${label}-${i}`} className={clsx(row.future && "text-slate-300", strong && "bg-slate-50 font-semibold", divider && "border-t-2 border-slate-300")}>
          <Td className="whitespace-nowrap font-medium">{label}</Td>
          {section.columns.map((c) => (
            <Td key={c.key} className={c.kind === "flags" || c.kind === "postings" ? undefined : "text-right"}>
              {!row.future && <Cell c={c} row={row} />}
            </Td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

function KpiTable({ section, kpis }: { section: DailySection; kpis: { label: string; values: Record<string, number | null> }[] }) {
  const fmt = (k: DailyKpi, v: number | null | undefined) => (v === null || v === undefined ? "" : "num" in k && k.unit === "pct" ? `${v}%` : String(v));
  return (
    <Table head={["KPI", ...section.kpis.map((k) => <Head key={k.key}>{k.label}</Head>)]}>
      {kpis.map((r) => (
        <tr key={r.label} className={clsx(r.label === "Monthly" && "bg-slate-50 font-semibold")}>
          <Td className="whitespace-nowrap font-medium">{r.label}</Td>
          {section.kpis.map((k) => (
            <Td key={k.key} className="text-right tabular-nums">{fmt(k, r.values[k.key])}</Td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

export default async function DailyDashboardPage({ searchParams }: { searchParams: Promise<{ sheet?: string; month?: string; user?: string }> }) {
  const sp = await searchParams;
  const d = await api("GET /v1/kpi/daily", { query: { sheet: sp.sheet, month: sp.month, user: sp.user } });
  const layout = DAILY_LAYOUT[d.sheet];
  const combined = !!DAILY_COMBINED[d.sheet];
  const who = d.subject?.name ?? (combined ? "Consolidated (Team 3a + 3b)" : "Consolidated (whole team)");
  const user = d.subject?.id ?? "team";
  const qs = (over: Record<string, string>) => `/kpi/daily?${new URLSearchParams({ sheet: d.sheet, month: d.month, ...(d.seesAll ? { user } : {}), ...over })}`;

  return (
    <>
      <PageHeader
        title={layout.title}
        subtitle={`${who} · ${monthLabel(d.month)} · the monthly dash board workbook, computed live from CRM activity (nothing to type in)`}
        actions={
          <>
            <LinkButton href="/kpi">← KPI analysis</LinkButton>
            {d.canExport && <LinkButton variant="primary" href={`/api/v1/kpi/daily/export?sheet=${d.sheet}&month=${d.month}`}>Download Excel (all tabs)</LinkButton>}
          </>
        }
      />

      <Card className="mb-6">
        <form action="/kpi/daily" className="flex flex-wrap items-end gap-3">
          {d.sheets.length > 1 && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Team</span>
              <Select name="sheet" defaultValue={d.sheet} options={d.sheets.map((s) => ({ value: s, label: SHEET_LABEL[s] }))} className="w-auto" />
            </label>
          )}
          {d.seesAll && !combined && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Person</span>
              <Select name="user" defaultValue={user} options={[{ value: "team", label: "Consolidated (whole team)" }, ...d.members.map((m) => ({ value: m.id, label: m.name }))]} className="w-auto" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Month</span>
            <Input type="month" name="month" defaultValue={d.month} className="w-auto" />
          </label>
          <Button type="submit" variant="secondary">Show</Button>
          <div className="flex gap-2 sm:ml-auto">
            <LinkButton size="sm" href={qs({ month: d.prevMonth })}>← {monthLabel(d.prevMonth)}</LinkButton>
            <LinkButton size="sm" href={qs({ month: d.nextMonth })}>{monthLabel(d.nextMonth)} →</LinkButton>
          </div>
        </form>
      </Card>

      <div className="grid gap-6">
        {layout.sections.map((s) => (
          <div key={s.key} className="grid gap-4">
            <Card title={s.title} pad={false}>
              <SectionTable section={s} days={d.days} weeks={d.weeks} total={d.total} />
            </Card>
            <Card title={`${s.title} — KPI`} pad={false}>
              <KpiTable section={s} kpis={d.kpis} />
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}
