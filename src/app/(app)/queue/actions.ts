"use server";

import { revalidatePath } from "next/cache";
import type { Channel, ContactOutcome, LeadSource, MainCategory } from "@contracts";
import { api } from "@/lib/api/client";
import { run, str, bool, ids, FormError, type ActionState } from "@/lib/action";
import { MAIN_CATEGORIES, NON_NT_SOURCES } from "@contracts/shared/fields";

const CHANNELS = ["CALL", "WHATSAPP", "SMS", "EMAIL"] as const satisfies readonly Channel[];
const LINK_CHANNELS = ["WHATSAPP", "SMS", "EMAIL"] as const;
const OUTCOMES = ["UNANSWERED", "INTERESTED_LINK_SENT_NOT_REGISTERED", "BUSY_RECALL_REQUESTED", "NOT_INTERESTED", "ENROLLED"] as const satisfies readonly ContactOutcome[];

function candidateIdOf(fd: FormData) {
  const id = str(fd, "candidateId");
  if (!id) throw new FormError("Missing lead");
  return id;
}

export async function logContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = candidateIdOf(fd);
    const channel = str(fd, "channel") as (typeof CHANNELS)[number];
    const outcome = str(fd, "outcome") as (typeof OUTCOMES)[number];
    if (!CHANNELS.includes(channel)) throw new FormError("Choose a channel");
    if (!OUTCOMES.includes(outcome)) throw new FormError("Choose an outcome");
    const { message } = await api("POST /v1/queue/{id}/contact", { params: { id }, body: { channel, outcome, notes: str(fd, "notes"), firstCall: bool(fd, "firstCall") } });
    revalidatePath("/queue");
    revalidatePath("/tasks");
    return message;
  });
}

export async function sendLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = candidateIdOf(fd);
    const channel = str(fd, "channel") as (typeof LINK_CHANNELS)[number];
    if (!LINK_CHANNELS.includes(channel)) throw new FormError("Choose WhatsApp, SMS or email");
    const { message } = await api("POST /v1/queue/{id}/enrolment-link", { params: { id }, body: { channel } });
    revalidatePath("/queue");
    revalidatePath("/tasks");
    return message;
  });
}

export async function allocateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/queue/allocate", { body: { ids: ids(fd, "ids"), telecallerId: str(fd, "telecallerId") ?? "" } });
    revalidatePath("/queue");
    return message;
  });
}

/** TA lead adds a proactive lead pulled from a non-NT portal (counts toward non-NT KPIs). */
export async function addPortalLeadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const source = str(fd, "source") as LeadSource;
    const category = str(fd, "mainCategory") as MainCategory | undefined;
    if (!(NON_NT_SOURCES as readonly string[]).includes(source)) throw new FormError("Choose the portal (Naukri, LinkedIn, Indeed or other portal)");
    if (category && !(MAIN_CATEGORIES as readonly string[]).includes(category)) throw new FormError("Invalid category");
    const { message } = await api("POST /v1/queue/portal-leads", {
      body: { name: str(fd, "name") ?? "", mobile: str(fd, "mobile") ?? "", source, mainCategory: category, currentLocation: str(fd, "currentLocation"), jobTitle: str(fd, "jobTitle") },
    });
    revalidatePath("/queue");
    return message;
  });
}
