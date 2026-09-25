"use server";

import { revalidatePath } from "next/cache";
import type { Channel, ContactOutcome, LeadSource, MainCategory } from "@contracts";
import { requireActor } from "@/lib/session";
import { run, str, bool, ids, type ActionState } from "@/lib/action";
import { GateError, ValidationError } from "@/lib/errors";
import { SYSTEM, assert, hasRole } from "@/lib/rbac";
import { STAGE_LABEL } from "@/server/lifecycle/rules";
import { transitionLead } from "@/server/lifecycle/transition";
import { createCandidate } from "@/server/candidates/service";
import { MAIN_CATEGORIES, NON_NT_SOURCES } from "@contracts/shared/fields";
import { OUTCOME_LABEL, allocateToTelecaller, logContact, sendEnrolmentLink } from "@/server/outreach/service";

const CHANNELS: Channel[] = ["CALL", "WHATSAPP", "SMS", "EMAIL"];
const LINK_CHANNELS = ["WHATSAPP", "SMS", "EMAIL"] as const;
const OUTCOMES: ContactOutcome[] = ["UNANSWERED", "INTERESTED_LINK_SENT_NOT_REGISTERED", "BUSY_RECALL_REQUESTED", "NOT_INTERESTED", "ENROLLED"];

function candidateIdOf(fd: FormData) {
  const id = str(fd, "candidateId");
  if (!id) throw new ValidationError("Missing lead");
  return id;
}

export async function logContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = candidateIdOf(fd);
    const channel = str(fd, "channel") as Channel;
    const outcome = str(fd, "outcome") as ContactOutcome;
    if (!CHANNELS.includes(channel)) throw new ValidationError("Choose a channel");
    if (!OUTCOMES.includes(outcome)) throw new ValidationError("Choose an outcome");
    const { transitioned } = await logContact(actor, id, {
      channel,
      outcome,
      notes: str(fd, "notes"),
      isFirstTimeVerifiedCall: channel === "CALL" && bool(fd, "firstCall"),
    });
    revalidatePath("/queue");
    revalidatePath("/tasks");
    const label = OUTCOME_LABEL[outcome];
    if (transitioned) return `${label} logged — lead moved to ${STAGE_LABEL[transitioned as keyof typeof STAGE_LABEL] ?? transitioned}`;
    return `${label} logged — next follow-up scheduled`;
  });
}

export async function sendLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = candidateIdOf(fd);
    const channel = str(fd, "channel") as (typeof LINK_CHANNELS)[number];
    if (!LINK_CHANNELS.includes(channel)) throw new ValidationError("Choose WhatsApp, SMS or email");
    const { transitioned } = await sendEnrolmentLink(actor, id, channel);
    revalidatePath("/queue");
    revalidatePath("/tasks");
    const via = channel === "WHATSAPP" ? "WhatsApp" : channel === "SMS" ? "SMS" : "email";
    return transitioned ? `Link sent by ${via} — lead moved to ${STAGE_LABEL[transitioned as keyof typeof STAGE_LABEL] ?? transitioned} (attempt cap reached)` : `Enrolment link sent by ${via} (logged as Bb)`;
  });
}

export async function allocateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    assert(hasRole(actor, "team1_leader", "admin"), "Only the Team 1 leader can allocate calls");
    const leadIds = ids(fd, "ids");
    const telecallerId = str(fd, "telecallerId");
    if (!leadIds.length) throw new ValidationError("Tick at least one lead to allocate");
    if (!telecallerId) throw new ValidationError("Choose a tele-caller");
    const n = await allocateToTelecaller(actor, leadIds, telecallerId);
    revalidatePath("/queue");
    return `${n} lead${n === 1 ? "" : "s"} allocated for first-time verified calls${n < leadIds.length ? ` (${leadIds.length - n} skipped — no longer Validated)` : ""}`;
  });
}

/** TA lead adds a proactive lead pulled from a non-NT portal (counts toward non-NT KPIs). */
export async function addPortalLeadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    assert(hasRole(actor, "ta_lead", "team1_leader", "admin"), "Only TA leads can add portal leads");
    const name = str(fd, "name");
    const mobile = str(fd, "mobile");
    const source = str(fd, "source") as LeadSource;
    const category = str(fd, "mainCategory") as MainCategory | undefined;
    if (!name) throw new ValidationError("Name is required");
    if (!mobile) throw new ValidationError("Mobile is required");
    if (!(NON_NT_SOURCES as readonly string[]).includes(source)) throw new ValidationError("Choose the portal (Naukri, LinkedIn, Indeed or other portal)");
    if (category && !(MAIN_CATEGORIES as readonly string[]).includes(category)) throw new ValidationError("Invalid category");
    const c = await createCandidate(
      actor,
      { name, mobile, source, mainCategory: category, currentLocation: str(fd, "currentLocation"), jobTitle: str(fd, "jobTitle") },
      { ownerUserId: actor.id },
    );
    revalidatePath("/queue");
    try {
      // The Mapping gate is still enforced. A system actor performs the move because the
      // Mapping stage belongs to Team 4 and a TA lead is not a member of it.
      await transitionLead(SYSTEM("portal-lead"), c.id, "VALIDATED", { note: `Proactive non-NT portal lead added by ${actor.name}`, source: "portal-lead" });
    } catch (e) {
      if (e instanceof GateError) return `Lead ${c.candidateCode} saved, but it went to Mapping for the data analyst — ${e.failures.join("; ")}`;
      throw e;
    }
    return `Lead ${c.candidateCode} added to your queue (Validated)`;
  });
}
