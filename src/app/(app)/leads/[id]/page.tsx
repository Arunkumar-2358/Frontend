import Link from "next/link";
import { notFound } from "next/navigation";
import type { DropReason, LeadDetail } from "@contracts";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireActor } from "@/lib/session";
import { formatDate, formatDateTime, toIstInputValue } from "@contracts/shared/dates";
import { formatMobile } from "@contracts/shared/phone";
import { fieldLabel, isNtSourceFor } from "@contracts/shared/fields";
import { EXIT_STAGES, NEXT_STAGE, STAGE_LABEL } from "@contracts/shared/lifecycle";
import { OUTCOME_LABEL } from "@contracts/shared/labels";
import { PageHeader, Card, Table, Td, Badge, StageBadge, Progress, Field, Input, Select, Textarea, Checkbox, LinkButton, Empty, humanize, type Tone } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ProfileEditor } from "./profile-editor";
import { FileUpload } from "./file-upload";
import { transitionAction, logContactAction, sendLinkAction, reassignAction, deletionRequestAction } from "./actions";

export const metadata = { title: "Lead" };

const DROP_REASONS: DropReason[] = ["INTERVIEW_NO_SHOW", "REJECTED", "OFFER_DECLINED", "LEFT_BEFORE_30_DAYS", "NOT_JOINED", "OTHER"];
const DECISION_TONE: Record<string, Tone> = { PENDING: "slate", SHORTLISTED: "green", REJECTED: "red" };
const MSG_TONE: Record<string, Tone> = { QUEUED: "slate", SENT: "green", FAILED: "red" };

const fileHref = (key: string) => `/api/v1/files/${key.split("/").map(encodeURIComponent).join("/")}`;

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; gate?: string }> }) {
  await requireActor();
  const { id } = await params;
  const sp = await searchParams;

  // The API decrypts the contact details and records the PII view (DPDP access log).
  let detail: LeadDetail;
  try {
    detail = await api("GET /v1/leads/{id}", { params: { id } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    // Tell "no such lead" apart from "this lead exists, but not for you" — the second one
    // is reachable from a link elsewhere (e.g. a Team 2 match preview) and deserves a clear
    // message rather than a bare 404.
    if (e instanceof ApiError && e.status === 403) {
      return (
        <>
          <PageHeader title="Lead" />
          <Empty title="No access">This lead is outside what your role can see — it may not have reached your team yet, or belongs to another team&apos;s pipeline.</Empty>
        </>
      );
    }
    throw e;
  }
  const { lead: c, checklist: check, can, transitions: targets, tasks, attempts, history, submissions, messages, deletionRequests, audits, members, fileLimits } = detail;
  const canEdit = can.edit;
  const stageLeader = can.stageLeader;
  const showAudit = can.viewAudit;

  const showStagePanel = can.stagePanel;
  const canLogContact = can.logContact;
  const isNt = isNtSourceFor(c.source);
  const t = Date.now();

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/leads" className="text-slate-500 hover:text-slate-800">← Leads</Link>
      </div>
      <PageHeader
        title={c.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">{c.candidateCode}</span>
            <StageBadge stage={c.stage} cold={c.isCold} />
            <span>Owner: {c.owner?.name ?? "Unassigned"}</span>
            <span>Since {formatDate(c.stageChangedAt)}</span>
          </span>
        }
      />

      {sp.created && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${sp.gate ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
          {sp.gate ? (
            <>
              Lead created but kept in <strong>Mapping</strong> — {sp.gate}. Fill in the missing details below, then move it to Validated from the stage panel.
            </>
          ) : (
            <>Lead created and moved to Validated.</>
          )}
        </div>
      )}
      {c.anonymizedAt && <div className="mb-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">Personal data was deleted on {formatDate(c.anonymizedAt)} (DPDP request).</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Profile completeness">
          <Progress value={check.pct} />
          <div className="mt-1 text-xs text-slate-500">{humanize(c.verificationStatus)}{c.verifiedBy ? ` · by ${c.verifiedBy.name}` : ""}</div>
        </Summary>
        <Summary label="Source">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={isNt ? "violet" : "amber"}>{isNt ? "NT" : "Non-NT"}</Badge>
            <span className="text-sm text-slate-700">{humanize(c.source)}</span>
          </div>
          {c.importBatch && <div className="mt-1 truncate text-xs text-slate-500">Import: {c.importBatch.fileName}</div>}
        </Summary>
        <Summary label="Consent (DPDP)">
          {c.consentRecordStoreShare ? <Badge tone="green">On file</Badge> : <Badge tone="red">Not recorded</Badge>}
          {c.consentAt && <div className="mt-1 text-xs text-slate-500">{formatDateTime(c.consentAt)}</div>}
        </Summary>
        <Summary label="Contact attempts">
          <div className="text-lg font-semibold text-slate-900 tabular-nums">{c.contactAttemptCount}</div>
          <div className={`text-xs ${c.nextFollowupAt && c.nextFollowupAt.getTime() <= t ? "font-medium text-red-600" : "text-slate-500"}`}>
            {c.nextFollowupAt ? `Next: ${formatDateTime(c.nextFollowupAt)}` : "No follow-up scheduled"}
          </div>
        </Summary>
      </div>

      {check.missing.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Missing mandatory fields ({check.missing.length}):</span> {check.missing.map(fieldLabel).join(", ")}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Profile (CV register)">
            <ProfileEditor c={c} mandatory={check.mandatory} missing={check.missing} canEdit={canEdit} />
          </Card>

          <Card title="Contact log" pad={false} actions={<span className="text-xs text-slate-400">{attempts.length} attempt{attempts.length === 1 ? "" : "s"}</span>}>
            <div className="border-b border-slate-100 p-4">
            {canLogContact ? (
              <div className="space-y-4">
                <ActionForm action={logContactAction} resetOnSuccess className="space-y-3">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Channel" required>
                      <Select name="channel" defaultValue="CALL" options={[{ value: "CALL", label: "Call" }, { value: "WHATSAPP", label: "WhatsApp" }, { value: "SMS", label: "SMS" }, { value: "EMAIL", label: "Email" }]} />
                    </Field>
                    <Field label="Direction">
                      <Select name="direction" defaultValue="OUTBOUND" options={[{ value: "OUTBOUND", label: "Outbound" }, { value: "RECALL", label: "Recall" }, { value: "INBOUND_MISSED", label: "Inbound (missed)" }]} />
                    </Field>
                    <Field label="Outcome" required>
                      <Select name="outcome" required placeholder="Choose…" options={Object.entries(OUTCOME_LABEL).map(([value, label]) => ({ value, label }))} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Notes" className="sm:col-span-2">
                      <Input name="notes" placeholder="What happened on the call / message" />
                    </Field>
                    <Field label="Next follow-up" hint="Leave blank for the default">
                      <Input name="nextFollowupAt" type="datetime-local" min={toIstInputValue(new Date())} />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Checkbox name="firstTimeVerified" label="First-time verified call" />
                    <Submit>Log contact</Submit>
                  </div>
                </ActionForm>
                {(c.stage === "VALIDATED" || c.stage === "MAPPING") && (
                  <ActionForm action={sendLinkAction} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
                    <input type="hidden" name="id" value={c.id} />
                    <span className="mr-1 text-sm text-slate-600">Send enrolment link:</span>
                    <Submit size="sm" variant="secondary" name="channel" value="WHATSAPP">WhatsApp</Submit>
                    <Submit size="sm" variant="secondary" name="channel" value="SMS">SMS</Submit>
                    <Submit size="sm" variant="secondary" name="channel" value="EMAIL">Email</Submit>
                  </ActionForm>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Only the lead&apos;s owner, the stage team leader or someone with an open task on this lead can log contact.</p>
            )}
            </div>
            <Table head={["When", "Channel", "Outcome", "By", "Notes", "Next follow-up"]} empty="No contact attempts yet.">
              {attempts.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(a.at)}</Td>
                  <Td className="whitespace-nowrap">
                    {humanize(a.channel)}
                    {a.direction !== "OUTBOUND" && <div className="text-xs text-slate-400">{humanize(a.direction)}</div>}
                  </Td>
                  <Td>
                    <Badge tone={a.outcome === "ENROLLED" ? "green" : a.outcome === "NOT_INTERESTED" ? "red" : a.outcome === "UNANSWERED" ? "slate" : "amber"}>{OUTCOME_LABEL[a.outcome]}</Badge>
                    {a.isFirstTimeVerifiedCall && <div className="mt-0.5 text-xs text-slate-400">First-time verified</div>}
                    {a.linkSent && <div className="mt-0.5 text-xs text-slate-400">Link sent</div>}
                  </Td>
                  <Td className="whitespace-nowrap">{a.byUser?.name ?? "System"}</Td>
                  <Td className="max-w-xs">{a.notes ?? <span className="text-slate-300">—</span>}</Td>
                  <Td className="whitespace-nowrap">{a.nextFollowupAt ? formatDateTime(a.nextFollowupAt) : <span className="text-slate-300">—</span>}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title="Submissions, interviews & offers" pad={false}>
            <Table head={["Vacancy", "Submitted", "Decision", "Interview", "Offer / joining"]} empty="Not submitted to any vacancy yet.">
              {submissions.map((s) => {
                const iv = s.interviews[0];
                const offer = s.offers[0];
                return (
                  <tr key={s.id}>
                    <Td>
                      <Link href={`/vacancies/${s.vacancy.id}`} className="font-medium text-brand-600 hover:underline">{s.vacancy.title}</Link>
                      <div className="text-xs text-slate-500">{s.vacancy.code} · {s.vacancy.clientOrg.name}</div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(s.submittedAt)}
                      <div className="text-xs text-slate-400">{s.isNtSource ? "NT" : "Non-NT"}{s.matchScore !== null ? ` · match ${Math.round(s.matchScore)}` : ""}</div>
                    </Td>
                    <Td><Badge tone={DECISION_TONE[s.decision]}>{humanize(s.decision)}</Badge></Td>
                    <Td className="whitespace-nowrap">
                      {iv ? (
                        <>
                          {formatDateTime(iv.scheduledAt)}
                          <div className="text-xs text-slate-500">{humanize(iv.mode)} · {humanize(iv.status)}{iv.result !== "PENDING" ? ` · ${humanize(iv.result)}` : ""}</div>
                          {s.interviews.length > 1 && <div className="text-xs text-slate-400">+{s.interviews.length - 1} earlier</div>}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {offer ? (
                        <>
                          Offer {formatDate(offer.sentAt)}
                          <div className="text-xs text-slate-500">
                            {offer.acceptedAt ? `Accepted ${formatDate(offer.acceptedAt)}` : offer.declinedAt ? `Declined ${formatDate(offer.declinedAt)}` : "Awaiting response"}
                            {offer.joiningDate ? ` · joining ${formatDate(offer.joiningDate)}` : ""}
                          </div>
                          {offer.joining && (
                            <div className="text-xs text-slate-500">
                              Joined {formatDate(offer.joining.joinedAt)}
                              {offer.joining.retained7dAt && " · day 7 ✓"}
                              {offer.joining.retained30dAt && " · day 30 ✓"}
                              {offer.joining.leftAt && ` · left ${formatDate(offer.joining.leftAt)}`}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Card>

          <Card title="Stage history">
            {history.length ? (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500 ring-1 ring-slate-200" />
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {h.fromStage && (
                        <>
                          <StageBadge stage={h.fromStage} />
                          <span className="text-slate-400">→</span>
                        </>
                      )}
                      <StageBadge stage={h.toStage} />
                      <span className="text-xs text-slate-500">
                        {formatDateTime(h.at)} · {h.byUser?.name ?? (h.bySystem ? `System (${h.bySystem})` : "System")}
                        {h.byUser && h.bySystem ? ` via ${h.bySystem}` : ""}
                      </span>
                    </div>
                    {h.note && <p className="mt-1 text-sm text-slate-600">{h.note}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-400">No history.</p>
            )}
          </Card>

          <Card title="Messages sent" pad={false}>
            <Table head={["When", "Channel", "To", "Template", "Status"]} empty="No messages sent.">
              {messages.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(m.createdAt)}</Td>
                  <Td>{humanize(m.channel)}</Td>
                  <Td className="font-mono text-xs whitespace-nowrap">{m.toAddress}</Td>
                  <Td>
                    {m.templateKey ?? <span className="text-slate-300">—</span>}
                    <div className="max-w-xs truncate text-xs text-slate-400" title={m.body}>{m.subject ?? m.body}</div>
                  </Td>
                  <Td>
                    <Badge tone={MSG_TONE[m.status]}>{humanize(m.status)}</Badge>
                    {m.error && <div className="max-w-xs truncate text-xs text-red-500" title={m.error}>{m.error}</div>}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>

          {showAudit && (
            <Card title="Audit log" pad={false}>
              <Table head={["When", "Who", "Action", "Details"]} empty="No audit entries.">
                {audits.map((a) => (
                  <tr key={a.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(a.at)}</Td>
                    <Td className="whitespace-nowrap">{a.actorLabel ?? "—"}</Td>
                    <Td><Badge>{humanize(a.action)}</Badge></Td>
                    <Td className="max-w-md">
                      {a.diff ? <code className="block truncate text-xs text-slate-500" title={JSON.stringify(a.diff)}>{JSON.stringify(a.diff)}</code> : <span className="text-slate-300">—</span>}
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {showStagePanel && (
            <Card title="Move stage">
              {targets.length === 0 ? (
                <p className="text-sm text-slate-500">{STAGE_LABEL[c.stage]} is a terminal stage.</p>
              ) : (
                <div className="space-y-4">
                  {targets.map((rule) => {
                    const to = rule.to;
                    const isNext = NEXT_STAGE[c.stage] === to;
                    const isExit = EXIT_STAGES.includes(to);
                    return (
                      <ActionForm
                        key={to}
                        action={transitionAction}
                        resetOnSuccess
                        confirm={isExit ? `Move ${c.name} to ${STAGE_LABEL[to]}? This ends the life cycle for this lead.` : undefined}
                        className={`rounded-lg border p-3 ${isNext ? "border-brand-200 bg-brand-50/40" : "border-slate-200"}`}
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="to" value={to} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">{isNext ? "Next" : "Exit"}</span>
                          <StageBadge stage={to} />
                          {rule.performer === "stage_leader" && <Badge tone="violet">Leader sign-off</Badge>}
                        </div>
                        {rule.description && <p className="mt-1.5 text-xs text-slate-500">{rule.description}</p>}
                        <div className="mt-2 space-y-2">
                          {to === "DROPPED" && (
                            <Select name="dropReason" required placeholder="Drop reason…" options={DROP_REASONS} />
                          )}
                          {to === "QUALIFIED" ? (
                            <Textarea name="tlRemark" rows={2} placeholder="TL remark (verification)" defaultValue={c.tlRemarks ?? ""} />
                          ) : (
                            <Input name="note" placeholder={to === "DUPLICATE" ? "Original record (code)" : to === "INVALID" ? "Reason" : "Note (optional)"} required={to === "DUPLICATE" || to === "INVALID"} />
                          )}
                          <Submit size="sm" variant={isNext ? "success" : "secondary"}>
                            {to === "QUALIFIED" && c.stage === "ENROLLED" ? "Verify & qualify" : `Move to ${STAGE_LABEL[to]}`}
                          </Submit>
                        </div>
                      </ActionForm>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          <Card title="Contact details">
            <SideDl
              items={[
                ["Mobile", c.mobile ? <a href={`tel:+91${c.mobile}`} className="text-brand-600 hover:underline">{formatMobile(c.mobile)}</a> : null],
                ["Alternate mobile", c.altMobile ? formatMobile(c.altMobile) : null],
                ["Email", c.email ? <a href={`mailto:${c.email}`} className="break-all text-brand-600 hover:underline">{c.email}</a> : null],
              ]}
            />
            <p className="mt-3 text-xs text-slate-400">Viewing contact details is recorded in the access log.</p>
          </Card>

          <Card title="Files">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-600">Resume</div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {c.resumeFileKey ? (
                    <a href={fileHref(c.resumeFileKey)} target="_blank" rel="noreferrer" className="max-w-full truncate text-sm text-brand-600 hover:underline">
                      {c.resumeFileName ?? "Download resume"}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">None uploaded</span>
                  )}
                </div>
                {canEdit && (
                  <div className="mt-2">
                    <FileUpload leadId={c.id} kind="resume" label={c.resumeFileKey ? "Replace resume" : "Upload resume"} accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" maxBytes={fileLimits.resumeBytes} />
                    <p className="mt-1 text-xs text-slate-400">PDF, DOC or DOCX · up to 10 MB</p>
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-slate-600">Intro video (1 min)</div>
                {c.introVideoKey ? (
                  <video src={fileHref(c.introVideoKey)} controls preload="none" className="mt-1 w-full rounded-lg bg-slate-900" />
                ) : (
                  <div className="mt-1 text-sm text-slate-400">None uploaded</div>
                )}
                {canEdit && (
                  <div className="mt-2">
                    <FileUpload leadId={c.id} kind="video" label={c.introVideoKey ? "Replace video" : "Upload video"} accept="video/*" maxBytes={fileLimits.videoBytes} />
                    <p className="mt-1 text-xs text-slate-400">About 1 minute · up to 50 MB</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {stageLeader && members.length > 0 && (
            <Card title="Reassign">
              <ActionForm action={reassignAction} className="space-y-2">
                <input type="hidden" name="id" value={c.id} />
                <Select
                  name="toUserId"
                  required
                  defaultValue={c.ownerUserId ?? ""}
                  placeholder="Choose team member…"
                  options={members.map((m) => ({ value: m.id, label: `${m.name} (${m.teams.join(", ")})` }))}
                />
                <Submit size="sm" variant="secondary">Reassign</Submit>
                <p className="text-xs text-slate-400">Open tasks for the current owner move with the lead.</p>
              </ActionForm>
            </Card>
          )}

          <Card title="Open tasks" actions={<Link href="/tasks" className="text-xs text-brand-600 hover:underline">My tasks →</Link>}>
            {tasks.length ? (
              <ul className="divide-y divide-slate-100">
                {tasks.map((task) => {
                  const overdue = task.dueAt.getTime() <= t;
                  return (
                    <li key={task.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="text-sm text-slate-800">{task.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge tone={overdue ? "red" : "slate"}>{humanize(task.type)}</Badge>
                        <span className={overdue ? "font-medium text-red-600" : ""}>Due {formatDateTime(task.dueAt)}</span>
                        <span>· {task.assignee?.name ?? "Unassigned"}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No open tasks.</p>
            )}
          </Card>

          {can.admin && (
            <Card title="Data deletion (DPDP)">
              {deletionRequests.length > 0 && (
                <ul className="mb-3 space-y-1 text-sm">
                  {deletionRequests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2">
                      <Badge tone={r.status === "COMPLETED" ? "green" : r.status === "REJECTED" ? "slate" : "amber"}>{humanize(r.status)}</Badge>
                      <span className="text-slate-600">{formatDate(r.requestedAt)}{r.requestedVia ? ` · via ${r.requestedVia}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
              {c.anonymizedAt ? (
                <p className="text-sm text-slate-500">This record has already been anonymised.</p>
              ) : deletionRequests.some((r) => r.status === "REQUESTED") ? (
                <p className="text-sm text-slate-500">
                  A request is pending. Process it from <Link href="/admin" className="text-brand-600 hover:underline">Administration</Link>.
                </p>
              ) : (
                <ActionForm action={deletionRequestAction} confirm="Record a data-deletion request for this candidate?" className="space-y-2">
                  <input type="hidden" name="id" value={c.id} />
                  <Select name="requestedVia" placeholder="Requested via…" options={[{ value: "Email", label: "Email" }, { value: "Phone", label: "Phone" }, { value: "WhatsApp", label: "WhatsApp" }, { value: "Written letter", label: "Written letter" }, { value: "In person", label: "In person" }]} />
                  <Textarea name="reason" rows={2} placeholder="Reason / reference (optional)" />
                  <Submit size="sm" variant="danger">Record deletion request</Submit>
                </ActionForm>
              )}
            </Card>
          )}

          <Card title="Record">
            <SideDl
              items={[
                ["Created", formatDateTime(c.createdAt)],
                ["Last updated", formatDateTime(c.lastUpdated)],
                ["Enrolled", c.enrolledAt ? formatDateTime(c.enrolledAt) : null],
                ["Scrutinised", c.scrutinizedAt ? formatDateTime(c.scrutinizedAt) : null],
                ["Verified", c.verifiedAt ? formatDateTime(c.verifiedAt) : null],
                ["Drop reason", c.dropReason ? humanize(c.dropReason) : null],
                ["Cold since", c.coldSince ? formatDate(c.coldSince) : null],
                ["Duplicate check", humanize(c.duplicateCheckStatus)],
              ]}
            />
          </Card>
          <div className="text-right">
            <LinkButton href="/leads" size="sm" variant="ghost">Back to leads</LinkButton>
          </div>
        </div>
      </div>
    </>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      {children}
    </div>
  );
}

function SideDl({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="space-y-2.5">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-xs text-slate-500">{k}</dt>
          <dd className="min-w-0 text-right text-sm text-slate-900">{v === null || v === undefined || v === "" ? <span className="text-slate-300">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}
