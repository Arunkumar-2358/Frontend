"use server";

import { revalidatePath } from "next/cache";
import type { MainCategory, TeamCode } from "@contracts";
import { api } from "@/lib/api/client";
import { bool, num, run, str, type ActionState } from "@/lib/action";

export async function saveRuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/rules", {
      body: {
        id: str(fd, "id"),
        teamCode: str(fd, "teamCode") as TeamCode | undefined,
        category: str(fd, "category") as MainCategory | undefined,
        userId: str(fd, "userId"),
        priority: num(fd, "priority"),
        active: bool(fd, "active"),
      },
    });
    revalidatePath("/admin/rules");
    return message;
  });
}

export async function deleteRuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("DELETE /v1/admin/rules/{id}", { params: { id: String(fd.get("id")) } });
    revalidatePath("/admin/rules");
    return message;
  });
}
