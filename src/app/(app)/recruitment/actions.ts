"use server";

import { revalidatePath } from "next/cache";
import type { InterviewMode } from "@contracts";
import { requireActor } from "@/lib/session";
import { run, str, num, type ActionState } from "@/lib/action";
import { fromIstInputValue } from "@contracts/shared/dates";
import { now } from "@/lib/clock";
import { ValidationError } from "@/lib/errors";
import {
  completeFormalities,
  confirmJoiningDate,
  declineOffer,
  recordInterviewOutcome,
  recordJoining,
  recordRetentionCheck,
  rescheduleInterview,
  scheduleInterview,
  sendOffer,
} from "@/server/interviews/service";

const MODES: InterviewMode[] = ["IN_PERSON", "VIDEO", "PHONE"];

function dateField(fd: FormData, k: string, label: string, required = true): Date | null {
  const raw = str(fd, k);
  if (!raw) {
    if (required) throw new ValidationError(`${label} is required`);
    return null;
  }
  const d = fromIstInputValue(raw);
  if (!d) throw new ValidationError(`${label} is not a valid date`);
  return d;
}

const done = (msg: string) => {
  revalidatePath("/recruitment");
  revalidatePath("/vacancies", "layout");
  return msg;
};

export async function scheduleInterviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const submissionId = str(fd, "submissionId");
    if (!submissionId) throw new ValidationError("Choose the vacancy / submission");
    const mode = (str(fd, "mode") as InterviewMode | undefined) ?? "IN_PERSON";
    if (!MODES.includes(mode)) throw new ValidationError("Unknown interview mode");
    await scheduleInterview(actor, submissionId, { scheduledAt: dateField(fd, "scheduledAt", "Interview date & time")!, mode, notes: str(fd, "notes") });
    return done("Interview scheduled and communicated — reminders at T-24h and T-2h are queued");
  });
}

export async function rescheduleInterviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const at = dateField(fd, "scheduledAt", "New date & time")!;
    if (at.getTime() <= now().getTime()) throw new ValidationError("New interview time must be in the future");
    await rescheduleInterview(actor, String(fd.get("interviewId")), at);
    return done("Interview rescheduled — reminders re-queued");
  });
}

export async function interviewOutcomeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const outcome = str(fd, "outcome");
    const map = {
      SELECTED: { status: "ATTENDED", result: "SELECTED" },
      REJECTED: { status: "ATTENDED", result: "REJECTED" },
      NO_SHOW: { status: "NO_SHOW" },
      CANCELLED: { status: "CANCELLED" },
    } as const;
    if (!outcome || !(outcome in map)) throw new ValidationError("Choose an outcome");
    const input = map[outcome as keyof typeof map];
    await recordInterviewOutcome(actor, String(fd.get("interviewId")), { ...input, notes: str(fd, "notes") });
    return done(
      outcome === "SELECTED" ? "Selected — lead moved to Selected" : outcome === "CANCELLED" ? "Interview cancelled" : "Outcome recorded (the lead is dropped if it has no other live submissions)",
    );
  });
}

export async function sendOfferAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const submissionId = str(fd, "submissionId");
    if (!submissionId) throw new ValidationError("Choose the submission");
    await sendOffer(actor, submissionId, { ctcLakhs: num(fd, "ctcLakhs") ?? null, joiningDate: dateField(fd, "joiningDate", "Tentative joining date", false) });
    return done("Offer sent — follow-up task created");
  });
}

export async function confirmJoiningDateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    await confirmJoiningDate(actor, String(fd.get("offerId")), dateField(fd, "joiningDate", "Joining date")!);
    return done("Offer accepted — joining date confirmed");
  });
}

export async function declineOfferAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    await declineOffer(actor, String(fd.get("offerId")), str(fd, "note"));
    return done("Offer declined — lead dropped");
  });
}

export async function recordJoiningAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    await recordJoining(actor, String(fd.get("offerId")), dateField(fd, "joinedAt", "Joining date")!);
    return done("Joined — day-7 and day-30 retention checks scheduled");
  });
}

export async function completeFormalitiesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    await completeFormalities(actor, String(fd.get("joiningId")));
    return done("Joining formalities marked complete");
  });
}

export async function retentionCheckAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const day = Number(fd.get("day"));
    if (day !== 7 && day !== 30) throw new ValidationError("Unknown checkpoint");
    const retained = str(fd, "retained");
    if (retained !== "yes" && retained !== "no") throw new ValidationError("Choose retained or left");
    const reason = str(fd, "reason");
    if (retained === "no" && !reason) throw new ValidationError("Give a reason for leaving");
    await recordRetentionCheck(actor, String(fd.get("joiningId")), day, retained === "yes", reason);
    return done(retained === "no" ? "Recorded — lead dropped (left before 30 days)" : day === 30 ? "Retained 30 days — lead is Successful" : "Day-7 retention recorded");
  });
}
