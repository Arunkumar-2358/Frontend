"use server";

import { revalidatePath } from "next/cache";
import type { PeriodType, TeamCode } from "@contracts";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { num, run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { KPI_BY_KEY, SHEETS } from "@/kpi/definitions";
import { adminActor } from "../guard";
import { TEAM_CODES } from "../users/options";
import { TARGETABLE_UNITS } from "./units";

export async function saveTargetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = str(fd, "id");
    const metricKey = str(fd, "metricKey");
    const def = metricKey ? KPI_BY_KEY[metricKey] : undefined;
    if (!metricKey || !def || !TARGETABLE_UNITS.includes(def.unit)) throw new ValidationError("Choose a metric");
    const teamCode = (str(fd, "teamCode") as TeamCode | undefined) ?? SHEETS.find((s) => s.sheet === def.sheet)!.team;
    if (!TEAM_CODES.includes(teamCode)) throw new ValidationError("Unknown team");
    const periodType = str(fd, "periodType") as PeriodType | undefined;
    if (periodType !== "WEEK" && periodType !== "MONTH") throw new ValidationError("Choose week or month");
    const target = num(fd, "target");
    if (target === undefined) throw new ValidationError("Enter a target value");
    const comparator = str(fd, "comparator") === "lte" ? "lte" : "gte";
    const data = { metricKey, teamCode, periodType, target, comparator };
    const clash = await prisma.kpiTarget.findUnique({ where: { metricKey_teamCode_periodType: { metricKey, teamCode, periodType } } });
    if (clash && clash.id !== id) {
      await prisma.kpiTarget.update({ where: { id: clash.id }, data });
      if (id) await prisma.kpiTarget.delete({ where: { id } });
    } else if (id) {
      await prisma.kpiTarget.update({ where: { id }, data });
    } else {
      await prisma.kpiTarget.create({ data });
    }
    await audit(actor, "SETTING_CHANGE", "kpi_target", `${metricKey}:${teamCode}:${periodType}`, { before: clash ?? null, after: data });
    revalidatePath("/admin/targets");
    return "Target saved";
  });
}

export async function deleteTargetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = String(fd.get("id"));
    const t = await prisma.kpiTarget.delete({ where: { id } });
    await audit(actor, "SETTING_CHANGE", "kpi_target", `${t.metricKey}:${t.teamCode}:${t.periodType}`, { action: "deleted", target: t });
    revalidatePath("/admin/targets");
    return "Target deleted";
  });
}
