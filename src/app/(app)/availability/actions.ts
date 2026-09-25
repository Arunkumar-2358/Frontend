"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/session";
import { run, str, type ActionState } from "@/lib/action";
import { hasRole, ForbiddenError } from "@/lib/rbac";
import { recordAvailabilityCheck, setCold } from "@/server/scrutiny/service";

export async function availabilityCheckAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    if (!hasRole(actor, "sourcer", "team2_leader", "admin")) throw new ForbiddenError("Only Team 2 records availability check-ins");
    const available = fd.get("available") === "yes";
    await recordAvailabilityCheck(actor, String(fd.get("candidateId")), available, str(fd, "notes"));
    revalidatePath("/availability");
    return available ? "Availability confirmed — lead moved to Active" : "Recorded as not available — lead flagged cold; next check-in scheduled";
  });
}

export async function setColdAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const cold = fd.get("cold") === "true";
    await setCold(actor, String(fd.get("candidateId")), cold);
    revalidatePath("/availability");
    return cold ? "Flagged cold" : "Flagged warm";
  });
}
