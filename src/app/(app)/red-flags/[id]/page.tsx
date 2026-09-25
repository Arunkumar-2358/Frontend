import { notFound, redirect } from "next/navigation";
import clsx from "clsx";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { now } from "@/lib/clock";
import { getSetting } from "@/lib/settings";
import { addWorkingDays, formatDate, formatDateTime, istDateKey } from "@contracts/shared/dates";
import { canManageRedFlags } from "@/lib/rbac";
import { holidaySet } from "@/server/redflags/service";
import { PageHeader, Card, Dl, Badge, Field, Input, Select, Textarea, LinkButton } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { implementCapaAction, suggestCapaAction, verifyAndCloseAction } from "../actions";
import { canViewRedFlag, STATUS_LABEL, STATUS_TONE } from "../scope";

export const metadata = { title: "Red flag" };

const STEPS = ["OPEN", "CAPA_SUGGESTED", "IMPLEMENTED", "CLOSED"] as const;

export default async function RedFlagPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const f = await prisma.redFlag.findUnique({
    where: { id },
    include: { agent: { select: { name: true } }, actionOwner: { select: { id: true, name: true } }, raisedBy: { select: { name: true } } },
  });
  if (!f) notFound();
  if (!canViewRedFlag(actor, f)) redirect("/dashboard?denied=1");

  const manage = canManageRedFlags(actor);
  const isOwner = f.actionOwnerId === actor.id;
  const t = now();
  const [sla, holidays] = await Promise.all([getSetting("redFlagSlaWorkingDays"), holidaySet()]);
  const slaDeadline = addWorkingDays(f.raisedOn, sla, holidays);
  const overdue = !!f.dueDate && f.status !== "CLOSED" && f.dueDate < t;
  const stepIdx = STEPS.indexOf(f.status);
  const users = manage ? await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];

  return (
    <>
      <PageHeader
        title={`Red flag · ${f.teamCode}`}
        subtitle={<>Raised {formatDateTime(f.raisedOn)} by {f.raisedBy?.name ?? (f.autoRaised ? "KPI target check (auto)" : "system")}</>}
        actions={<LinkButton href="/red-flags">← All red flags</LinkButton>}
      />

      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s} className={clsx("rounded-lg border px-3 py-2 text-sm", i < stepIdx ? "border-emerald-200 bg-emerald-50 text-emerald-700" : i === stepIdx ? "border-brand-300 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 bg-white text-slate-400")}>
            <span className="mr-1 tabular-nums">{i + 1}.</span>
            {STATUS_LABEL[s]}
            {i < stepIdx && " ✓"}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Deviation" actions={<Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>}>
            <p className="mb-4 text-sm whitespace-pre-line text-slate-800">{f.description}</p>
            <Dl
              items={[
                ["Date", formatDate(f.date)],
                ["Team", f.teamCode],
                ["Agent", f.agent?.name],
                ["KPI deviated", f.kpiDeviated],
                ["Target / standard", f.targetStandard],
                ["Actual", f.actual],
                ["Raised on", formatDateTime(f.raisedOn)],
                ["Source", f.autoRaised ? <Badge tone="violet" key="a">Auto (KPI target)</Badge> : "Manual"],
                ["Period", f.periodType && f.periodStart ? `${f.periodType === "WEEK" ? "Week" : "Month"} from ${formatDate(f.periodStart)}` : null],
              ]}
            />
          </Card>
          <Card title="CAPA">
            <Dl
              items={[
                ["CAPA suggested", f.capaSuggested],
                ["Suggested at", formatDateTime(f.capaSuggestedAt)],
                ["Expected outcome", f.expectedOutcome],
                ["Due date", f.dueDate ? <span key="d" className={overdue ? "font-medium text-red-600" : ""}>{formatDate(f.dueDate)}{overdue ? " · overdue" : ""}</span> : null],
                ["Action owner", f.actionOwner?.name],
                ["Corrective action implemented", f.correctiveActionImplemented],
                ["Completion date", formatDate(f.completionDate)],
                ["Achieved outcome", f.achievedOutcome],
                ["Closed at", formatDateTime(f.closedAt)],
              ]}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={`SLA · closed within ${sla} working day${sla === 1 ? "" : "s"}`}>
            {f.status === "CLOSED" ? (
              f.closedWithin1WorkingDay ? <Badge tone="green">Met — closed {formatDateTime(f.closedAt)}</Badge> : <Badge tone="red">Missed — closed {formatDateTime(f.closedAt)}</Badge>
            ) : (
              <p className="text-sm text-slate-600">
                Close by <span className={clsx("font-medium", slaDeadline < t ? "text-red-600" : "text-slate-900")}>{formatDateTime(slaDeadline)}</span>
                {slaDeadline < t && <Badge tone="red" className="ml-2">SLA breached</Badge>}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">Working days skip Sundays and the holiday calendar{holidays.has(istDateKey(t)) ? " (today is a holiday)" : ""}.</p>
          </Card>

          {manage && f.status !== "CLOSED" && f.status !== "IMPLEMENTED" && (
            <Card title={f.status === "CAPA_SUGGESTED" ? "Update CAPA" : "Suggest CAPA"}>
              <ActionForm action={suggestCapaAction} className="space-y-3">
                <input type="hidden" name="id" value={f.id} />
                <Field label="CAPA suggested" required>
                  <Textarea name="capaSuggested" required defaultValue={f.capaSuggested ?? ""} />
                </Field>
                <Field label="Expected outcome">
                  <Textarea name="expectedOutcome" rows={2} defaultValue={f.expectedOutcome ?? ""} />
                </Field>
                <Field label="Due date">
                  <Input type="date" name="dueDate" defaultValue={f.dueDate ? istDateKey(f.dueDate) : ""} />
                </Field>
                <Field label="Action owner">
                  <Select name="actionOwnerId" defaultValue={f.actionOwnerId ?? ""} placeholder="Choose…" options={users.map((u) => ({ value: u.id, label: u.name }))} />
                </Field>
                <Submit>Save CAPA</Submit>
              </ActionForm>
            </Card>
          )}

          {f.status === "CAPA_SUGGESTED" && (manage || isOwner) && (
            <Card title="Record corrective action">
              <ActionForm action={implementCapaAction} className="space-y-3">
                <input type="hidden" name="id" value={f.id} />
                <Field label="Corrective action implemented" required>
                  <Textarea name="correctiveActionImplemented" required />
                </Field>
                <Field label="Achieved outcome">
                  <Textarea name="achievedOutcome" rows={2} />
                </Field>
                <Submit variant="success">Mark implemented</Submit>
              </ActionForm>
            </Card>
          )}

          {f.status === "IMPLEMENTED" && manage && (
            <Card title="Verify & close">
              <ActionForm action={verifyAndCloseAction} className="space-y-3" confirm="Close this red flag?">
                <input type="hidden" name="id" value={f.id} />
                <Field label="Achieved outcome (verified)">
                  <Textarea name="achievedOutcome" rows={2} defaultValue={f.achievedOutcome ?? ""} />
                </Field>
                <Submit variant="success">Verify and close</Submit>
              </ActionForm>
            </Card>
          )}

          {!manage && !(isOwner && f.status === "CAPA_SUGGESTED") && f.status !== "CLOSED" && (
            <p className="text-sm text-slate-500">{isOwner ? "You are the action owner — you can record the corrective action once a CAPA is suggested." : "Read-only: the TA coordinator manages this flag."}</p>
          )}
        </div>
      </div>
    </>
  );
}
