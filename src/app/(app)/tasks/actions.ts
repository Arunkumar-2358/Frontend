"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

export async function completeTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/tasks/{id}/complete", { params: { id: String(fd.get("taskId")) }, body: { result: str(fd, "result") } });
    revalidatePath("/tasks");
    return message;
  });
}
