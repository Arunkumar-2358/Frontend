"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

/** The candidate confirmed (on a call or by WhatsApp) that they need a job → super active. */
export async function jobIntentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/engagement/{id}/job-intent", { params: { id: String(fd.get("candidateId")) }, body: { notes: str(fd, "notes") } });
    revalidatePath("/engagement");
    return message;
  });
}

export async function reengageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/engagement/{id}/reengage", { params: { id: String(fd.get("candidateId")) } });
    revalidatePath("/engagement");
    return message;
  });
}
