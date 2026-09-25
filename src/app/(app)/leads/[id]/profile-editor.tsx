import type { Candidate } from "@contracts";
import { Field, Input, Select, Checkbox, Textarea, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { toIstInputValue, formatDateTime } from "@contracts/shared/dates";
import { STAGE_LABEL } from "@/server/lifecycle/rules";
import { CV_REGISTER_FIELDS, NON_NT_SOURCES, type CandidatePlain, type FieldDef } from "@contracts/shared/fields";
import { saveProfileAction } from "./actions";

const GROUP_ORDER = ["Identity", "Qualification", "Profile", "Commercials", "Source", "Compliance", "Ops"] as const;
const NOT_NULL_ENUMS = new Set(["availabilityStatus", "source"]);

type Lead = Candidate & CandidatePlain;

function optionLabel(field: FieldDef, o: string) {
  if (field.key === "source" && (NON_NT_SOURCES as readonly string[]).includes(o)) return `${humanize(o)} (non-NT)`;
  return humanize(o);
}

function FieldInput({ f, c }: { f: FieldDef; c: Lead }) {
  const v = c[f.key];
  switch (f.type) {
    case "readonly": {
      const text = f.key === "stage" ? STAGE_LABEL[c.stage] : humanize(String(v ?? ""));
      return <Input value={text} readOnly disabled className="bg-slate-50" />;
    }
    case "mobile":
      return <Input name={f.key} type="tel" inputMode="numeric" defaultValue={(v as string | null) ?? ""} autoComplete="off" />;
    case "email":
      return <Input name={f.key} type="email" defaultValue={(v as string | null) ?? ""} autoComplete="off" />;
    case "number":
      return <Input name={f.key} type="number" step="any" min={0} defaultValue={v === null || v === undefined ? "" : String(v)} />;
    case "int":
      return <Input name={f.key} type="number" step={1} min={0} defaultValue={v === null || v === undefined ? "" : String(v)} />;
    case "date":
      return <Input name={f.key} type="date" defaultValue={v instanceof Date ? toIstInputValue(v).slice(0, 10) : ""} />;
    case "enum":
      return (
        <Select
          name={f.key}
          defaultValue={(v as string | null) ?? ""}
          placeholder={NOT_NULL_ENUMS.has(f.key) ? undefined : "—"}
          options={(f.options ?? []).map((o) => ({ value: o, label: optionLabel(f, o) }))}
        />
      );
    case "list":
      return <Input name={f.key} defaultValue={Array.isArray(v) ? v.join(", ") : ""} placeholder="Comma-separated" />;
    case "text":
      return f.key === "tlRemarks" ? <Textarea name={f.key} defaultValue={(v as string | null) ?? ""} rows={2} /> : <Input name={f.key} defaultValue={(v as string | null) ?? ""} />;
    default:
      return null;
  }
}

/** All CV Register fields grouped as in the register; saves via updateCandidate. */
export function ProfileEditor({ c, mandatory, missing, canEdit }: { c: Lead; mandatory: string[]; missing: string[]; canEdit: boolean }) {
  const mand = new Set(mandatory);
  const miss = new Set(missing);
  return (
    <ActionForm action={saveProfileAction} className="space-y-6">
      <input type="hidden" name="id" value={c.id} />
      <fieldset disabled={!canEdit} className="space-y-6 disabled:opacity-80">
        {GROUP_ORDER.map((g) => {
          const fields = CV_REGISTER_FIELDS.filter((f) => f.group === g && f.type !== "file");
          if (!fields.length) return null;
          return (
            <div key={g}>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map((f) =>
                  f.type === "bool" ? (
                    <div key={f.key} className="flex flex-col justify-end sm:col-span-2 lg:col-span-3">
                      <Checkbox name={f.key} defaultChecked={Boolean(c[f.key])} label={f.label} />
                      {f.key === "consentRecordStoreShare" && c.consentAt && <span className="mt-1 text-xs text-slate-400">Recorded {formatDateTime(c.consentAt)}</span>}
                    </div>
                  ) : (
                    <Field
                      key={f.key}
                      label={f.label}
                      required={mand.has(f.key)}
                      className={f.key === "tlRemarks" ? "sm:col-span-2 lg:col-span-3" : undefined}
                      hint={miss.has(f.key) ? <span className="text-amber-600">Missing — required by SOP</span> : undefined}
                    >
                      <FieldInput f={f} c={c} />
                    </Field>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </fieldset>
      {canEdit ? (
        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <Submit>Save profile</Submit>
          <span className="text-xs text-slate-400">Every change is recorded in the audit log.</span>
        </div>
      ) : (
        <p className="text-sm text-slate-500">You can view this profile but only the owner or the stage&apos;s team leader can edit it.</p>
      )}
    </ActionForm>
  );
}
