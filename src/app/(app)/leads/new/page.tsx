import Link from "next/link";
import { requireActor } from "@/lib/session";
import { PageHeader, Card, Field, Input, Select, Checkbox, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { LEAD_SOURCES, MAIN_CATEGORIES, NON_NT_SOURCES } from "@contracts/shared/fields";
import { createLeadAction } from "./actions";

export const metadata = { title: "New lead" };

export default async function NewLeadPage() {
  await requireActor();
  const sourceOptions = LEAD_SOURCES.map((s) => ({ value: s, label: `${humanize(s)}${(NON_NT_SOURCES as readonly string[]).includes(s) ? " (non-NT portal)" : ""}` }));
  return (
    <>
      <PageHeader
        title="New lead"
        subtitle={
          <>
            Add a single candidate by hand — e.g. a profile pulled from a non-NT portal. For bulk files use{" "}
            <Link href="/import" className="text-brand-600 hover:underline">Data import</Link>.
          </>
        }
      />
      <Card className="max-w-3xl">
        <ActionForm action={createLeadAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input name="name" required autoComplete="off" />
            </Field>
            <Field label="Mobile" required hint="10 digits; +91 / leading 0 are stripped">
              <Input name="mobile" type="tel" inputMode="numeric" required autoComplete="off" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" autoComplete="off" />
            </Field>
            <Field label="Main category" hint="Needed to pass the Mapping gate">
              <Select name="mainCategory" placeholder="—" options={[...MAIN_CATEGORIES]} />
            </Field>
            <Field label="Job title">
              <Input name="jobTitle" />
            </Field>
            <Field label="Primary specialty">
              <Input name="primarySpecialty" />
            </Field>
            <Field label="Current location" hint="Needed to pass the Mapping gate">
              <Input name="currentLocation" />
            </Field>
            <Field label="Source" required>
              <Select name="source" defaultValue="OTHER" options={sourceOptions} />
            </Field>
          </div>
          <Checkbox name="consent" label="Candidate consents to Nextenti storing and sharing their profile (DPDP)" />
          <p className="text-xs text-slate-500">
            The lead starts in Mapping and is moved to Validated automatically when the category, job title/specialty and location are filled in.
          </p>
          <div className="flex gap-2">
            <Submit>Create lead</Submit>
            <Link href="/leads" className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800">Cancel</Link>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
