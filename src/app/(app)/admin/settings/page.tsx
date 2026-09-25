import { DEFAULT_SETTINGS, getAllSettings, type SettingKey } from "@/lib/settings";
import { PageHeader, Card, Field, Input, Checkbox } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { saveSettingsAction } from "./actions";
import { MANDATORY_CHOICES, OUTCOME_LABEL, SETTING_META } from "./meta";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getAllSettings();
  const keys = Object.keys(DEFAULT_SETTINGS) as SettingKey[];
  const groups = [...new Set(MANDATORY_CHOICES.map((c) => c.group))];
  const mandatory = new Set(settings.mandatorySopFields);

  return (
    <>
      <PageHeader title="Settings" subtitle="Business configuration (PLAN §10 assumptions). Every change is written to the audit log." />
      <ActionForm action={saveSettingsAction} className="space-y-4">
        <Card title={SETTING_META.mandatorySopFields.label}>
          <p className="mb-3 text-sm text-slate-500">
            These fields drive the profile-completeness % and the Enrolled → Qualified gate. Changing the list does not rewrite existing profiles: each lead&apos;s completeness is recomputed the next time its profile is edited (so list views may show the old % until then).
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((g) => (
              <fieldset key={g}>
                <legend className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g}</legend>
                <div className="flex flex-col gap-1">
                  {MANDATORY_CHOICES.filter((c) => c.group === g).map((c) => (
                    <Checkbox key={c.key} name="mandatorySopFields" value={c.key} defaultChecked={mandatory.has(c.key)} label={c.label} />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </Card>

        <Card title="Workflow">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {keys.map((key) => {
              if (key === "mandatorySopFields") return null;
              const meta = SETTING_META[key] ?? { label: key };
              const value = settings[key] as unknown;
              const def = DEFAULT_SETTINGS[key] as unknown;
              const hint = [meta.hint, `Default: ${Array.isArray(def) ? def.join(", ") : typeof def === "object" ? "see fields" : String(def)}${meta.unit && typeof def === "number" ? ` ${meta.unit}` : ""}`].filter(Boolean).join(" · ");
              if (Array.isArray(value)) return <Field key={key} label={meta.label} hint={hint}><Input name={key} defaultValue={value.join(", ")} /></Field>;
              if (typeof value === "number") return <Field key={key} label={`${meta.label}${meta.unit ? ` (${meta.unit})` : ""}`} hint={hint}><Input type="number" min={0} step="any" name={key} defaultValue={value} /></Field>;
              if (typeof value === "string") return <Field key={key} label={meta.label} hint={hint} className="sm:col-span-2"><Input name={key} defaultValue={value} /></Field>;
              if (value && typeof value === "object") {
                const obj = { ...(def as Record<string, number>), ...(value as Record<string, number>) };
                return (
                  <fieldset key={key} className="sm:col-span-2 lg:col-span-3">
                    <legend className="mb-1 text-xs font-medium text-slate-600">{meta.label}{meta.unit ? ` (${meta.unit})` : ""}</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {Object.entries(obj).map(([sub, v]) => (
                        <Field key={sub} label={OUTCOME_LABEL[sub] ?? sub}><Input type="number" min={0} step="any" name={`${key}.${sub}`} defaultValue={v} /></Field>
                      ))}
                    </div>
                  </fieldset>
                );
              }
              return null;
            })}
          </div>
        </Card>
        <Submit>Save settings</Submit>
      </ActionForm>
    </>
  );
}
