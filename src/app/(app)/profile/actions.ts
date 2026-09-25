"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { THEME_COOKIE } from "@/lib/theme";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { audit } from "@/lib/audit";
import { run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { validateMobile } from "@contracts/shared/phone";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const name = str(fd, "name");
    if (!name) throw new ValidationError("Name is required");
    const phoneRaw = str(fd, "phone");
    let phone: string | null = null;
    if (phoneRaw) {
      const m = validateMobile(phoneRaw);
      if (!m.ok) throw new ValidationError(m.reason);
      phone = m.mobile;
    }
    const before = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    await prisma.user.update({ where: { id: actor.id }, data: { name, phone } });
    await audit(actor, "FIELD_EDIT", "user", actor.id, { name: { from: before.name, to: name }, phone: { from: before.phone ? "•••" : null, to: phone ? "•••" : null } });
    revalidatePath("/", "layout");
    return "Profile updated";
  });
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new ValidationError("Current password is incorrect");
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) throw new ValidationError("New password must be at least 8 characters with letters and numbers");
    if (next !== confirm) throw new ValidationError("New passwords do not match");
    if (next === current) throw new ValidationError("New password must be different");
    await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    await audit(actor, "SETTING_CHANGE", "user", actor.id, { passwordChanged: true });
    return "Password changed";
  });
}

export async function setThemeAction(pref: string): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor();
  try {
    const { setThemePreference } = await import("@/server/users/preferences");
    const saved = await setThemePreference(actor, pref);
    (await cookies()).set(THEME_COOKIE, saved, { sameSite: "lax", path: "/", maxAge: 365 * 86400 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
