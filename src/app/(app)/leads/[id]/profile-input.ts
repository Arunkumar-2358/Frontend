import type { Candidate } from "@contracts";
import { str, num, bool, list } from "@/lib/action";
import { ValidationError } from "@/lib/errors";
import { fromIstInputValue } from "@contracts/shared/dates";
import { normalizeMobile } from "@contracts/shared/phone";
import { CV_REGISTER_FIELDS, type FieldDef, type CandidatePlain } from "@contracts/shared/fields";
import type { CandidateInput } from "@/server/candidates/service";

/** CV Register fields the profile editor saves (files and read-only fields are handled elsewhere). */
export const EDITABLE_FIELDS: FieldDef[] = CV_REGISTER_FIELDS.filter((f) => f.type !== "readonly" && f.type !== "file");

/** Enum columns that are NOT NULL in the schema — an empty choice leaves them unchanged. */
const REQUIRED_ENUMS = new Set(["availabilityStatus", "source"]);

/** Convert the profile form into typed CandidateInput (empty strings → null). */
export function profileInputFromForm(fd: FormData, current: Candidate & CandidatePlain): CandidateInput {
  const input: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) {
    const k = f.key;
    switch (f.type) {
      case "text":
        if (k === "name") {
          const v = str(fd, k);
          if (!v) throw new ValidationError("Name is required");
          input[k] = v;
        } else input[k] = str(fd, k) ?? null;
        break;
      // Contact fields are only sent when changed (avoids needless re-encryption and clash checks).
      case "mobile": {
        const v = str(fd, k);
        if (k === "mobile" && !v) throw new ValidationError("Mobile is required");
        const was = k === "mobile" ? current.mobile : current.altMobile;
        if (normalizeMobile(v ?? "") !== normalizeMobile(was ?? "")) input[k] = v ?? null;
        break;
      }
      case "email": {
        const v = str(fd, k)?.toLowerCase() ?? null;
        if (v !== (current.email ?? null)) input[k] = v;
        break;
      }
      case "number": {
        const raw = str(fd, k);
        const v = num(fd, k);
        if (raw !== undefined && v === undefined) throw new ValidationError(`${f.label} must be a number`);
        input[k] = v ?? null;
        break;
      }
      case "int": {
        const raw = str(fd, k);
        const v = num(fd, k);
        if (raw !== undefined && (v === undefined || !Number.isInteger(v))) throw new ValidationError(`${f.label} must be a whole number`);
        input[k] = v ?? null;
        break;
      }
      case "date": {
        const raw = str(fd, k);
        const d = raw ? fromIstInputValue(raw) : null;
        if (raw && !d) throw new ValidationError(`${f.label} is not a valid date`);
        input[k] = d;
        break;
      }
      case "enum": {
        const v = str(fd, k);
        if (v && f.options && !f.options.includes(v)) throw new ValidationError(`Invalid value for ${f.label}`);
        if (!v && REQUIRED_ENUMS.has(k)) break;
        input[k] = v ?? null;
        break;
      }
      case "list":
        input[k] = list(fd, k);
        break;
      case "bool": {
        const v = bool(fd, k);
        // Only send consent when it changes, so the consent timestamp is not reset on every save.
        if (v !== Boolean(current[k])) input[k] = v;
        break;
      }
    }
  }
  return input as CandidateInput;
}
