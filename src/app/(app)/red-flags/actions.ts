"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

export async function raiseRedFlagAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/red-flags", {
      body: {
        teamCode: str(fd, "teamCode"),
        description: str(fd, "description"),
        agentId: str(fd, "agentId"),
        kpiKey: str(fd, "kpiKey"),
        kpiOther: str(fd, "kpiOther"),
        targetStandard: str(fd, "targetStandard"),
        actual: str(fd, "actual"),
        dueDate: str(fd, "dueDate"),
      },
    });
    revalidatePath("/red-flags");
    revalidatePath("/dashboard");
    return message;
  });
}

export async function suggestCapaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = String(fd.get("id"));
    const { message } = await api("POST /v1/red-flags/{id}/capa", {
      params: { id },
      body: {
        capaSuggested: str(fd, "capaSuggested"),
        expectedOutcome: str(fd, "expectedOutcome"),
        dueDate: str(fd, "dueDate"),
        actionOwnerId: str(fd, "actionOwnerId"),
      },
    });
    revalidatePath(`/red-flags/${id}`);
    revalidatePath("/red-flags");
    return message;
  });
}

export async function implementCapaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = String(fd.get("id"));
    const { message } = await api("POST /v1/red-flags/{id}/implement", {
      params: { id },
      body: { correctiveActionImplemented: str(fd, "correctiveActionImplemented"), achievedOutcome: str(fd, "achievedOutcome") },
    });
    revalidatePath(`/red-flags/${id}`);
    revalidatePath("/red-flags");
    return message;
  });
}

export async function verifyAndCloseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = String(fd.get("id"));
    const { message } = await api("POST /v1/red-flags/{id}/close", { params: { id }, body: { achievedOutcome: str(fd, "achievedOutcome") } });
    revalidatePath(`/red-flags/${id}`);
    revalidatePath("/red-flags");
    revalidatePath("/dashboard");
    return message;
  });
}
