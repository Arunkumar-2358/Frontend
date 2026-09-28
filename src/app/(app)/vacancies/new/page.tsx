import { api } from "@/lib/api/client";
import { requireActor } from "@/lib/session";
import { toIstInputValue } from "@contracts/shared/dates";
import { hasRole } from "@contracts/shared/rbac";
import { MAIN_CATEGORIES } from "@contracts/shared/fields";
import { PageHeader, Card, Field, Input, Select, Empty, LinkButton, Textarea } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { createClientOrgAction, createVacancyAction } from "../actions";
import { ORG_TYPE_LABEL } from "../util";

export const metadata = { title: "New vacancy" };

const ORG_TYPE_OPTIONS = [
  { value: "GENERAL", label: `${ORG_TYPE_LABEL.GENERAL} → Team 3a` },
  { value: "EXISTING", label: `${ORG_TYPE_LABEL.EXISTING} → Team 3b` },
  { value: "FREE_TRIAL", label: `${ORG_TYPE_LABEL.FREE_TRIAL} → Team 3c` },
];

export default async function NewVacancyPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  if (!hasRole(actor, "admin", "sourcer", "team2_leader", "recruiter", "team3_leader")) {
    return <Empty title="Only Teams 2 and 3 can add vacancies" />;
  }
  const orgs = await api("GET /v1/vacancies/client-orgs");
  const routeHint = { GENERAL: "3a", EXISTING: "3b", FREE_TRIAL: "3c" } as const;

  return (
    <>
      <PageHeader title="New vacancy" subtitle="Posted time, calibration time and whether it was added before 2 pm (IST) are recorded automatically." actions={<LinkButton href="/vacancies">← Vacancies</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Vacancy intake" className="lg:col-span-2">
          <ActionForm action={createVacancyAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Client organisation" required className="sm:col-span-2" hint="The org type routes the vacancy: General → Team 3a, Existing client → Team 3b, Free trial → Team 3c. A recruiter and a Team 2 sourcer are assigned automatically.">
              <Select
                name="clientOrgId"
                required
                defaultValue={sp.org ?? ""}
                placeholder="Select…"
                options={orgs.map((o) => ({ value: o.id, label: `${o.name} (${ORG_TYPE_LABEL[o.type]} → Team ${routeHint[o.type]})` }))}
              />
            </Field>
            <Field label="Title" required><Input name="title" required placeholder="e.g. Staff Nurse – ICU" /></Field>
            <Field label="Category" required><Select name="category" required placeholder="Select…" options={[...MAIN_CATEGORIES]} /></Field>
            <Field label="Specialty"><Input name="specialty" placeholder="e.g. Critical care" /></Field>
            <Field label="Location" required><Input name="location" required placeholder="e.g. Hyderabad" /></Field>
            <Field label="Minimum experience (years)"><Input name="minExperienceYears" type="number" min={0} step="0.5" /></Field>
            <Field label="Maximum notice period (days)"><Input name="maxNoticeDays" type="number" min={0} step={1} /></Field>
            <Field label="CTC minimum (₹ lakhs)"><Input name="ctcMinLakhs" type="number" min={0} step="0.1" /></Field>
            <Field label="CTC maximum (₹ lakhs)"><Input name="ctcMaxLakhs" type="number" min={0} step="0.1" /></Field>
            <Field label="Openings"><Input name="openings" type="number" min={1} step={1} defaultValue={1} /></Field>
            <Field label="Posted at (IST)" hint="Defaults to now. Before 14:00 IST counts as “added before 2 pm”.">
              <Input name="postedAt" type="datetime-local" defaultValue={toIstInputValue(new Date())} />
            </Field>
            <Field label="Description of the job post" className="sm:col-span-2" hint="As posted — shown to the Team 1 TA lead and Team 2 sourcer given the posting.">
              <Textarea name="description" maxLength={4000} placeholder="e.g. Staff nurse for a 40-bed ICU, rotational shifts" />
            </Field>
            <Field label="Mandatory attributes" className="sm:col-span-2" hint="Must-haves for a matching CV: location, experience, registration, salary …">
              <Textarea name="mandatoryAttributes" maxLength={2000} rows={2} placeholder="e.g. Kukatpally, Hyderabad · 1+ year ICU/PICU · registration required · ₹18–20k/month" />
            </Field>
            <div className="sm:col-span-2">
              <Submit>Create vacancy</Submit>
            </div>
          </ActionForm>
        </Card>
        <Card title="New client organisation">
          <p className="mb-3 text-sm text-slate-500">Not in the list? Add it here, then pick it in the intake form.</p>
          <ActionForm action={createClientOrgAction} className="space-y-3" resetOnSuccess>
            <Field label="Name" required><Input name="name" required /></Field>
            <Field label="Type" required><Select name="type" required defaultValue="GENERAL" options={ORG_TYPE_OPTIONS} /></Field>
            <Field label="City"><Input name="city" /></Field>
            <Submit variant="secondary">Add organisation</Submit>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
