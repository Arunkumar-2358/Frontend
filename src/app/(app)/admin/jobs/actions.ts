"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { run, type ActionState } from "@/lib/action";
import { ensureRecurringJobs, runDueJobs } from "@/server/jobs/runner";
import { freezeDuePeriods } from "@/kpi/snapshots";
import { adminActor } from "../guard";

export async function runDueJobsAction(): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    await ensureRecurringJobs();
    const results = await runDueJobs();
    const failed = results.filter((r) => r.result.startsWith("error")).length;
    await audit(actor, "JOB_RUN", "scheduled_job", "manual-run", { ran: results.length, failed });
    revalidatePath("/admin/jobs");
    return results.length ? `Ran ${results.length} job${results.length === 1 ? "" : "s"}${failed ? ` · ${failed} failed (see last error)` : ""}` : "No jobs were due";
  });
}

export async function freezeKpisAction(): Promise<ActionState> {
  return run(async () => {
    const actor = await adminActor();
    const summary = await freezeDuePeriods();
    await audit(actor, "JOB_RUN", "kpi_snapshot", "manual-freeze", { summary });
    revalidatePath("/admin/jobs");
    revalidatePath("/kpi");
    return `Freeze: ${summary}`;
  });
}
