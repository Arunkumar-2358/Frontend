import type { PeriodType } from "@contracts";
import { KPI_BY_KEY, SHEETS, type KpiDef, type Sheet } from "@/kpi/definitions";
import { hasRole, leaderTeams, type Actor } from "@/lib/rbac";
import { addDays, fromIstInputValue, istDateKey, periodRange } from "@contracts/shared/dates";
import { now } from "@/lib/clock";

/** Headline metrics per sheet (dashboard mini summary). */
const HEADLINES: Record<Sheet, string[]> = {
  T1A: ["t1a.validated_assigned", "t1a.total_enrolled", "t1a.pct_enrolled_from_validated", "t1a.calls_attempted", "t1a.pct_screened"],
  T1B: ["t1b.ftc_attended", "t1b.ftc_enrolled", "t1b.ftc_attempted_over_allocated", "t1b.mc_recalls", "t1b.mc_recalls_over_missed"],
  T2: ["t2.scrutinised", "t2.qualified", "t2.pct_scrutiny", "t2.vacancies_5_nt", "t2.avg_tat_minutes"],
  T3A: ["t3a.in_hand", "t3a.interviews", "t3a.offers", "t3a.joinings", "t3a.rate_closures"],
  T3B: ["t3b.in_hand", "t3b.min2_cvs", "t3b.interviews", "t3b.joinings", "t3b.rate_closures"],
  T3C: ["t3c.new", "t3c.min2_cvs", "t3c.with_cvs", "t3c.pct_with_cvs"],
  T4_DA: ["t4da.import_rows", "t4da.import_duplicates", "t4da.import_accepted", "t4da.incomplete_enrolled"],
  T4_COORD: ["t4c.flags_t1", "t4c.flags_t2", "t4c.flags_t3", "t4c.closed_within_1wd", "t4c.still_open"],
};

/** Count metrics charted per agent (one unit per chart → one axis). */
const CHART: Record<Sheet, string[]> = {
  T1A: ["t1a.validated_assigned", "t1a.total_enrolled", "t1a.calls_attempted"],
  T1B: ["t1b.ftc_attended", "t1b.ftc_enrolled", "t1b.mc_recalls", "t1b.mc_enrolled"],
  T2: ["t2.enrolled_received", "t2.scrutinised", "t2.qualified"],
  T3A: ["t3a.interviews", "t3a.offers", "t3a.joinings", "t3a.closures"],
  T3B: ["t3b.interviews", "t3b.offers", "t3b.joinings", "t3b.closures"],
  T3C: ["t3c.new", "t3c.min2_cvs", "t3c.with_cvs"],
  T4_DA: ["t4da.import_rows", "t4da.import_duplicates", "t4da.import_accepted"],
  T4_COORD: ["t4c.flags_t1", "t4c.flags_t2", "t4c.flags_t3"],
};

const defs = (keys: string[]) => keys.map((k) => KPI_BY_KEY[k]).filter((d): d is KpiDef => !!d);
export const headlineMetrics = (s: Sheet) => defs(HEADLINES[s]);
export const chartMetrics = (s: Sheet) => defs(CHART[s]);

/** Leaders, coordinator, admin and data analyst see every sheet and every agent column. */
export function seesAllKpis(a: Actor) {
  return leaderTeams(a).length > 0 || hasRole(a, "admin", "ta_coordinator", "data_analyst");
}
export const canExportKpis = seesAllKpis;

export function visibleSheets(a: Actor) {
  if (seesAllKpis(a)) return SHEETS;
  if (a.kind !== "user") return [];
  return SHEETS.filter((s) => a.roles.some((r) => r.team === s.team && s.roles.includes(r.role)));
}

export function parsePeriod(sp: { period?: string; date?: string }) {
  const periodType: PeriodType = sp.period === "MONTH" ? "MONTH" : "WEEK";
  const anchor = (sp.date && fromIstInputValue(sp.date)) || now();
  const { start, end } = periodRange(periodType, anchor);
  return {
    periodType,
    anchor,
    start,
    end,
    lastDay: addDays(end, -1),
    prevDate: istDateKey(new Date(start.getTime() - 60_000)),
    nextDate: istDateKey(end),
    dateKey: istDateKey(anchor),
  };
}
