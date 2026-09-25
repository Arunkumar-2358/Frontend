import Link from "next/link";
import clsx from "clsx";
import type { Prisma } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { now } from "@/lib/clock";
import { formatDateTime, startOfIstWeek, toIstInputValue } from "@contracts/shared/dates";
import { hasRole } from "@/lib/rbac";
import { MAIN_CATEGORIES } from "@contracts/shared/fields";
import { PageHeader, Card, Badge, Input, Select, Field, Checkbox, Stat, Empty, Pagination, StageBadge, btnClass } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { logMissedCallAction, recallAction } from "./actions";

export const metadata = { title: "Missed calls" };

const PAGE_SIZE = 30;

type SP = { tab?: string; page?: string };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function MissedCallsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  if (!hasRole(actor, "telecaller", "team1_leader", "admin")) return <Empty title="No access">The missed-call inbox is for Team 1b.</Empty>;
  const sp = await searchParams;
  const isLeader = hasRole(actor, "team1_leader", "admin");
  const tab = sp.tab === "closed" ? "closed" : "open";
  const page = Math.max(1, Number(sp.page) || 1);
  const t = now();

  const mine: Prisma.MissedCallWhereInput = isLeader ? {} : { assignedToId: actor.id };
  const where: Prisma.MissedCallWhereInput = { ...mine, closedAt: tab === "closed" ? { not: null } : null };
  const week: Prisma.MissedCallWhereInput = { ...mine, receivedAt: { gte: startOfIstWeek(t) } };

  const [calls, total, openCount, fMissed, fRecalled, fAnswered, fLink, fEnrolled] = await Promise.all([
    prisma.missedCall.findMany({ where, orderBy: { receivedAt: tab === "open" ? "asc" : "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.missedCall.count({ where }),
    prisma.missedCall.count({ where: { ...mine, closedAt: null } }),
    prisma.missedCall.count({ where: week }),
    prisma.missedCall.count({ where: { ...week, recallAttemptedAt: { not: null } } }),
    prisma.missedCall.count({ where: { ...week, answered: true } }),
    prisma.missedCall.count({ where: { ...week, linkSent: true } }),
    prisma.missedCall.count({ where: { ...week, enrolled: true } }),
  ]);

  // MissedCall has no Prisma relations; look up leads, assignees and recall tasks by id.
  const leadIds = [...new Set(calls.map((c) => c.candidateId).filter((x): x is string => !!x))];
  const userIds = [...new Set(calls.map((c) => c.assignedToId).filter((x): x is string => !!x))];
  const [leads, users, tasks] = await Promise.all([
    prisma.candidate.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true, candidateCode: true, stage: true, isCold: true } }),
    isLeader ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    prisma.task.findMany({ where: { refType: "missed_call", refId: { in: calls.map((c) => c.id) }, status: "OPEN" }, orderBy: { dueAt: "asc" }, select: { refId: true, dueAt: true } }),
  ]);
  const leadBy = new Map(leads.map((l) => [l.id, l]));
  const userBy = new Map(users.map((u) => [u.id, u.name]));
  const recallDue = new Map<string, Date>();
  for (const task of tasks) if (task.refId && !recallDue.has(task.refId)) recallDue.set(task.refId, task.dueAt);

  const tabHref = (x: "open" | "closed") => (x === "closed" ? "/missed-calls?tab=closed" : "/missed-calls");

  return (
    <>
      <PageHeader title="Missed-call inbox" subtitle={`${openCount} open${isLeader ? " (whole team)" : " assigned to you"} · recall every missed call, then track answered → link sent → enrolled`} />

      <div className="mb-6">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">This week{isLeader ? " · whole team" : " · you"}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Missed" value={fMissed} />
          <Stat label="Recalled" value={fRecalled} hint={`${pct(fRecalled, fMissed)} of missed`} />
          <Stat label="Answered" value={fAnswered} hint={`${pct(fAnswered, fRecalled)} of recalled`} />
          <Stat label="Link sent" value={fLink} hint={`${pct(fLink, fAnswered)} of answered`} />
          <Stat label="Enrolled" value={fEnrolled} tone={fEnrolled ? "green" : undefined} hint={`${pct(fEnrolled, fLink)} of links`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Log a missed incoming call" className="lg:col-span-1 lg:self-start">
          <ActionForm action={logMissedCallAction} resetOnSuccess className="space-y-3">
            <Field label="Caller's mobile" required>
              <Input name="mobile" type="tel" inputMode="numeric" placeholder="10 digits" required autoComplete="off" />
            </Field>
            <Field label="Received at (IST)" hint="Leave as is for 'just now'">
              <Input name="receivedAt" type="datetime-local" defaultValue={toIstInputValue(t)} />
            </Field>
            <Field label="Notes">
              <Input name="notes" placeholder="Optional" />
            </Field>
            <Submit>Log missed call</Submit>
          </ActionForm>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <div className="flex gap-2">
            <Link href={tabHref("open")} className={btnClass(tab === "open" ? "secondary" : "ghost", "sm")}>Open ({openCount})</Link>
            <Link href={tabHref("closed")} className={btnClass(tab === "closed" ? "secondary" : "ghost", "sm")}>Closed</Link>
          </div>

          {calls.length === 0 ? (
            <Empty title={tab === "open" ? "No open missed calls" : "No closed missed calls yet"}>{tab === "open" ? "Every missed call has been recalled and closed." : undefined}</Empty>
          ) : (
            <Card pad={false}>
              <ul className="divide-y divide-slate-100">
                {calls.map((mc) => {
                  const lead = mc.candidateId ? leadBy.get(mc.candidateId) : undefined;
                  const due = recallDue.get(mc.id);
                  const overdue = !mc.closedAt && !!due && due.getTime() <= t.getTime();
                  return (
                    <li key={mc.id} className={clsx("p-4", overdue && "bg-red-50/40")}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:gap-5">
                        <div className="min-w-0 lg:w-60 lg:shrink-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium tabular-nums text-slate-900">+91 ••••••{mc.fromLast4}</span>
                            {!mc.closedAt && (
                              <Link prefetch={false} href={`/missed-calls/call/${mc.id}`} className={clsx(btnClass("primary", "sm"), "py-1.5")}>📞 Recall</Link>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">Received {formatDateTime(mc.receivedAt)}</div>
                          <div className="mt-1 text-sm">
                            {lead ? (
                              <span className="inline-flex flex-wrap items-center gap-1.5">
                                <Link href={`/leads/${lead.id}`} className="text-brand-600 hover:underline">{lead.name}</Link>
                                <span className="text-xs text-slate-400">{lead.candidateCode}</span>
                                <StageBadge stage={lead.stage} cold={lead.isCold} />
                              </span>
                            ) : (
                              <Badge tone="amber">Unknown caller</Badge>
                            )}
                          </div>
                          {isLeader && <div className="mt-1 text-xs text-slate-400">Assigned: {mc.assignedToId ? userBy.get(mc.assignedToId) ?? "—" : "unassigned"}</div>}
                          {mc.notes && <div className="mt-1 text-xs text-slate-500">“{mc.notes}”</div>}
                        </div>

                        <div className="flex flex-wrap gap-1.5 lg:w-40 lg:shrink-0 lg:flex-col lg:items-start">
                          {mc.recallAttemptedAt ? <Badge tone="blue">Recalled {formatDateTime(mc.recallAttemptedAt)}</Badge> : <Badge tone={overdue ? "red" : "slate"}>Not yet recalled</Badge>}
                          {mc.answered && <Badge tone="cyan">Answered</Badge>}
                          {mc.linkSent && <Badge tone="violet">Link sent</Badge>}
                          {mc.enrolled && <Badge tone="green">Enrolled</Badge>}
                          {due && !mc.closedAt && <span className={clsx("text-xs", overdue ? "font-medium text-red-600" : "text-slate-500")}>Recall due {formatDateTime(due)}</span>}
                          {mc.closedAt && <span className="text-xs text-slate-400">Closed {formatDateTime(mc.closedAt)}</span>}
                        </div>

                        {!mc.closedAt && (
                          <div className="min-w-0 flex-1">
                            <ActionForm action={recallAction} resetOnSuccess className="space-y-2">
                              <input type="hidden" name="missedCallId" value={mc.id} />
                              <div className="flex flex-wrap gap-x-5 gap-y-2">
                                <Checkbox name="answered" label="Answered" defaultChecked={mc.answered} />
                                <Checkbox name="linkSent" label="Link sent" defaultChecked={mc.linkSent} />
                                <Checkbox name="enrolled" label="Enrolled" />
                              </div>
                              <Input name="notes" placeholder="Notes" aria-label="Notes" className="py-1.5" />
                              {!mc.candidateId && (
                                <details className="rounded-lg border border-slate-200 p-3">
                                  <summary className="cursor-pointer text-xs font-medium text-slate-600">Unknown caller answered? Create a lead</summary>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <Field label="Name"><Input name="name" autoComplete="off" /></Field>
                                    <Field label="Category"><Select name="mainCategory" options={[...MAIN_CATEGORIES]} placeholder="Choose…" /></Field>
                                    <Field label="Location"><Input name="currentLocation" placeholder="City" /></Field>
                                    <Field label="Job title"><Input name="jobTitle" placeholder="e.g. Pharmacist" /></Field>
                                  </div>
                                  <p className="mt-2 text-xs text-slate-400">With category, job title and location the lead goes straight to Validated; otherwise to Mapping.</p>
                                </details>
                              )}
                              <Submit className="w-full sm:w-auto">Save recall</Submit>
                            </ActionForm>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `${tabHref(tab)}${tab === "closed" ? "&" : "?"}page=${p}`} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
