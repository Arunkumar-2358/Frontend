"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";

export async function markReadAction(id: string) {
  await api("POST /v1/notifications/{id}/read", { params: { id } });
  revalidatePath("/", "layout");
}

export async function markAllReadAction() {
  await api("POST /v1/notifications/read-all");
  revalidatePath("/", "layout");
}
