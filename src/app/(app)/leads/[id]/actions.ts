"use server";

import { requestDataDeletion } from "@/server/candidates/service";

import { revalidatePath } from "next/cache";
import type { Channel, ContactDirection, ContactOutcome, DropReason, Stage } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { run, str, bool, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { fromIstInputValue } from "@contracts/shared/dates";
import { ForbiddenError, STAGE_OWNER_TEAMS, isAdmin, isStageLeader, leadScope, type Actor } from "@/lib/rbac";
import { decryptCandidate, reassignLead, updateCandidate } from "@/server/candidates/service";
import { transitionLead } from "@/server/lifecycle/transition";
import { STAGE_LABEL, allowedTargets } from "@/server/lifecycle/rules";
import { verifyAndQualify } from "@/server/scrutiny/service";
import { OUTCOME_LABEL, logContact, sendEnrolmentLink } from "@/server/outreach/service";
import { teamMembers } from "@/server/users/assignment";
import { profileInputFromForm } from "./profile-input";

const DROP_REASONS: DropReason[] = ["INTERVIEW_NO_SHOW", "REJECTED", "OFFER_DECLINED", "LEFT_BEFORE_30_DAYS", "NOT_JOINED", "OTHER"];
const CHANNELS: Channel[] = ["CALL", "WHATSAPP", "SMS", "EMAIL"];
const DIRECTIONS: ContactDirection[] = ["OUTBOUND", "INBOUND_MISSED", "RECALL"];

/** Load a lead the actor is allowed to see, or fail as if it did not exist. */
async function visibleLead(actor: Actor, id: string) {
  const lead = await prisma.candidate.findFirst({ where: { AND: [{ id }, leadScope(actor)] } });
  if (!lead) throw new ForbiddenError("Lead not found or not visible to you");
  return lead;
}

const leadId = (fd: FormData) => {
  const id = str(fd, "id");
  if (!id) throw new ValidationError("Missing lead id");
  return id;
};

export async function transitionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = leadId(fd);
    const lead = await visibleLead(actor, id);
    const to = str(fd, "to") as Stage | undefined;
    if (!to || !allowedTargets(lead.stage).includes(to)) throw new ValidationError("That stage change is not available from here");
    const note = str(fd, "note");
    const tlRemark = str(fd, "tlRemark");
    const dropReason = str(fd, "dropReason") as DropReason | undefined;
    if (dropReason && !DROP_REASONS.includes(dropReason)) throw new ValidationError("Unknown drop reason");
    if (lead.stage === "ENROLLED" && to === "QUALIFIED") {
      await verifyAndQualify(actor, id, tlRemark ?? note);
    } else {
      await transitionLead(actor, id, to, { note, tlRemark, dropReason });
    }
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return `Moved to ${STAGE_LABEL[to]}`;
  });
}

export async function saveProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = leadId(fd);
    const lead = await visibleLead(actor, id);
    const input = profileInputFromForm(fd, decryptCandidate(lead));
    await updateCandidate(actor, id, input);
    revalidatePath(`/leads/${id}`);
    return "Profile saved";
  });
}

export async function logContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = leadId(fd);
    await visibleLead(actor, id);
    const channel = str(fd, "channel") as Channel | undefined;
    const outcome = str(fd, "outcome") as ContactOutcome | undefined;
    const direction = (str(fd, "direction") as ContactDirection | undefined) ?? "OUTBOUND";
    if (!channel || !CHANNELS.includes(channel)) throw new ValidationError("Pick a channel");
    if (!outcome || !(outcome in OUTCOME_LABEL)) throw new ValidationError("Pick an outcome");
    if (!DIRECTIONS.includes(direction)) throw new ValidationError("Unknown direction");
    const next = str(fd, "nextFollowupAt");
    const nextFollowupAt = next ? fromIstInputValue(next) : null;
    if (next && !nextFollowupAt) throw new ValidationError("Invalid follow-up date");
    const { transitioned } = await logContact(actor, id, {
      channel,
      direction,
      outcome,
      notes: str(fd, "notes"),
      nextFollowupAt,
      isFirstTimeVerifiedCall: bool(fd, "firstTimeVerified"),
    });
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return transitioned ? `Contact logged — lead moved to ${STAGE_LABEL[transitioned as Stage]}` : "Contact logged";
  });
}

export async function sendLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = leadId(fd);
    await visibleLead(actor, id);
    const channel = str(fd, "channel");
    if (channel !== "WHATSAPP" && channel !== "SMS" && channel !== "EMAIL") throw new ValidationError("Pick WhatsApp, SMS or Email");
    await sendEnrolmentLink(actor, id, channel);
    revalidatePath(`/leads/${id}`);
    return `Enrolment link sent by ${channel === "WHATSAPP" ? "WhatsApp" : channel === "SMS" ? "SMS" : "email"}`;
  });
}

export async function reassignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = leadId(fd);
    const lead = await visibleLead(actor, id);
    if (!isStageLeader(actor, lead.stage)) throw new ForbiddenError("Only the team leader of this stage can reassign");
    const to = str(fd, "toUserId");
    if (!to) throw new ValidationError("Pick a team member");
    const members = await teamMembers(STAGE_OWNER_TEAMS[lead.stage]);
    const member = members.find((m) => m.id === to);
    if (!member) throw new ValidationError("That person is not in the team that owns this stage");
    if (to === lead.ownerUserId) return `${member.name} already owns this lead`;
    await reassignLead(actor, id, to);
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return `Reassigned to ${member.name}`;
  });
}

export async function deletionRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    if (!isAdmin(actor)) throw new ForbiddenError("Only an admin can record a data-deletion request");
    const id = leadId(fd);
    await visibleLead(actor, id);
    const open = await prisma.dataDeletionRequest.count({ where: { candidateId: id, status: "REQUESTED" } });
    if (open) throw new ValidationError("A deletion request for this candidate is already pending");
    await requestDataDeletion(actor, id, { requestedVia: str(fd, "requestedVia"), reason: str(fd, "reason") });
    revalidatePath(`/leads/${id}`);
    return "Deletion request recorded — process it from Administration";
  });
}
