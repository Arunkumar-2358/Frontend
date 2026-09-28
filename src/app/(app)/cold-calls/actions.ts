"use server";

import { revalidatePath } from "next/cache";
import type { ColdCallOutcome, MainCategory } from "@contracts";
import { api } from "@/lib/api/client";
import { FormError, ids, num, run, str, type ActionState } from "@/lib/action";

const OUTCOMES: ColdCallOutcome[] = ["UNANSWERED", "NOT_INTERESTED", "NEEDS_JOB"];

/** Team 2 leader: allocate the ticked cold leads, or the next N of a category, to a Team 2 member. */
export async function allocateColdCallsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const callerId = str(fd, "callerId");
    if (!callerId) throw new FormError("Choose who should call");
    const picked = ids(fd, "ids");
    const category = str(fd, "category") as MainCategory | "NONE" | undefined;
    if (!picked.length && !category) throw new FormError("Tick at least one lead");
    const count = num(fd, "count");
    const { message } = await api("POST /v1/cold-calls/allocate", { body: { callerId, ...(picked.length ? { ids: picked } : { category, ...(count ? { count: Math.round(count) } : {}) }) } });
    revalidatePath("/cold-calls");
    return message;
  });
}

export async function logColdCallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const outcome = str(fd, "outcome") as ColdCallOutcome | undefined;
    if (!outcome || !OUTCOMES.includes(outcome)) throw new FormError("Choose the call outcome");
    const { message } = await api("POST /v1/cold-calls/{id}/log", { params: { id: String(fd.get("candidateId")) }, body: { outcome, notes: str(fd, "notes") } });
    revalidatePath("/cold-calls");
    revalidatePath("/engagement");
    return message;
  });
}
