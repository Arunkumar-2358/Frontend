"use server";

import { revalidatePath } from "next/cache";
import type { PeriodType, TeamCode } from "@contracts";
import { api } from "@/lib/api/client";
import { num, run, str, type ActionState } from "@/lib/action";

export async function saveTargetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/targets", {
      body: {
        id: str(fd, "id"),
        metricKey: str(fd, "metricKey"),
        teamCode: str(fd, "teamCode") as TeamCode | undefined,
        periodType: str(fd, "periodType") as PeriodType | undefined,
        target: num(fd, "target"),
        comparator: str(fd, "comparator"),
      },
    });
    revalidatePath("/admin/targets");
    return message;
  });
}

export async function deleteTargetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("DELETE /v1/admin/targets/{id}", { params: { id: String(fd.get("id")) } });
    revalidatePath("/admin/targets");
    return message;
  });
}
