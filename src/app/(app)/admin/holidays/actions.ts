"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

export async function addHolidayAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/holidays", { body: { date: str(fd, "date"), name: str(fd, "name") } });
    revalidatePath("/admin/holidays");
    return message;
  });
}

export async function removeHolidayAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("DELETE /v1/admin/holidays/{id}", { params: { id: String(fd.get("id")) } });
    revalidatePath("/admin/holidays");
    return message;
  });
}
