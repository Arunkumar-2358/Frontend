"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ids, run, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { adminActor } from "../guard";
import { utcDay } from "./days";

export async function saveAttendanceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const users = ids(fd, "u");
    const days = ids(fd, "d");
    if (!users.length || days.length !== 7) throw new ValidationError("Nothing to save");
    const present = new Set(ids(fd, "p"));
    let marked = 0;
    await prisma.$transaction(
      users.flatMap((userId) =>
        days.map((day) => {
          const isPresent = present.has(`${userId}|${day}`);
          if (isPresent) marked++;
          const date = utcDay(day);
          return prisma.attendance.upsert({
            where: { userId_date: { userId, date } },
            create: { userId, date, present: isPresent },
            update: { present: isPresent },
          });
        }),
      ),
    );
    await audit(actor, "SETTING_CHANGE", "attendance", days[0], { week: `${days[0]}..${days[6]}`, users: users.length, presentDays: marked });
    revalidatePath("/admin/attendance");
    return `Attendance saved (${marked} present day${marked === 1 ? "" : "s"})`;
  });
}
