"use server";

import { revalidatePath } from "next/cache";
import type { TeamCode } from "@contracts";
import { requireActor } from "@/lib/session";
import { run, str, type ActionState } from "@/lib/action";
import { fromIstInputValue } from "@contracts/shared/dates";
import { ValidationError } from "@/lib/errors";
import { KPI_BY_KEY } from "@/kpi/definitions";
import { implementCapa, raiseRedFlag, suggestCapa, verifyAndClose } from "@/server/redflags/service";

const TEAMS: TeamCode[] = ["T1A", "T1B", "T2", "T3A", "T3B", "T3C", "T4"];

/** A due date picked as a calendar day means "by the end of that IST day". */
const dateOf = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (!v) return null;
  const d = fromIstInputValue(v);
  if (!d) throw new ValidationError(`Invalid date "${v}"`);
  return new Date(d.getTime() + 86_400_000 - 60_000);
};

export async function raiseRedFlagAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const teamCode = str(fd, "teamCode") as TeamCode | undefined;
    if (!teamCode || !TEAMS.includes(teamCode)) throw new ValidationError("Choose a team");
    const description = str(fd, "description");
    if (!description) throw new ValidationError("Describe the deviation");
    const kpiKey = str(fd, "kpiKey");
    const def = kpiKey && kpiKey !== "__other" ? KPI_BY_KEY[kpiKey] : undefined;
    const f = await raiseRedFlag(actor, {
      teamCode,
      description,
      agentId: str(fd, "agentId") ?? null,
      kpiKey: def?.key ?? null,
      kpiDeviated: def?.label ?? str(fd, "kpiOther") ?? null,
      targetStandard: str(fd, "targetStandard") ?? null,
      actual: str(fd, "actual") ?? null,
      dueDate: dateOf(fd, "dueDate"),
    });
    revalidatePath("/red-flags");
    revalidatePath("/dashboard");
    return `Red flag raised (${f.teamCode})`;
  });
}

export async function suggestCapaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = String(fd.get("id"));
    const capaSuggested = str(fd, "capaSuggested");
    if (!capaSuggested) throw new ValidationError("Enter the suggested CAPA");
    await suggestCapa(actor, id, {
      capaSuggested,
      expectedOutcome: str(fd, "expectedOutcome"),
      dueDate: dateOf(fd, "dueDate"),
      actionOwnerId: str(fd, "actionOwnerId") ?? null,
    });
    revalidatePath(`/red-flags/${id}`);
    revalidatePath("/red-flags");
    return "CAPA suggested";
  });
}

export async function implementCapaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = String(fd.get("id"));
    const correctiveActionImplemented = str(fd, "correctiveActionImplemented");
    if (!correctiveActionImplemented) throw new ValidationError("Describe the corrective action implemented");
    await implementCapa(actor, id, { correctiveActionImplemented, achievedOutcome: str(fd, "achievedOutcome") });
    revalidatePath(`/red-flags/${id}`);
    revalidatePath("/red-flags");
    return "Corrective action recorded";
  });
}

export async function verifyAndCloseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    const id = String(fd.get("id"));
    const f = await verifyAndClose(actor, id, str(fd, "achievedOutcome"));
    revalidatePath(`/red-flags/${id}`);
    revalidatePath("/red-flags");
    revalidatePath("/dashboard");
    return f.closedWithin1WorkingDay ? "Closed within the SLA" : "Closed (beyond the SLA)";
  });
}
