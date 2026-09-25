"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { processDeletionRequest } from "@/server/candidates/service";
import { adminActor } from "../guard";

export async function processDeletionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = String(fd.get("id"));
    const req = await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { id } });
    if (req.status !== "REQUESTED") throw new ValidationError("This request has already been handled");
    await prisma.$transaction((tx) => processDeletionRequest(actor, id, tx));
    revalidatePath("/admin/deletions");
    return "Candidate anonymised";
  });
}

export async function rejectDeletionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const id = String(fd.get("id"));
    const req = await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { id } });
    if (req.status !== "REQUESTED") throw new ValidationError("This request has already been handled");
    const reason = str(fd, "reason");
    await prisma.dataDeletionRequest.update({ where: { id }, data: { status: "REJECTED", processedAt: now(), processedById: actor.id, ...(reason ? { reason: [req.reason, `Rejected: ${reason}`].filter(Boolean).join(" · ") } : {}) } });
    await audit(actor, "DATA_DELETION", "data_deletion_request", id, { action: "rejected", candidateId: req.candidateId, reason });
    revalidatePath("/admin/deletions");
    return "Request rejected";
  });
}
