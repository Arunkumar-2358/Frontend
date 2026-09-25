"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, num, FormError, type ActionState } from "@/lib/action";
import { fromIstInputValue } from "@contracts/shared/dates";

function dateField(fd: FormData, k: string, label: string, required = true): Date | null {
  const raw = str(fd, k);
  if (!raw) {
    if (required) throw new FormError(`${label} is required`);
    return null;
  }
  const d = fromIstInputValue(raw);
  if (!d) throw new FormError(`${label} is not a valid date`);
  return d;
}

const done = (msg: string) => {
  revalidatePath("/recruitment");
  revalidatePath("/vacancies", "layout");
  return msg;
};

export async function scheduleInterviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const submissionId = str(fd, "submissionId");
    if (!submissionId) throw new FormError("Choose the vacancy / submission");
    const { message } = await api("POST /v1/recruitment/interviews", {
      body: { submissionId, mode: str(fd, "mode"), scheduledAt: dateField(fd, "scheduledAt", "Interview date & time")!, notes: str(fd, "notes") },
    });
    return done(message);
  });
}

export async function rescheduleInterviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const at = dateField(fd, "scheduledAt", "New date & time")!;
    const { message } = await api("POST /v1/recruitment/interviews/{id}/reschedule", { params: { id: String(fd.get("interviewId")) }, body: { scheduledAt: at } });
    return done(message);
  });
}

export async function interviewOutcomeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/recruitment/interviews/{id}/outcome", { params: { id: String(fd.get("interviewId")) }, body: { outcome: str(fd, "outcome"), notes: str(fd, "notes") } });
    return done(message);
  });
}

export async function sendOfferAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const submissionId = str(fd, "submissionId");
    if (!submissionId) throw new FormError("Choose the submission");
    const { message } = await api("POST /v1/recruitment/offers", {
      body: { submissionId, ctcLakhs: num(fd, "ctcLakhs") ?? null, joiningDate: dateField(fd, "joiningDate", "Tentative joining date", false) },
    });
    return done(message);
  });
}

export async function confirmJoiningDateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/recruitment/offers/{id}/confirm", { params: { id: String(fd.get("offerId")) }, body: { joiningDate: dateField(fd, "joiningDate", "Joining date")! } });
    return done(message);
  });
}

export async function declineOfferAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/recruitment/offers/{id}/decline", { params: { id: String(fd.get("offerId")) }, body: { note: str(fd, "note") } });
    return done(message);
  });
}

export async function recordJoiningAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/recruitment/offers/{id}/join", { params: { id: String(fd.get("offerId")) }, body: { joinedAt: dateField(fd, "joinedAt", "Joining date")! } });
    return done(message);
  });
}

export async function completeFormalitiesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/recruitment/joinings/{id}/formalities", { params: { id: String(fd.get("joiningId")) } });
    return done(message);
  });
}

export async function retentionCheckAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/recruitment/joinings/{id}/retention", {
      params: { id: String(fd.get("joiningId")) },
      body: { day: Number(fd.get("day")), retained: str(fd, "retained"), reason: str(fd, "reason") },
    });
    return done(message);
  });
}
