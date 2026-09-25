"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/client";
import { run, str, type ActionState } from "@/lib/action";

/** Step 1: store the file and move to the mapping step. */
export async function uploadImportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const form = new FormData();
    for (const k of ["source", "category", "location"]) {
      const v = str(fd, k);
      if (v) form.append(k, v);
    }
    const f = fd.get("file");
    if (f instanceof File) form.append("file", f, f.name);
    const up = await api("POST /v1/imports/uploads", { body: form });
    const qs = new URLSearchParams({ file: up.file, name: up.name, source: up.source });
    if (up.category) qs.set("category", up.category);
    if (up.location) qs.set("location", up.location);
    redirect(`/import?${qs.toString()}`);
  });
}

/** Step 2: apply the column mapping and run the validation pipeline. */
export async function runImportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const mapping: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      const m = /^map_(\d+)$/.exec(k);
      if (m && typeof v === "string") mapping[m[1]] = v.trim();
    }
    const { id } = await api("POST /v1/imports", {
      body: {
        file: str(fd, "file"),
        name: str(fd, "name"),
        source: str(fd, "source"),
        category: str(fd, "category"),
        location: str(fd, "location"),
        mapping,
        saveMappingAs: str(fd, "saveMappingAs"),
      },
    });
    revalidatePath("/import");
    revalidatePath("/leads");
    redirect(`/import/${id}`);
  });
}
