"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api/client";
import { run, type ActionState } from "@/lib/action";

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    // Send the raw form; the API parses, validates and diffs it against the stored settings.
    const fields: Record<string, string[]> = {};
    for (const [k, v] of fd.entries()) if (!k.startsWith("$ACTION") && typeof v === "string") (fields[k] ??= []).push(v);
    const { message } = await api("PUT /v1/admin/settings", { body: { fields } });
    if (message !== "No changes") revalidatePath("/admin/settings");
    return message;
  });
}
