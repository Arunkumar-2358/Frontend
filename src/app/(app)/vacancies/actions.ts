"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ClientOrgType, MainCategory } from "@contracts";
import { prisma } from "@/lib/db";
import { now } from "@/lib/clock";
import { audit } from "@/lib/audit";
import { requireActor } from "@/lib/session";
import { run, str, num, ids, type ActionState } from "@/lib/action";
import { fromIstInputValue } from "@contracts/shared/dates";
import { ValidationError } from "@/lib/errors";
import { hasRole, ForbiddenError } from "@/lib/rbac";
import { MAIN_CATEGORIES } from "@contracts/shared/fields";
import { calibrateVacancy, createVacancy, decideSubmission, inviteToApply, setVacancyStatus, submitCandidate, ROUTING } from "@/server/vacancies/service";
import { errText, TEAM_LABEL } from "./util";

const ORG_TYPES: ClientOrgType[] = ["GENERAL", "EXISTING", "FREE_TRIAL"];

export async function createClientOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    if (!hasRole(actor, "admin", "sourcer", "team2_leader", "recruiter", "team3_leader")) throw new ForbiddenError("Only Teams 2/3 can add client organisations");
    const name = str(fd, "name");
    const type = str(fd, "type") as ClientOrgType | undefined;
    if (!name) throw new ValidationError("Organisation name is required");
    if (!type || !ORG_TYPES.includes(type)) throw new ValidationError("Choose an organisation type");
    if (await prisma.clientOrg.findUnique({ where: { name } })) throw new ValidationError(`"${name}" already exists`);
    const org = await prisma.clientOrg.create({ data: { name, type, city: str(fd, "city"), createdAt: now() } });
    await audit(actor, "CREATE", "client_org", org.id, { name, type });
    revalidatePath("/vacancies/new");
    return `Added ${name} — vacancies will route to Team ${TEAM_LABEL[ROUTING[type]]}`;
  });
}

export async function createVacancyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const clientOrgId = str(fd, "clientOrgId");
    const title = str(fd, "title");
    const category = str(fd, "category") as MainCategory | undefined;
    const location = str(fd, "location");
    if (!clientOrgId) throw new ValidationError("Choose a client organisation");
    if (!title) throw new ValidationError("Title is required");
    if (!category || !(MAIN_CATEGORIES as readonly string[]).includes(category)) throw new ValidationError("Choose a category");
    if (!location) throw new ValidationError("Location is required");
    const ctcMin = num(fd, "ctcMinLakhs");
    const ctcMax = num(fd, "ctcMaxLakhs");
    if (ctcMin !== undefined && ctcMax !== undefined && ctcMin > ctcMax) throw new ValidationError("CTC minimum is above the maximum");
    const postedRaw = str(fd, "postedAt");
    const postedAt = postedRaw ? fromIstInputValue(postedRaw) : null;
    if (postedRaw && !postedAt) throw new ValidationError("Posted at is not a valid date/time");
    const v = await createVacancy(actor, {
      clientOrgId,
      title,
      category,
      specialty: str(fd, "specialty") ?? null,
      location,
      minExperienceYears: num(fd, "minExperienceYears") ?? null,
      ctcMinLakhs: ctcMin ?? null,
      ctcMaxLakhs: ctcMax ?? null,
      maxNoticeDays: num(fd, "maxNoticeDays") ?? null,
      openings: Math.max(1, Math.round(num(fd, "openings") ?? 1)),
      postedAt: postedAt ?? undefined,
    });
    revalidatePath("/vacancies");
    redirect(`/vacancies/${v.id}`);
  });
}

export async function calibrateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    if (!hasRole(actor, "admin", "sourcer", "team2_leader", "recruiter", "team3_leader")) throw new ForbiddenError();
    const id = String(fd.get("vacancyId"));
    await calibrateVacancy(actor, id);
    revalidatePath(`/vacancies/${id}`);
    return "Vacancy calibrated";
  });
}

export async function setStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    if (!hasRole(actor, "admin", "sourcer", "team2_leader", "recruiter", "team3_leader")) throw new ForbiddenError();
    const id = String(fd.get("vacancyId"));
    const status = str(fd, "status");
    if (status !== "OPEN" && status !== "PENDING" && status !== "CLOSED") throw new ValidationError("Choose a status");
    await setVacancyStatus(actor, id, status);
    revalidatePath(`/vacancies/${id}`);
    revalidatePath("/vacancies");
    return `Status set to ${status.toLowerCase()}`;
  });
}

/** Bulk actions on the matching list: submit CVs or invite to apply. */
export async function bulkMatchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const vacancyId = String(fd.get("vacancyId"));
    const selected = ids(fd, "candidateId");
    if (!selected.length) throw new ValidationError("Select at least one candidate");
    const intent = str(fd, "intent");
    const labelOf = (id: string) => str(fd, `label_${id}`) ?? id;

    if (intent === "invite") {
      const channel = str(fd, "channel");
      if (channel !== "WHATSAPP" && channel !== "SMS" && channel !== "EMAIL") throw new ValidationError("Choose a channel");
      const res = await inviteToApply(actor, vacancyId, selected, channel);
      revalidatePath(`/vacancies/${vacancyId}`);
      if (res.errors.length) throw new ValidationError(`${res.sent} invite(s) sent; ${res.errors.length} failed: ${res.errors.map((e) => e.replace(/^\w*Error: /, "")).join("; ")}`);
      return `${res.sent} invite(s) sent by ${channel.toLowerCase()}`;
    }

    let ok = 0;
    const failures: string[] = [];
    for (const id of selected) {
      try {
        await submitCandidate(actor, vacancyId, id, num(fd, `score_${id}`) ?? null);
        ok++;
      } catch (e) {
        failures.push(`${labelOf(id)}: ${errText(e)}`);
      }
    }
    revalidatePath(`/vacancies/${vacancyId}`);
    revalidatePath("/vacancies");
    revalidatePath("/recruitment");
    if (failures.length) throw new ValidationError(`${ok} CV(s) submitted; ${failures.length} failed — ${failures.join(" | ")}`);
    return `${ok} CV(s) submitted to the recruiter`;
  });
}

export async function decideSubmissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const decision = str(fd, "decision");
    if (decision !== "SHORTLISTED" && decision !== "REJECTED") throw new ValidationError("Choose a decision");
    await decideSubmission(actor, String(fd.get("submissionId")), decision);
    revalidatePath(`/vacancies/${String(fd.get("vacancyId"))}`);
    return decision === "SHORTLISTED" ? "Shortlisted" : "Rejected";
  });
}
