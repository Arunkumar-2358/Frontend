"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { LeadSource, MainCategory } from "@contracts";
import { requireActor } from "@/lib/session";
import { run, str, bool, type ActionState } from "@/lib/action";
import { GateError, ValidationError } from "@/lib/errors";
import { SYSTEM, isStageLeader, leadScope } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { createCandidate } from "@/server/candidates/service";
import { LEAD_SOURCES, MAIN_CATEGORIES } from "@contracts/shared/fields";
import { transitionLead } from "@/server/lifecycle/transition";

export async function createLeadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  // redirect() inside run() is re-thrown by unstable_rethrow, so navigation works.
  return run(async () => {
    const actor = await requireActor();
    const name = str(fd, "name");
    const mobile = str(fd, "mobile");
    if (!name) throw new ValidationError("Name is required");
    if (!mobile) throw new ValidationError("Mobile is required");
    const category = str(fd, "mainCategory");
    const source = str(fd, "source") ?? "OTHER";
    if (category && !(MAIN_CATEGORIES as readonly string[]).includes(category)) throw new ValidationError("Unknown category");
    if (!(LEAD_SOURCES as readonly string[]).includes(source)) throw new ValidationError("Unknown source");

    const created = await createCandidate(
      actor,
      {
        name,
        mobile,
        email: str(fd, "email") ?? null,
        mainCategory: (category as MainCategory | undefined) ?? null,
        jobTitle: str(fd, "jobTitle") ?? null,
        primarySpecialty: str(fd, "primarySpecialty") ?? null,
        currentLocation: str(fd, "currentLocation") ?? null,
        source: source as LeadSource,
        consentRecordStoreShare: bool(fd, "consent"),
      },
      { ownerUserId: actor.id },
    );

    // Manual entry has already been de-duplicated by createCandidate; try to pass the Mapping gate.
    let gate = "";
    try {
      await transitionLead(isStageLeader(actor, "MAPPING") ? actor : SYSTEM("manual-entry"), created.id, "VALIDATED", { note: "Manual entry", source: "manual-entry" });
    } catch (e) {
      if (!(e instanceof GateError)) throw e;
      gate = e.failures.join("; ");
    }
    revalidatePath("/leads");
    // Routing may hand the lead to another team's agent; if the creator can no longer see it, go back to the list.
    const visible = await prisma.candidate.count({ where: { AND: [{ id: created.id }, leadScope(actor)] } });
    if (!visible) redirect(`/leads?q=${encodeURIComponent(created.candidateCode)}`);
    redirect(`/leads/${created.id}?created=1${gate ? `&gate=${encodeURIComponent(gate)}` : ""}`);
  });
}
