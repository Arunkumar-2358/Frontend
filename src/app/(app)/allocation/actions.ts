"use server";

import { revalidatePath } from "next/cache";
import type { MainCategory } from "@contracts";
import { api } from "@/lib/api/client";
import { FormError, ids, run, str, type ActionState } from "@/lib/action";

/** Allocate every pending lead of a category, or the ticked leads, to a Team 2 sourcer. */
export async function allocateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const sourcerId = str(fd, "sourcerId");
    if (!sourcerId) throw new FormError("Choose a Team 2 sourcer");
    const picked = ids(fd, "ids");
    const category = str(fd, "category") as MainCategory | "NONE" | undefined;
    if (!picked.length && !category) throw new FormError("Tick at least one lead");
    const { message } = await api("POST /v1/allocation", { body: { sourcerId, ...(picked.length ? { ids: picked } : { category }) } });
    revalidatePath("/allocation");
    return message;
  });
}
