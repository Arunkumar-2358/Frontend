import type { VacancyStatus } from "@contracts";
import type { Tone } from "@/components/ui";

export { TEAM_LABEL, ORG_TYPE_LABEL, BILLING_MODEL_LABEL, BILLING_MODELS } from "@contracts/shared/c-vacancy-labels";

/** Minutes as "95 min (1h 35m)". */
export function fmtMinutes(m: number | null | undefined): string {
  if (m === null || m === undefined) return "—";
  if (Math.abs(m) < 60) return `${m} min`;
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  const parts = [d ? `${d}d` : "", h ? `${h}h` : "", mm ? `${mm}m` : ""].filter(Boolean).join(" ");
  return `${m.toLocaleString("en-IN")} min (${parts})`;
}

export const STATUS_TONE: Record<VacancyStatus, Tone> = { OPEN: "green", PENDING: "amber", CLOSED: "slate" };
