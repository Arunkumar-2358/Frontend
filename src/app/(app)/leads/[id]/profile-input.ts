import type { LeadProfileForm } from "@contracts";
import { str, bool, list } from "@/lib/action";
import { CV_REGISTER_FIELDS, type FieldDef } from "@contracts/shared/fields";

/** CV Register fields the profile editor saves (files and read-only fields are handled elsewhere). */
export const EDITABLE_FIELDS: FieldDef[] = CV_REGISTER_FIELDS.filter((f) => f.type !== "readonly" && f.type !== "file");

/**
 * Collect the profile form for PUT /v1/leads/{id}/profile: trimmed strings (null = empty),
 * lists split on commas / new lines, checkboxes as booleans. The API converts, validates
 * and only applies contact / consent fields that actually changed.
 */
export function profileFormFromFormData(fd: FormData): LeadProfileForm {
  const form: LeadProfileForm = {};
  for (const f of EDITABLE_FIELDS) {
    if (f.type === "list") form[f.key] = list(fd, f.key);
    else if (f.type === "bool") form[f.key] = bool(fd, f.key);
    else form[f.key] = str(fd, f.key) ?? null;
  }
  return form;
}
