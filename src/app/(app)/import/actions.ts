"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { run, str, type ActionState } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { assert, hasRole } from "@/lib/rbac";
import { storage } from "@/server/storage";
import { parseSpreadsheet } from "@/server/import/parse";
import { runImport, type ColumnMapping } from "@/server/import/pipeline";
import { ALLOWED_EXT, MAX_IMPORT_BYTES, TARGET_KEYS, loadUpload, parseCategoryParam, parseSourceParam } from "./upload";

const IMPORT_ROLES = ["data_analyst", "admin", "team1_leader"] as const;

/** Step 1: store the file and move to the mapping step. */
export async function uploadImportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    assert(hasRole(actor, ...IMPORT_ROLES), "Only the data analyst, Team 1 leader or admin can import data");
    const f = fd.get("file");
    if (!(f instanceof File) || f.size === 0) throw new ValidationError("Choose an .xlsx or .csv file to upload");
    if (f.size > MAX_IMPORT_BYTES) throw new ValidationError("File is larger than 25 MB — split it into smaller files");
    const lower = f.name.toLowerCase();
    if (!ALLOWED_EXT.some((e) => lower.endsWith(e))) throw new ValidationError("Only .xlsx and .csv files are supported (save .xls files as .xlsx first)");
    const buf = Buffer.from(await f.arrayBuffer());
    let parsed: Awaited<ReturnType<typeof parseSpreadsheet>>;
    try {
      parsed = await parseSpreadsheet(f.name, buf);
    } catch {
      throw new ValidationError("Could not read that file — is it a valid .xlsx / .csv?");
    }
    if (!parsed.headers.length || !parsed.rows.length) throw new ValidationError("The file has no header row or no data rows");
    const key = await storage.put("imports", f.name, buf);
    const qs = new URLSearchParams({ file: key, name: f.name, source: parseSourceParam(str(fd, "source")) });
    const cat = parseCategoryParam(str(fd, "category"));
    if (cat) qs.set("category", cat);
    const loc = str(fd, "location");
    if (loc) qs.set("location", loc);
    redirect(`/import?${qs.toString()}`);
  });
}

/** Step 2: apply the column mapping and run the validation pipeline. */
export async function runImportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor();
    assert(hasRole(actor, ...IMPORT_ROLES), "Only the data analyst, Team 1 leader or admin can import data");
    const fileKey = str(fd, "file");
    const fileName = str(fd, "name") ?? "import.xlsx";
    const { headers, rows } = await loadUpload(fileKey, fileName);
    if (!rows.length) throw new ValidationError("The file has no data rows");

    const mapping: ColumnMapping = {};
    headers.forEach((h, i) => {
      const target = str(fd, `map_${i}`) ?? "";
      mapping[h] = TARGET_KEYS.has(target) ? target : "";
    });
    const targets = Object.values(mapping).filter(Boolean);
    if (!targets.includes("mobile")) throw new ValidationError("Map one column to Mobile — it is required for dedupe and validation");
    if (!targets.includes("name") && !targets.includes("firstName")) throw new ValidationError("Map a column to Name (or First name)");
    // mapRow keeps the first non-empty value per field; block ambiguity on the identity fields.
    for (const k of ["mobile", "name"]) if (targets.filter((t) => t === k).length > 1) throw new ValidationError(`Two columns are mapped to ${k === "mobile" ? "Mobile" : "Name"} — choose one`);

    const saveAs = str(fd, "saveMappingAs");
    if (saveAs) {
      const preset = await prisma.importMapping.findUnique({ where: { name: saveAs } });
      if (preset?.isPreset) throw new ValidationError(`"${saveAs}" is a built-in preset — save under a different name`);
    }

    const { batch } = await runImport(actor, {
      fileName,
      rows,
      mapping,
      source: parseSourceParam(str(fd, "source")),
      saveMappingAs: saveAs,
      defaults: { mainCategory: parseCategoryParam(str(fd, "category")), currentLocation: str(fd, "location") },
    });
    await prisma.importBatch.update({ where: { id: batch.id }, data: { fileKey } });
    revalidatePath("/import");
    revalidatePath("/leads");
    redirect(`/import/${batch.id}`);
  });
}
