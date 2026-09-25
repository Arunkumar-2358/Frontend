import type { ClientOrgType, TeamCode, VacancyStatus } from "@contracts";
import type { Tone } from "@/components/ui";
import { GateError } from "@/lib/errors";

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

export const TEAM_LABEL: Partial<Record<TeamCode, string>> = { T3A: "3a · General", T3B: "3b · Existing clients", T3C: "3c · Free trial" };
export const ORG_TYPE_LABEL: Record<ClientOrgType, string> = { GENERAL: "General", EXISTING: "Existing client", FREE_TRIAL: "Free trial" };

export function errText(e: unknown): string {
  if (e instanceof GateError) return `gate not met — ${e.failures.join("; ")}`;
  if (e instanceof Error) return e.message;
  return String(e).replace(/^\w*Error: /, "");
}

export const STATUS_TONE: Record<VacancyStatus, Tone> = { OPEN: "green", PENDING: "amber", CLOSED: "slate" };
