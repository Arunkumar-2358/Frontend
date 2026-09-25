"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { MainCategory, Role, TeamCode } from "@contracts";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { adminActor } from "../guard";
import { CATEGORIES, ROLES, TEAM_CODES } from "./options";

function grantOf(fd: FormData) {
  const team = str(fd, "team") as TeamCode | undefined;
  const role = str(fd, "role") as Role | undefined;
  const category = (str(fd, "category") as MainCategory | undefined) ?? null;
  if (!team || !TEAM_CODES.includes(team)) throw new ValidationError("Choose a team");
  if (!role || !ROLES.includes(role)) throw new ValidationError("Choose a role");
  if (category && !CATEGORIES.includes(category)) throw new ValidationError("Unknown category");
  return { team, role, category };
}

export async function createUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const name = str(fd, "name");
    const email = str(fd, "email")?.toLowerCase();
    const password = str(fd, "password");
    if (!name) throw new ValidationError("Name is required");
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("Enter a valid email");
    if (!password || password.length < 8) throw new ValidationError("Temporary password must be at least 8 characters");
    if (await prisma.user.findUnique({ where: { email } })) throw new ValidationError(`A user with ${email} already exists`);
    const grant = str(fd, "team") ? grantOf(fd) : null;
    const user = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10), phone: str(fd, "phone") ?? null } });
    if (grant) {
      const team = await prisma.team.findUniqueOrThrow({ where: { code: grant.team } });
      await prisma.userTeamRole.create({ data: { userId: user.id, teamId: team.id, role: grant.role, category: grant.category } });
    }
    await audit(actor, "CREATE", "user", user.id, { name, email, grant });
    revalidatePath("/admin/users");
    return `User ${name} created`;
  });
}

export async function addGrantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const userId = String(fd.get("userId"));
    const g = grantOf(fd);
    const team = await prisma.team.findUniqueOrThrow({ where: { code: g.team } });
    await prisma.userTeamRole.upsert({
      where: { userId_teamId_role: { userId, teamId: team.id, role: g.role } },
      create: { userId, teamId: team.id, role: g.role, category: g.category },
      update: { category: g.category },
    });
    await audit(actor, "SETTING_CHANGE", "user", userId, { action: "grant_added", ...g });
    revalidatePath("/admin/users");
    return "Grant saved — takes effect on the user's next request";
  });
}

export async function removeGrantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = String(fd.get("grantId"));
    const g = await prisma.userTeamRole.findUniqueOrThrow({ where: { id }, include: { team: true } });
    if (g.userId === actor.id && g.role === "admin") {
      const otherAdmins = await prisma.userTeamRole.count({ where: { role: "admin", userId: { not: actor.id }, user: { active: true } } });
      if (!otherAdmins) throw new ValidationError("You are the only active admin — add another admin first");
    }
    await prisma.userTeamRole.delete({ where: { id } });
    await audit(actor, "SETTING_CHANGE", "user", g.userId, { action: "grant_removed", team: g.team.code, role: g.role, category: g.category });
    revalidatePath("/admin/users");
    return "Grant removed";
  });
}

export async function setActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const userId = String(fd.get("userId"));
    const active = fd.get("active") === "true";
    if (userId === actor.id && !active) throw new ValidationError("You cannot deactivate yourself");
    await prisma.user.update({ where: { id: userId }, data: { active } });
    await audit(actor, "SETTING_CHANGE", "user", userId, { active: { from: !active, to: active } });
    revalidatePath("/admin/users");
    return active ? "User activated" : "User deactivated — they are signed out on their next request";
  });
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const userId = String(fd.get("userId"));
    const password = str(fd, "password");
    if (!password || password.length < 8) throw new ValidationError("Temporary password must be at least 8 characters");
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    await audit(actor, "SETTING_CHANGE", "user", userId, { action: "password_reset" });
    return "Temporary password set";
  });
}
