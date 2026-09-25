"use server";

import { revalidatePath } from "next/cache";
import type { MainCategory } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { run, str, bool, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { fromIstInputValue } from "@contracts/shared/dates";
import { now } from "@/lib/clock";
import { assert, hasRole } from "@/lib/rbac";
import { MAIN_CATEGORIES } from "@contracts/shared/fields";
import { logMissedCall, recordRecall } from "@/server/outreach/service";

const ROLES = ["telecaller", "team1_leader", "admin"] as const;

export async function logMissedCallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    assert(hasRole(actor, ...ROLES), "Only Team 1b can log missed calls");
    const mobile = str(fd, "mobile");
    if (!mobile) throw new ValidationError("Enter the caller's number");
    const rawAt = str(fd, "receivedAt");
    const receivedAt = rawAt ? fromIstInputValue(rawAt) : null;
    if (rawAt && !receivedAt) throw new ValidationError("Invalid received time");
    if (receivedAt && receivedAt.getTime() > now().getTime() + 5 * 60_000) throw new ValidationError("Received time is in the future");
    await logMissedCall(actor, { mobile, receivedAt: receivedAt ?? undefined, notes: str(fd, "notes") });
    revalidatePath("/missed-calls");
    revalidatePath("/tasks");
    return "Missed call logged — recall task created";
  });
}

export async function recallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    assert(hasRole(actor, ...ROLES), "Only Team 1b can record recalls");
    const id = str(fd, "missedCallId");
    if (!id) throw new ValidationError("Missing missed call");
    const mc = await prisma.missedCall.findUnique({ where: { id } });
    if (!mc) throw new ValidationError("Missed call not found");
    assert(mc.assignedToId === actor.id || mc.assignedToId === null || hasRole(actor, "team1_leader", "admin"), "This missed call is assigned to another tele-caller");
    if (mc.closedAt) throw new ValidationError("This missed call is already closed");

    const answered = bool(fd, "answered");
    const linkSent = bool(fd, "linkSent");
    const enrolled = bool(fd, "enrolled");
    if (enrolled && !answered && !linkSent) throw new ValidationError("Tick 'Answered' or 'Link sent' before marking the caller enrolled");

    const name = str(fd, "name");
    const category = str(fd, "mainCategory") as MainCategory | undefined;
    if (category && !(MAIN_CATEGORIES as readonly string[]).includes(category)) throw new ValidationError("Invalid category");
    const newLead = !mc.candidateId && name ? { name, mainCategory: category, currentLocation: str(fd, "currentLocation"), jobTitle: str(fd, "jobTitle") } : undefined;
    if (newLead && !answered) throw new ValidationError("A new lead can only be created when the caller answered");
    if (!mc.candidateId && enrolled && !newLead) throw new ValidationError("Unknown caller — add their name and category to create a lead before marking enrolled");

    const res = await recordRecall(actor, id, { answered, linkSent, enrolled, notes: str(fd, "notes"), newLead });
    revalidatePath("/missed-calls");
    revalidatePath("/queue");
    revalidatePath("/tasks");
    const parts = [answered ? "answered" : "not answered — another recall is scheduled in 2 hours"];
    if (linkSent) parts.push("link sent");
    if (enrolled) parts.push("enrolled");
    if (newLead && res.candidateId) {
      const lead = await prisma.candidate.findUnique({ where: { id: res.candidateId }, select: { candidateCode: true, stage: true } });
      if (lead) parts.push(lead.stage === "MAPPING" ? `lead ${lead.candidateCode} created (in Mapping — needs category / job title / location)` : `lead ${lead.candidateCode} created`);
    }
    return `Recall saved: ${parts.join(", ")}${res.closedAt ? " · closed" : ""}`;
  });
}
