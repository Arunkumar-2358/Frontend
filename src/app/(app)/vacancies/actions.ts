"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/client";
import { run, str, num, ids, FormError, type ActionState } from "@/lib/action";
import { fromIstInputValue } from "@contracts/shared/dates";

export async function createClientOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/vacancies/client-orgs", { body: { name: str(fd, "name"), type: str(fd, "type"), city: str(fd, "city"), billingModel: str(fd, "billingModel") } });
    revalidatePath("/vacancies/new");
    return message;
  });
}

export async function setBillingModelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = str(fd, "clientOrgId");
    if (!id) throw new FormError("Choose a client organisation");
    const { message } = await api("POST /v1/vacancies/client-orgs/{id}/billing-model", { params: { id }, body: { billingModel: str(fd, "billingModel") ?? "" } });
    revalidatePath("/vacancies/new");
    return message;
  });
}

export async function createVacancyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const postedRaw = str(fd, "postedAt");
    const postedAt = postedRaw ? fromIstInputValue(postedRaw) : null;
    if (postedRaw && !postedAt) throw new FormError("Posted at is not a valid date/time");
    const v = await api("POST /v1/vacancies", {
      body: {
        clientOrgId: str(fd, "clientOrgId"),
        title: str(fd, "title"),
        category: str(fd, "category"),
        specialty: str(fd, "specialty"),
        location: str(fd, "location"),
        minExperienceYears: num(fd, "minExperienceYears"),
        ctcMinLakhs: num(fd, "ctcMinLakhs"),
        ctcMaxLakhs: num(fd, "ctcMaxLakhs"),
        maxNoticeDays: num(fd, "maxNoticeDays"),
        openings: num(fd, "openings"),
        postedAt: postedAt ?? undefined,
        description: str(fd, "description"),
        mandatoryAttributes: str(fd, "mandatoryAttributes"),
      },
    });
    revalidatePath("/vacancies");
    redirect(`/vacancies/${v.id}`);
  });
}

export async function calibrateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = String(fd.get("vacancyId"));
    const { message } = await api("POST /v1/vacancies/{id}/calibrate", { params: { id } });
    revalidatePath(`/vacancies/${id}`);
    return message;
  });
}

export async function setStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = String(fd.get("vacancyId"));
    const { message } = await api("POST /v1/vacancies/{id}/status", { params: { id }, body: { status: str(fd, "status") } });
    revalidatePath(`/vacancies/${id}`);
    revalidatePath("/vacancies");
    return message;
  });
}

/** Bulk actions on the matching list: submit CVs or invite to apply. */
export async function bulkMatchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const vacancyId = String(fd.get("vacancyId"));
    const selected = ids(fd, "candidateId");
    if (!selected.length) throw new FormError("Select at least one candidate");

    if (str(fd, "intent") === "invite") {
      try {
        const { message } = await api("POST /v1/vacancies/{id}/invites", { params: { id: vacancyId }, body: { candidateIds: selected, channel: str(fd, "channel") } });
        return message;
      } finally {
        revalidatePath(`/vacancies/${vacancyId}`);
      }
    }

    try {
      const { message } = await api("POST /v1/vacancies/{id}/submissions", {
        params: { id: vacancyId },
        body: { candidates: selected.map((id) => ({ id, matchScore: num(fd, `score_${id}`) ?? null })) },
      });
      return message;
    } finally {
      revalidatePath(`/vacancies/${vacancyId}`);
      revalidatePath("/vacancies");
      revalidatePath("/recruitment");
    }
  });
}

export async function decideSubmissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/vacancies/submissions/{id}/decision", { params: { id: String(fd.get("submissionId")) }, body: { decision: str(fd, "decision") } });
    revalidatePath(`/vacancies/${String(fd.get("vacancyId"))}`);
    return message;
  });
}
