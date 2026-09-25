import Link from "next/link";
import clsx from "clsx";
import type { Prisma } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { now } from "@/lib/clock";
import { formatDateTime } from "@contracts/shared/dates";
import { getSetting } from "@/lib/settings";
import { hasRole } from "@/lib/rbac";
import { MAIN_CATEGORIES, NON_NT_SOURCES } from "@contracts/shared/fields";
import { OUTCOME_LABEL } from "@/server/outreach/service";
import { teamMembers } from "@/server/users/assignment";
import { PageHeader, Card, Badge, Input, Select, Field, Checkbox, Empty, Pagination, LinkButton, humanize, btnClass } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { addPortalLeadAction, allocateAction, logContactAction, sendLinkAction } from "./actions";
import { BulkAllocateForm } from "./bulk-allocate";

export const metadata = { title: "Outreach queue" };

const PAGE_SIZE = 30;
const MINE_CAP = 500;
const OPEN_OUTREACH_TASK = { status: "OPEN", type: { in: ["FOLLOW_UP", "RECALL"] } } satisfies Prisma.TaskWhereInput;

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
  const isLeader = hasRole(actor, "team1_leader", "admin");
  const canAddPortalLead = hasRole(actor, "ta_lead", "team1_leader", "admin");
  const scope = sp.scope === "team" && isLeader ? "team" : "mine";
  const overdueOnly = sp.overdue === "1";
  const page = Math.max(1, Number(sp.page) || 1);
  const t = now();
  const cap = await getSetting("maxContactAttempts");

  const mineWhere: Prisma.CandidateWhereInput = { stage: "VALIDATED", OR: [{ ownerUserId: actor.id }, { tasks: { some: { ...OPEN_OUTREACH_TASK, assigneeId: actor.id } } }] };
  const where: Prisma.CandidateWhereInput = scope === "mine" ? mineWhere : { stage: "VALIDATED" };
  const include = {
    owner: { select: { id: true, name: true } },
    tasks: {
      where: scope === "mine" ? { ...OPEN_OUTREACH_TASK, assigneeId: actor.id } : OPEN_OUTREACH_TASK,
      orderBy: { dueAt: "asc" },
      select: { id: true, dueAt: true, refType: true, assigneeId: true, title: true, assignee: { select: { name: true } } },
    },
    contactAttempts: { orderBy: { at: "desc" }, take: 1, select: { outcome: true, channel: true, at: true } },
  } satisfies Prisma.CandidateInclude;
  type Row = Prisma.CandidateGetPayload<{ include: typeof include }>;

  const dueOf = (c: Row) => {
    const times = [c.tasks[0]?.dueAt, c.nextFollowupAt].filter((d): d is Date => !!d).map((d) => d.getTime());
    return times.length ? Math.min(...times) : null;
  };

  let rows: Row[];
  let total: number;
  if (scope === "mine") {
    // A personal queue is small: load it, sort by the true due time (task or follow-up), paginate in memory.
    const all = await prisma.candidate.findMany({ where, include, orderBy: { nextFollowupAt: { sort: "asc", nulls: "last" } }, take: MINE_CAP });
    const sorted = all
      .filter((c) => !overdueOnly || (dueOf(c) ?? Infinity) <= t.getTime())
      .sort((a, b) => (dueOf(a) ?? Infinity) - (dueOf(b) ?? Infinity));
    total = sorted.length;
    rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    const w: Prisma.CandidateWhereInput = overdueOnly ? { AND: [where, { nextFollowupAt: { lte: t } }] } : where;
    [rows, total] = await Promise.all([
      prisma.candidate.findMany({ where: w, include, orderBy: [{ nextFollowupAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.candidate.count({ where: w }),
    ]);
    rows.sort((a, b) => (dueOf(a) ?? Infinity) - (dueOf(b) ?? Infinity));
  }

  const [overdueCount, telecallers, firstCallTasks] = await Promise.all([
    scope === "mine"
      ? prisma.candidate.count({ where: { AND: [mineWhere, { OR: [{ nextFollowupAt: { lte: t } }, { tasks: { some: { ...OPEN_OUTREACH_TASK, assigneeId: actor.id, dueAt: { lte: t } } } }] }] } })
      : prisma.candidate.count({ where: { stage: "VALIDATED", nextFollowupAt: { lte: t } } }),
    isLeader && scope === "team" ? teamMembers("T1B") : Promise.resolve([]),
    prisma.task.findMany({ where: { status: "OPEN", assigneeId: actor.id, refType: "first_call", candidateId: { in: rows.map((r) => r.id) } }, select: { candidateId: true } }),
  ]);
  const firstCallFor = new Set(firstCallTasks.map((x) => x.candidateId));
  const telecallerOptions = telecallers.filter((u) => u.roles.some((r) => r.role === "telecaller")).map((u) => ({ value: u.id, label: u.name }));

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
                const due = dueOf(c);
                const overdue = due !== null && due <= t.getTime();
                const last = c.contactAttempts[0];
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
                            <Checkbox name="firstCall" label="First-time verified call" defaultChecked={firstCallFor.has(c.id)} />
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
                          {c.emailEnc && <Submit name="channel" value="EMAIL" variant="ghost" className={clsx("border-slate-200", TOUCH)}>Email</Submit>}
                        </ActionForm>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => qs({ page: String(p) })} />
          </Card>
        )}
      </div>
    </>
  );
}
