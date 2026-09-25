"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, bool, type ActionState } from "@/lib/action";

export async function createLeadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  // redirect() inside run() is re-thrown by unstable_rethrow, so navigation works.
  return run(async () => {
    // The API validates the input, de-duplicates, creates the lead and tries to pass the Mapping gate.
    const created = await api("POST /v1/leads", {
      body: {
        name: str(fd, "name"),
        mobile: str(fd, "mobile"),
        email: str(fd, "email"),
        mainCategory: str(fd, "mainCategory"),
        jobTitle: str(fd, "jobTitle"),
        primarySpecialty: str(fd, "primarySpecialty"),
        currentLocation: str(fd, "currentLocation"),
        source: str(fd, "source"),
        consent: bool(fd, "consent"),
      },
    });
    const gate = created.gate ?? "";
    revalidatePath("/leads");
    // Routing may hand the lead to another team's agent; if the creator can no longer see it, go back to the list.
    if (!created.visible) redirect(`/leads?q=${encodeURIComponent(created.candidateCode)}`);
    redirect(`/leads/${created.id}?created=1${gate ? `&gate=${encodeURIComponent(gate)}` : ""}`);
  });
}
