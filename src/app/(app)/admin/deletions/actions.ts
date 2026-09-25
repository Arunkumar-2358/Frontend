"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

export async function processDeletionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/deletions/{id}/process", { params: { id: String(fd.get("id")) } });
    revalidatePath("/admin/deletions");
    return message;
  });
}

export async function rejectDeletionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/deletions/{id}/reject", { params: { id: String(fd.get("id")) }, body: { reason: str(fd, "reason") } });
    revalidatePath("/admin/deletions");
    return message;
  });
}
