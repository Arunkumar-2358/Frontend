"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { ids, run, type ActionState } from "@/lib/action";

export async function saveAttendanceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("PUT /v1/admin/attendance", { body: { users: ids(fd, "u"), days: ids(fd, "d"), present: ids(fd, "p") } });
    revalidatePath("/admin/attendance");
    return message;
  });
}
