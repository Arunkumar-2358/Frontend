"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, type ActionState } from "@/lib/action";

export async function runDueJobsAction(): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/jobs/run");
    revalidatePath("/admin/jobs");
    return message;
  });
}

export async function freezeKpisAction(): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/kpi/freeze");
    revalidatePath("/admin/jobs");
    revalidatePath("/kpi");
    return message;
  });
}
