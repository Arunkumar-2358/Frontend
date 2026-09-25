"use server";

import { revalidatePath } from "next/cache";
import type { MainCategory } from "@contracts";
import { api } from "@/lib/api/client";
import { run, str, bool, FormError, type ActionState } from "@/lib/action";
import { fromIstInputValue } from "@contracts/shared/dates";
import { MAIN_CATEGORIES } from "@contracts/shared/fields";

export async function logMissedCallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const rawAt = str(fd, "receivedAt");
    const receivedAt = rawAt ? fromIstInputValue(rawAt) : null;
    if (rawAt && !receivedAt) throw new FormError("Invalid received time");
    const { message } = await api("POST /v1/missed-calls", { body: { mobile: str(fd, "mobile") ?? "", receivedAt: receivedAt ?? undefined, notes: str(fd, "notes") } });
    revalidatePath("/missed-calls");
    revalidatePath("/tasks");
    return message;
  });
}

export async function recallAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const id = str(fd, "missedCallId");
    if (!id) throw new FormError("Missing missed call");
    const category = str(fd, "mainCategory") as MainCategory | undefined;
    if (category && !(MAIN_CATEGORIES as readonly string[]).includes(category)) throw new FormError("Invalid category");
    const { message } = await api("POST /v1/missed-calls/{id}/recall", {
      params: { id },
      body: {
        answered: bool(fd, "answered"),
        linkSent: bool(fd, "linkSent"),
        enrolled: bool(fd, "enrolled"),
        notes: str(fd, "notes"),
        name: str(fd, "name"),
        mainCategory: category,
        currentLocation: str(fd, "currentLocation"),
        jobTitle: str(fd, "jobTitle"),
      },
    });
    revalidatePath("/missed-calls");
    revalidatePath("/queue");
    revalidatePath("/tasks");
    return message;
  });
}
