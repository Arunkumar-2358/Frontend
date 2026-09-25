"use server";

import { revalidatePath } from "next/cache";
import type { MainCategory, TeamCode } from "@contracts";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { bool, num, run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { adminActor } from "../guard";
import { CATEGORIES, TEAM_CODES } from "../users/options";

function ruleOf(fd: FormData) {
  const teamCode = str(fd, "teamCode") as TeamCode | undefined;
  const category = (str(fd, "category") as MainCategory | undefined) ?? null;
  const userId = str(fd, "userId");
  if (!teamCode || !TEAM_CODES.includes(teamCode)) throw new ValidationError("Choose a team");
  if (category && !CATEGORIES.includes(category)) throw new ValidationError("Unknown category");
  if (!userId) throw new ValidationError("Choose the user who receives the leads");
  return { teamCode, category, userId, priority: Math.round(num(fd, "priority") ?? 0), active: bool(fd, "active") };
}

export async function saveRuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = str(fd, "id");
    const data = ruleOf(fd);
    if (id) {
      const before = await prisma.assignmentRule.findUniqueOrThrow({ where: { id } });
      await prisma.assignmentRule.update({ where: { id }, data });
      await audit(actor, "SETTING_CHANGE", "assignment_rule", id, { from: before, to: data });
    } else {
      const r = await prisma.assignmentRule.create({ data });
      await audit(actor, "CREATE", "assignment_rule", r.id, data);
    }
    revalidatePath("/admin/rules");
    return id ? "Rule updated" : "Rule added";
  });
}

export async function deleteRuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = String(fd.get("id"));
    const before = await prisma.assignmentRule.findUniqueOrThrow({ where: { id } });
    await prisma.assignmentRule.delete({ where: { id } });
    await audit(actor, "SETTING_CHANGE", "assignment_rule", id, { action: "deleted", rule: before });
    revalidatePath("/admin/rules");
    return "Rule deleted";
  });
}
