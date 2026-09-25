"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

export async function availabilityCheckAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/availability/{id}/check", {
      params: { id: String(fd.get("candidateId")) },
      body: { available: fd.get("available") === "yes", notes: str(fd, "notes") },
    });
    revalidatePath("/availability");
    return message;
  });
}

export async function setColdAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const { message } = await api("POST /v1/availability/{id}/cold", { params: { id: String(fd.get("candidateId")) }, body: { cold: fd.get("cold") === "true" } });
    revalidatePath("/availability");
    return message;
  });
}
