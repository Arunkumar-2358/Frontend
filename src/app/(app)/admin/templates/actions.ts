"use server";

import { revalidatePath } from "next/cache";
import type { Channel } from "@contracts";
import { api } from "@/lib/api/client";
import { bool, run, str, type ActionState } from "@/lib/action";

export async function saveTemplateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/admin/templates", {
      body: {
        id: str(fd, "id"),
        key: str(fd, "key"),
        name: str(fd, "name"),
        channel: str(fd, "channel") as Channel | undefined,
        subject: str(fd, "subject"),
        body: str(fd, "body"),
        active: bool(fd, "active"),
      },
    });
    revalidatePath("/admin/templates");
    return message;
  });
}
