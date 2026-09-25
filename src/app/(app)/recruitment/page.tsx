import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma, Stage } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { now, DAY } from "@/lib/clock";
import { formatDate, formatDateTime, formatLakhs, toIstInputValue } from "@contracts/shared/dates";
import { hasRole } from "@/lib/rbac";
import { getAllSettings } from "@/lib/settings";
import { PageHeader, Card, Table, Td, Badge, Input, Select, Field, Button, StageBadge, Empty, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import {
  completeFormalitiesAction,
  confirmJoiningDateAction,
  declineOfferAction,
  interviewOutcomeAction,
  recordJoiningAction,
  rescheduleInterviewAction,
  retentionCheckAction,
  scheduleInterviewAction,
  sendOfferAction,
} from "./actions";

export const metadata = { title: "Interviews → joining" };

const BOARD_STAGES: Stage[] = ["SOURCED", "SELECTED", "JOINED"];
const IV_TONE = { SCHEDULED: "blue", ATTENDED: "green", NO_SHOW: "red", CANCELLED: "slate" } as const;

async function loadLeads(vacScope: Prisma.VacancyWhereInput) {
  return prisma.candidate.findMany({
    where: { stage: { in: BOARD_STAGES }, anonymizedAt: null, submissions: { some: { vacancy: vacScope } } },
    include: {
      submissions: {
        where: { vacancy: vacScope },
        include: {
          vacancy: { include: { clientOrg: { select: { name: true } } } },
          interviews: { orderBy: { scheduledAt: "desc" } },
          offers: { orderBy: { sentAt: "desc" }, include: { joining: true } },
        },
        orderBy: { submittedAt: "asc" },
      },
    },
    orderBy: { stageChangedAt: "asc" },
    take: 300,
  });
}
type Lead = Awaited<ReturnType<typeof loadLeads>>[number];
type Sub = Lead["submissions"][number];

const subLabel = (s: Sub) => `${s.vacancy.code} · ${s.vacancy.title} @ ${s.vacancy.clientOrg.name}`;
const dateValue = (d: Date | null | undefined) => toIstInputValue(d ?? now()).slice(0, 10);

function LeadHeader({ lead, extra }: { lead: Lead; extra?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${lead.id}`}>{lead.name}</Link>
        <span className="text-xs text-slate-400">{lead.candidateCode}</span>
        <StageBadge stage={lead.stage} />
      </div>
      <div className="text-xs text-slate-500">In stage since {formatDate(lead.stageChangedAt)}</div>
      <ul className="space-y-0.5 text-xs text-slate-600">
        {lead.submissions.map((s) => (
          <li key={s.id}>
            <Link href={`/vacancies/${s.vacancyId}`} className="hover:underline">{subLabel(s)}</Link>
            {s.decision !== "PENDING" && <Badge tone={s.decision === "SHORTLISTED" ? "green" : "red"} className="ml-1">{humanize(s.decision)}</Badge>}
          </li>
        ))}
      </ul>
      {extra}
    </div>
  );
}

function SubmissionPicker({ subs }: { subs: Sub[] }) {
  if (subs.length === 1) return <input type="hidden" name="submissionId" value={subs[0].id} />;
  return (
    <Field label="Vacancy">
      <Select name="submissionId" required placeholder="Select…" options={subs.map((s) => ({ value: s.id, label: subLabel(s) }))} />
    </Field>
  );
}

function SourcedLead({ lead, reminderHours }: { lead: Lead; reminderHours: number[] }) {
  const live = lead.submissions.filter((s) => s.decision !== "REJECTED");
  const interviews = lead.submissions.flatMap((s) => s.interviews.map((iv) => ({ iv, sub: s }))).sort((a, b) => b.iv.scheduledAt.getTime() - a.iv.scheduledAt.getTime());
  const vacancyId = (live[0] ?? lead.submissions[0])?.vacancyId;
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      <LeadHeader
        lead={lead}
        extra={vacancyId && (
          <Link href={`/evaluations/new?vacancyId=${vacancyId}&candidateId=${lead.id}`} className="inline-block text-xs text-brand-600 hover:underline">Score with scorecard →</Link>
        )}
      />
      <div className="space-y-4 lg:col-span-2">
        {interviews.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <Table head={["Interview", "Mode", "Status", "Reminders", "Actions"]}>
              {interviews.map(({ iv, sub }) => (
                <tr key={iv.id}>
                  <Td className="whitespace-nowrap">
                    {formatDateTime(iv.scheduledAt)}
                    <div className="text-xs text-slate-400">{sub.vacancy.code}{iv.communicatedAt ? ` · communicated ${formatDateTime(iv.communicatedAt)}` : " · not communicated"}</div>
                  </Td>
                  <Td>{humanize(iv.mode)}</Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={IV_TONE[iv.status]}>{humanize(iv.status)}</Badge>
                    {iv.result !== "PENDING" && <Badge tone={iv.result === "SELECTED" ? "green" : "red"} className="ml-1">{humanize(iv.result)}</Badge>}
                  </Td>
                  <Td className="whitespace-nowrap">{iv.remindersSent} of {reminderHours.length} sent</Td>
                  <Td className="min-w-80 space-y-2">
                    {iv.status === "SCHEDULED" ? (
                      <>
                        <ActionForm action={rescheduleInterviewAction} className="flex gap-2">
                          <input type="hidden" name="interviewId" value={iv.id} />
                          <Input type="datetime-local" name="scheduledAt" required defaultValue={toIstInputValue(iv.scheduledAt)} className="py-1 text-xs" aria-label="New date and time" />
                          <Submit size="sm" variant="secondary">Reschedule</Submit>
                        </ActionForm>
                        <ActionForm action={interviewOutcomeAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="interviewId" value={iv.id} />
                          <Select
                            name="outcome"
                            required
                            placeholder="Outcome…"
                            className="w-48 py-1 text-xs"
                            aria-label="Outcome"
                            options={[
                              { value: "SELECTED", label: "Attended + Selected" },
                              { value: "REJECTED", label: "Attended + Rejected" },
                              { value: "NO_SHOW", label: "No-show" },
                              { value: "CANCELLED", label: "Cancelled" },
                            ]}
                          />
                          <Input name="notes" placeholder="Notes" className="w-32 flex-1 py-1 text-xs" />
                          <Submit size="sm">Record</Submit>
                        </ActionForm>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">{iv.notes ?? ""}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
        )}
        {live.length > 0 ? (
          <ActionForm action={scheduleInterviewAction} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <SubmissionPicker subs={live} />
            <Field label="Date & time (IST)" required><Input type="datetime-local" name="scheduledAt" required /></Field>
            <Field label="Mode"><Select name="mode" defaultValue="IN_PERSON" options={["IN_PERSON", "VIDEO", "PHONE"]} /></Field>
            <Field label="Notes"><Input name="notes" placeholder="Venue / link" /></Field>
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3">
              <Submit size="sm">Schedule interview</Submit>
              <span className="text-xs text-slate-500">The candidate is informed on WhatsApp; reminders at T-{reminderHours.join("h and T-")}h are sent automatically.</span>
            </div>
          </ActionForm>
        ) : (
          <p className="text-sm text-slate-500">All submissions for this lead were rejected.</p>
        )}
      </div>
    </div>
  );
}

function SelectedLead({ lead }: { lead: Lead }) {
  const offers = lead.submissions.flatMap((s) => s.offers.map((o) => ({ o, sub: s }))).sort((a, b) => b.o.sentAt.getTime() - a.o.sentAt.getTime());
  const active = offers.find(({ o }) => !o.declinedAt && !o.joining);
  const selectedSubs = lead.submissions.filter((s) => s.interviews.some((iv) => iv.result === "SELECTED"));
  const offerSubs = selectedSubs.length ? selectedSubs : lead.submissions.filter((s) => s.decision !== "REJECTED");
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      <LeadHeader lead={lead} />
      <div className="space-y-3 lg:col-span-2">
        {offers.map(({ o, sub }) => (
          <div key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={o.declinedAt ? "red" : o.acceptedAt ? "green" : "amber"}>{o.declinedAt ? "Declined" : o.acceptedAt ? "Accepted" : "Offer sent"}</Badge>
            <span>{sub.vacancy.code} · sent {formatDateTime(o.sentAt)}</span>
            {o.ctcLakhs !== null && <span>· CTC {formatLakhs(o.ctcLakhs)}</span>}
            {o.joiningDate && <span>· joining {formatDate(o.joiningDate)}{o.acceptedAt ? " (confirmed)" : " (tentative)"}</span>}
          </div>
        ))}
        {active ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <ActionForm action={confirmJoiningDateAction} className="space-y-2 rounded-lg bg-slate-50 p-3">
              <input type="hidden" name="offerId" value={active.o.id} />
              <Field label="Confirm joining date"><Input type="date" name="joiningDate" required defaultValue={active.o.joiningDate ? dateValue(active.o.joiningDate) : ""} /></Field>
              <Submit size="sm" variant="secondary">Confirm date</Submit>
            </ActionForm>
            <ActionForm action={recordJoiningAction} className="space-y-2 rounded-lg bg-slate-50 p-3" confirm="Mark this candidate as joined?">
              <input type="hidden" name="offerId" value={active.o.id} />
              <Field label="Joined on"><Input type="date" name="joinedAt" required defaultValue={dateValue(active.o.joiningDate)} /></Field>
              <Submit size="sm" variant="success">Mark joined</Submit>
            </ActionForm>
            <ActionForm action={declineOfferAction} className="space-y-2 rounded-lg bg-slate-50 p-3" confirm="Record the offer as declined? The lead will be dropped.">
              <input type="hidden" name="offerId" value={active.o.id} />
              <Field label="Declined — note"><Input name="note" placeholder="Reason" /></Field>
              <Submit size="sm" variant="danger">Offer declined</Submit>
            </ActionForm>
          </div>
        ) : offerSubs.length ? (
          <ActionForm action={sendOfferAction} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <SubmissionPicker subs={offerSubs} />
            <Field label="Offered CTC (₹ lakhs)"><Input type="number" name="ctcLakhs" min={0} step="0.1" /></Field>
            <Field label="Tentative joining date"><Input type="date" name="joiningDate" /></Field>
            <div><Submit size="sm">Send offer</Submit></div>
          </ActionForm>
        ) : (
          <p className="text-sm text-slate-500">No submission available for an offer.</p>
        )}
      </div>
    </div>
  );
}

function JoinedLead({ lead }: { lead: Lead }) {
  const found = lead.submissions.flatMap((s) => s.offers.map((o) => ({ o, sub: s }))).find(({ o }) => o.joining);
  if (!found) return <div className="p-4"><LeadHeader lead={lead} extra={<p className="text-sm text-slate-500">No joining record found.</p>} /></div>;
  const j = found.o.joining!;
  const t = now().getTime();
  const checkpoint = (day: 7 | 30) => {
    const due = new Date(j.joinedAt.getTime() + day * DAY);
    const doneAt = day === 7 ? j.retained7dAt : j.retained30dAt;
    const isDue = t >= due.getTime() - DAY / 2;
    const blocked = day === 30 && !j.retained7dAt;
    return (
      <div key={day} className="space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">Day-{day} retention</span>
          {doneAt ? <Badge tone="green">Retained · {formatDate(doneAt)}</Badge> : <Badge tone={isDue ? "amber" : "slate"}>Due {formatDate(due)}</Badge>}
        </div>
        {!doneAt && (
          <ActionForm action={retentionCheckAction} className="space-y-2">
            <input type="hidden" name="joiningId" value={j.id} />
            <input type="hidden" name="day" value={day} />
            <div className="flex gap-2">
              <Select name="retained" required defaultValue="yes" disabled={!isDue || blocked} aria-label="Retained?" className="w-32 py-1 text-xs" options={[{ value: "yes", label: "Retained" }, { value: "no", label: "Left" }]} />
              <Input name="reason" placeholder="Reason (if left)" disabled={!isDue || blocked} className="py-1 text-xs" />
            </div>
            {isDue && !blocked ? (
              <Submit size="sm" variant={day === 30 ? "success" : "secondary"}>Record day-{day} check</Submit>
            ) : (
              <>
                <Button type="button" size="sm" variant="secondary" disabled>Record day-{day} check</Button>
                <p className="text-xs text-slate-400">{blocked && isDue ? "Record the day-7 check first." : `Available from ${formatDate(due)}.`}</p>
              </>
            )}
          </ActionForm>
        )}
      </div>
    );
  };
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      <LeadHeader
        lead={lead}
        extra={
          <div className="text-xs text-slate-600">
            Joined {formatDate(j.joinedAt)} at {found.sub.vacancy.clientOrg.name}
            {j.formalitiesCompletedAt ? <Badge tone="green" className="ml-1">Formalities done</Badge> : <Badge tone="amber" className="ml-1">Formalities pending</Badge>}
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="text-sm font-medium">Joining formalities</div>
          {j.formalitiesCompletedAt ? (
            <p className="text-xs text-slate-500">Completed {formatDateTime(j.formalitiesCompletedAt)}</p>
          ) : (
            <ActionForm action={completeFormalitiesAction}>
              <input type="hidden" name="joiningId" value={j.id} />
              <Submit size="sm" variant="secondary">Mark complete</Submit>
            </ActionForm>
          )}
        </div>
        {checkpoint(7)}
        {checkpoint(30)}
      </div>
    </div>
  );
}

export default async function RecruitmentPage() {
  const actor = await requireActor();
  const isLeader = hasRole(actor, "team3_leader", "admin");
  const vacScope: Prisma.VacancyWhereInput = isLeader ? { routedTeam: { in: ["T3A", "T3B", "T3C"] } } : { recruiterId: actor.id };
  const since = new Date(now().getTime() - 30 * DAY);
  const [leads, settings, outcomes] = await Promise.all([
    loadLeads(vacScope),
    getAllSettings(),
    prisma.leadStageHistory.findMany({
      where: { toStage: { in: ["SUCCESSFUL", "DROPPED"] }, at: { gte: since }, candidate: { submissions: { some: { vacancy: vacScope } } } },
      include: { candidate: { select: { id: true, name: true, candidateCode: true, dropReason: true } }, byUser: { select: { name: true } } },
      orderBy: { at: "desc" },
      take: 50,
    }),
  ]);
  const by = (s: Stage) => leads.filter((l) => l.stage === s);
  const sourced = by("SOURCED");
  const selected = by("SELECTED");
  const joined = by("JOINED");

  return (
    <>
      <PageHeader
        title="Interviews → joining"
        subtitle={`${isLeader ? "All Team 3a/3b/3c vacancies" : "Vacancies assigned to you"} · ${sourced.length} sourced · ${selected.length} selected · ${joined.length} joined`}
      />
      <div className="grid gap-6">
        <Card title={`Sourced — interviews (${sourced.length})`} pad={false}>
          {sourced.length ? <div className="divide-y divide-slate-100">{sourced.map((l) => <SourcedLead key={l.id} lead={l} reminderHours={settings.interviewReminderOffsetsHours} />)}</div> : <div className="p-4"><Empty title="No sourced leads waiting for interviews" /></div>}
        </Card>
        <Card title={`Selected — offers (${selected.length})`} pad={false}>
          {selected.length ? <div className="divide-y divide-slate-100">{selected.map((l) => <SelectedLead key={l.id} lead={l} />)}</div> : <div className="p-4"><Empty title="No selected candidates" /></div>}
        </Card>
        <Card title={`Joined — retention (${joined.length})`} pad={false}>
          {joined.length ? <div className="divide-y divide-slate-100">{joined.map((l) => <JoinedLead key={l.id} lead={l} />)}</div> : <div className="p-4"><Empty title="No joined candidates in retention" /></div>}
        </Card>
        <Card title="Recent outcomes (last 30 days)" pad={false}>
          <Table head={["When", "Lead", "Outcome", "Reason / note", "By"]} empty="No outcomes in the last 30 days.">
            {outcomes.map((h) => (
              <tr key={h.id}>
                <Td className="whitespace-nowrap">{formatDateTime(h.at)}</Td>
                <Td>
                  <Link className="text-brand-600 hover:underline" href={`/leads/${h.candidate.id}`}>{h.candidate.name}</Link>
                  <span className="ml-1 text-xs text-slate-400">{h.candidate.candidateCode}</span>
                </Td>
                <Td>{h.toStage === "SUCCESSFUL" ? <Badge tone="green">Successful</Badge> : <Badge tone="red">Dropped</Badge>}</Td>
                <Td>
                  {h.toStage === "DROPPED" && h.candidate.dropReason && <Badge tone="slate" className="mr-1">{humanize(h.candidate.dropReason)}</Badge>}
                  <span className="text-slate-500">{h.note ?? ""}</span>
                </Td>
                <Td>{h.byUser?.name ?? h.bySystem ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
