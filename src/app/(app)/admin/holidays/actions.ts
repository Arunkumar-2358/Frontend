"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { adminActor } from "../guard";

/** Holiday dates are stored as UTC midnight of the IST calendar day. */
function dayOf(v: string | undefined) {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new ValidationError("Pick a date");
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export async function addHolidayAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const date = dayOf(str(fd, "date"));
    const name = str(fd, "name");
    if (!name) throw new ValidationError("Name the holiday");
    const h = await prisma.holiday.upsert({ where: { date }, create: { date, name }, update: { name } });
    await audit(actor, "SETTING_CHANGE", "holiday", h.id, { action: "added", date: str(fd, "date"), name });
    revalidatePath("/admin/holidays");
    return "Holiday saved";
  });
}

export async function removeHolidayAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = String(fd.get("id"));
    const h = await prisma.holiday.delete({ where: { id } });
    await audit(actor, "SETTING_CHANGE", "holiday", id, { action: "removed", date: h.date.toISOString().slice(0, 10), name: h.name });
    revalidatePath("/admin/holidays");
    return "Holiday removed";
  });
}
