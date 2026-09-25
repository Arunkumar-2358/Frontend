import type { Unit } from "@/kpi/definitions";

/** Ratio metrics are not targeted; everything else can be. */
export const TARGETABLE_UNITS: Unit[] = ["pct", "count", "minutes", "avg"];
