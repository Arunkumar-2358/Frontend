import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api/client";
import { requireActor } from "@/lib/session";
import { formatDateTime } from "@contracts/shared/dates";
import { hasRole } from "@contracts/shared/rbac";
import { MAIN_CATEGORIES, NON_NT_SOURCES } from "@contracts/shared/fields";
import { OUTCOME_LABEL } from "@contracts/shared/labels";
import { PageHeader, Card, Badge, Input, Select, Field, Checkbox, Empty, Pagination, LinkButton, humanize, btnClass } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { addPortalLeadAction, allocateAction, logContactAction, sendLinkAction } from "./actions";
import { BulkAllocateForm } from "./bulk-allocate";

export const metadata = { title: "Outreach queue" };

const OUTCOME_BUTTONS = [
  { value: "UNANSWERED", label: "Unanswered", variant: "secondary" },
  { value: "INTERESTED_LINK_SENT_NOT_REGISTERED", label: "Bb · link sent", variant: "secondary" },
  { value: "BUSY_RECALL_REQUESTED", label: "Bc · recall", variant: "secondary" },
  { value: "NOT_INTERESTED", label: "Not interested", variant: "danger" },
  { value: "ENROLLED", label: "Enrolled", variant: "success" },
] as const;

// Larger touch targets on phones; compact on desktop.
const TOUCH = "lg:px-2.5 lg:py-1 lg:text-xs";

type SP = { scope?: string; page?: string; overdue?: string };

export default async function QueuePage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  if (!hasRole(actor, "ta_lead", "team1_leader", "telecaller", "admin")) return <Empty title="No access">The outreach queue is for Team 1 (TA leads, tele-callers and their leader).</Empty>;
  const sp = await searchParams;
  const { scope, isLeader, canAddPortalLead, overdueOnly, page, pageSize, total, overdueCount, cap, telecallers: telecallerOptions, rows } = await api("GET /v1/queue", {
    query: { scope: sp.scope === "team" ? "team" : undefined, overdue: sp.overdue === "1" || undefined, page: Math.max(1, Number(sp.page) || 1) },
  });
  const t = new Date();

  const qs = (p: Partial<SP>) => {
    const q = new URLSearchParams();
    const s = { scope: scope === "team" ? "team" : undefined, overdue: overdueOnly ? "1" : undefined, ...p };
    for (const [k, v] of Object.entries(s)) if (v) q.set(k, v);
    const out = q.toString();
    return `/queue${out ? `?${out}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title={scope === "team" ? "Team queue · Validated leads" : "My outreach queue"}
        subtitle={`${total.toLocaleString("en-IN")} lead${total === 1 ? "" : "s"} · ${overdueCount.toLocaleString("en-IN")} due now or overdue · attempts cap ${cap}`}
        actions={
          <>
            <LinkButton href={qs({ overdue: overdueOnly ? "" : "1", page: undefined })} variant={overdueOnly ? "primary" : "secondary"}>{overdueOnly ? "Showing overdue only" : "Overdue only"}</LinkButton>
            {isLeader && <LinkButton href={scope === "team" ? "/queue" : "/queue?scope=team"}>{scope === "team" ? "Show my queue" : "Show whole team"}</LinkButton>}
          </>
        }
      />

      <div className="space-y-6">
        {canAddPortalLead && (
          <Card>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">+ Add a proactive lead from a non-NT portal</summary>
              <ActionForm action={addPortalLeadAction} resetOnSuccess className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <Field label="Name" required className="lg:col-span-2"><Input name="name" required autoComplete="off" /></Field>
                  <Field label="Mobile" required><Input name="mobile" type="tel" inputMode="numeric" required placeholder="10 digits" autoComplete="off" /></Field>
                  <Field label="Portal" required><Select name="source" options={[...NON_NT_SOURCES]} defaultValue="NAUKRI" required /></Field>
                  <Field label="Category" required><Select name="mainCategory" options={[...MAIN_CATEGORIES]} placeholder="Choose…" required /></Field>
                  <Field label="Location"><Input name="currentLocation" placeholder="City" /></Field>
                  <Field label="Job title" className="lg:col-span-2"><Input name="jobTitle" placeholder="e.g. Staff nurse" /></Field>
                  <div className="flex items-end"><Submit>Add lead</Submit></div>
                </div>
                <p className="mt-2 text-xs text-slate-400">Category, job title and location are needed to pass the Mapping gate; otherwise the lead goes to the data analyst.</p>
              </ActionForm>
            </details>
          </Card>
        )}

        {scope === "team" && isLeader && (
          <Card>
            {telecallerOptions.length ? <BulkAllocateForm action={allocateAction} telecallers={telecallerOptions} /> : <p className="text-sm text-slate-500">No active Team 1b tele-callers to allocate to.</p>}
          </Card>
        )}

        {rows.length === 0 ? (
          <Empty title={overdueOnly ? "Nothing overdue" : "Your queue is empty"}>{scope === "mine" ? "Validated leads you own or have follow-ups for appear here." : "No Validated leads."}</Empty>
        ) : (
          <Card pad={false}>
            <ul className="divide-y divide-slate-100">
              {rows.map((c) => {
                const due = c.due?.getTime() ?? null;
                const overdue = due !== null && due <= t.getTime();
                const last = c.lastAttempt;
                const nearCap = c.contactAttemptCount >= cap - 1;
                return (
                  <li key={c.id} className={clsx("p-4", overdue && "bg-red-50/50")}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
                      <div className="flex min-w-0 gap-3 lg:w-72 lg:shrink-0">
                        {scope === "team" && isLeader && (
                          <input type="checkbox" name="ids" value={c.id} form="allocate-form" aria-label={`Select ${c.name}`} className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                        )}
                        <div className="min-w-0">
                          <Link href={`/leads/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">{c.name}</Link>
                          <span className="ml-1.5 text-xs text-slate-400">{c.candidateCode}</span>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {[c.mainCategory && humanize(c.mainCategory), c.jobTitle, c.currentLocation].filter(Boolean).join(" · ") || "—"}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            <span className="tabular-nums text-slate-600">+91 ••••••{c.mobileLast4}</span>
                            <Link prefetch={false} href={`/queue/call/${c.id}`} className={clsx(btnClass("primary", "sm"), "py-1.5")}>📞 Call</Link>
                            {!c.isNtSource && <Badge tone="violet">{humanize(c.source)}</Badge>}
                          </div>
                          {scope === "team" && <div className="mt-1 text-xs text-slate-400">Owner: {c.owner?.name ?? "unassigned"}</div>}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs lg:block lg:w-44 lg:shrink-0 lg:space-y-1">
                        <div className={overdue ? "font-medium text-red-600" : "text-slate-600"}>
                          {due ? <>{overdue ? "Overdue · " : "Due "}{formatDateTime(new Date(due))}</> : "No follow-up set"}
                        </div>
                        <div>
                          <Badge tone={nearCap ? "amber" : "slate"}>Attempt {c.contactAttemptCount} / {cap}</Badge>
                        </div>
                        {last && <div className="text-slate-500">Last: {OUTCOME_LABEL[last.outcome]} ({humanize(last.channel)}, {formatDateTime(last.at)})</div>}
                        {c.tasks.slice(0, 2).map((task) => (
                          <div key={task.id} className="text-slate-400">
                            {task.refType === "first_call" ? "First-time call" : task.title}
                            {scope === "team" && task.assignee ? ` · ${task.assignee.name}` : ""}
                          </div>
                        ))}
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <ActionForm action={logContactAction} resetOnSuccess>
                          <input type="hidden" name="candidateId" value={c.id} />
                          <div className="flex flex-wrap items-center gap-2">
                            <Select name="channel" defaultValue="CALL" options={["CALL", "WHATSAPP", "SMS", "EMAIL"]} aria-label="Channel" className="w-auto py-1.5" />
                            <Input name="notes" placeholder="Note (optional)" aria-label="Note" className="min-w-40 flex-1 py-1.5" />
                            <Checkbox name="firstCall" label="First-time verified call" defaultChecked={c.firstCall} />
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                            {OUTCOME_BUTTONS.map((o) => (
                              <Submit key={o.value} name="outcome" value={o.value} variant={o.variant} className={TOUCH}>{o.label}</Submit>
                            ))}
                          </div>
                        </ActionForm>
                        <ActionForm action={sendLinkAction} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="candidateId" value={c.id} />
                          <span className="text-xs text-slate-500">Send enrolment link:</span>
                          <Submit name="channel" value="WHATSAPP" variant="ghost" className={clsx("border-slate-200", TOUCH)}>WhatsApp</Submit>
                          <Submit name="channel" value="SMS" variant="ghost" className={clsx("border-slate-200", TOUCH)}>SMS</Submit>
                          {c.hasEmail && <Submit name="channel" value="EMAIL" variant="ghost" className={clsx("border-slate-200", TOUCH)}>Email</Submit>}
                        </ActionForm>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => qs({ page: String(p) })} />
          </Card>
        )}
      </div>
    </>
  );
}
