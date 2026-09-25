import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireActor } from "@/lib/session";
import { formatDateTime, formatLakhs } from "@contracts/shared/dates";
import { hasRole } from "@contracts/shared/rbac";
import { PageHeader, Card, Table, Td, Badge, Select, Dl, Progress, Stat, LinkButton, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { bulkMatchAction, calibrateAction, decideSubmissionAction, setStatusAction } from "../actions";
import { fmtMinutes, ORG_TYPE_LABEL, STATUS_TONE, TEAM_LABEL } from "../util";

export const metadata = { title: "Vacancy" };

const DECISION_TONE = { PENDING: "slate", SHORTLISTED: "green", REJECTED: "red" } as const;
const IV_TONE = { SCHEDULED: "blue", ATTENDED: "green", NO_SHOW: "red", CANCELLED: "slate" } as const;

async function load(id: string) {
  try {
    return await api("GET /v1/vacancies/{id}", { params: { id } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export default async function VacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const { vacancy: v, stats, cvMinTeam3bc, matches } = await load(id);
  const settings = { cvMinTeam3bc };
  const canSource = hasRole(actor, "admin", "sourcer", "team2_leader");
  // The CV/consent for an Active-but-not-yet-submitted match hasn't reached Team 3 yet,
  // so only Team 2 (and the coordinator/admin, who can see every lead) get a working link to it.
  const canOpenMatch = canSource || hasRole(actor, "ta_coordinator");
  const canDecide = hasRole(actor, "admin", "recruiter", "team3_leader");
  const canManage = hasRole(actor, "admin", "sourcer", "team2_leader", "recruiter", "team3_leader");
  const bc = v.routedTeam === "T3B" || v.routedTeam === "T3C";
  const pct = Math.round((stats.submissions / Math.max(1, stats.target)) * 100);

  return (
    <>
      <PageHeader
        title={v.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {v.code} · {v.clientOrg.name} <Badge tone={STATUS_TONE[v.status]}>{humanize(v.status)}</Badge>
            {v.addedBefore2pm && <Badge tone="green">added before 2 pm</Badge>}
          </span>
        }
        actions={
          <>
            <LinkButton href="/vacancies">← Vacancies</LinkButton>
            <LinkButton href={`/evaluations/new?vacancyId=${v.id}`}>Scorecard</LinkButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <Dl
            items={[
              ["Client org", <>{v.clientOrg.name} <Badge>{ORG_TYPE_LABEL[v.clientOrg.type]}</Badge></>],
              ["Routed team", TEAM_LABEL[v.routedTeam] ?? v.routedTeam],
              ["Category", humanize(v.category)],
              ["Specialty", v.specialty],
              ["Location", v.location],
              ["Min experience", v.minExperienceYears !== null ? `${v.minExperienceYears} yrs` : null],
              ["CTC range", v.ctcMinLakhs !== null || v.ctcMaxLakhs !== null ? `${formatLakhs(v.ctcMinLakhs) || "—"} – ${formatLakhs(v.ctcMaxLakhs) || "—"}` : null],
              ["Max notice", v.maxNoticeDays !== null ? `${v.maxNoticeDays} days` : null],
              ["Openings", `${v.openingsFilled} filled of ${v.openings}`],
              ["Recruiter", v.recruiter?.name],
              ["Sourcer", v.sourcer?.name],
              ["Posted", formatDateTime(v.postedAt)],
              ["Calibrated", formatDateTime(v.calibratedAt)],
              ["Sourcing completed", formatDateTime(v.sourcingCompletedAt)],
              ["Closed", formatDateTime(v.closedAt)],
            ]}
          />
          {canManage && (
            <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-slate-100 pt-4">
              {!v.calibratedAt && (
                <ActionForm action={calibrateAction}>
                  <input type="hidden" name="vacancyId" value={v.id} />
                  <Submit variant="secondary">Calibrate now</Submit>
                </ActionForm>
              )}
              <ActionForm action={setStatusAction} className="flex gap-2">
                <input type="hidden" name="vacancyId" value={v.id} />
                <Select name="status" defaultValue={v.status} options={["OPEN", "PENDING", "CLOSED"]} className="w-36" />
                <Submit variant="secondary">Change status</Submit>
              </ActionForm>
            </div>
          )}
        </Card>

        <Card title="Sourcing">
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-600">{stats.target}-CV target</span>
                <span className="font-medium tabular-nums">{stats.submissions} / {stats.target}</span>
              </div>
              <Progress value={pct} />
              {bc && (
                <div className="mt-2">
                  <Badge tone={stats.submissions >= settings.cvMinTeam3bc ? "green" : "amber"}>Team 3b/3c minimum ≥{settings.cvMinTeam3bc}: {stats.submissions >= settings.cvMinTeam3bc ? "met" : "not met"}</Badge>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="NT" value={stats.nt} />
              <Stat label="Non-NT" value={stats.nonNt} />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">TAT (minutes)</div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Posting → calibration</dt><dd className="tabular-nums">{fmtMinutes(stats.postToCalibrationMinutes)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Calibration → {stats.target}th CV</dt><dd className="tabular-nums">{fmtMinutes(stats.calibrationToTargetMinutes)}</dd></div>
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-1 font-medium"><dt>Total TAT</dt><dd className="tabular-nums">{fmtMinutes(stats.tatMinutes)}</dd></div>
              </dl>
            </div>
          </div>
        </Card>

        <Card title={`Matching Active leads (${matches.length})`} className="lg:col-span-3" pad={false}>
          {v.status === "CLOSED" ? (
            <p className="p-4 text-sm text-slate-500">This vacancy is closed.</p>
          ) : (
            <ActionForm action={bulkMatchAction}>
              <input type="hidden" name="vacancyId" value={v.id} />
              <p className="px-4 pt-3 text-xs text-slate-500">
                Active {humanize(v.category)} leads not yet submitted, ranked by match score (specialty 30 · experience 20 · location 20 · expected CTC 20 · notice 10). Consent to store &amp; share is required before a CV is submitted.
              </p>
              <Table head={["", "Candidate", "Score", "Breakdown", "Experience", "Expected CTC", "Notice", "Preferred locations", "Source", "Consent"]} empty="No matching Active leads.">
                {matches.map((m) => {
                  const c = m.candidate;
                  return (
                    <tr key={c.id}>
                      <Td>
                        {canSource && <input type="checkbox" name="candidateId" value={c.id} aria-label={`Select ${c.name}`} className="h-4 w-4 rounded border-slate-300" />}
                        <input type="hidden" name={`score_${c.id}`} value={m.score} />
                        <input type="hidden" name={`label_${c.id}`} value={`${c.candidateCode} ${c.name}`} />
                      </Td>
                      <Td>
                        {canOpenMatch ? (
                          <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${c.id}`}>{c.name}</Link>
                        ) : (
                          <span className="font-medium text-slate-700">{c.name}</span>
                        )}
                        <div className="text-xs text-slate-400">{c.candidateCode}{c.primarySpecialty ? ` · ${c.primarySpecialty}` : ""}</div>
                      </Td>
                      <Td><Badge tone={m.score >= 80 ? "green" : m.score >= 50 ? "amber" : "slate"}>{m.score}</Badge></Td>
                      <Td className="whitespace-nowrap text-xs text-slate-500">
                        Spec {m.breakdown.specialty}/30 · Exp {m.breakdown.experience}/20 · Loc {m.breakdown.location}/20 · CTC {m.breakdown.ctc}/20 · Notice {m.breakdown.notice}/10
                      </Td>
                      <Td className="whitespace-nowrap">{c.experienceYears !== null ? `${c.experienceYears} yrs` : "—"}</Td>
                      <Td className="whitespace-nowrap">{formatLakhs(c.expectedCtcLakhs) || "—"}</Td>
                      <Td className="whitespace-nowrap">{c.noticePeriodDays !== null ? `${c.noticePeriodDays} d` : "—"}</Td>
                      <Td className="max-w-48 text-xs">{c.preferredLocations.length ? c.preferredLocations.map((l, i) => `${i + 1}. ${l}`).join(", ") : "—"}</Td>
                      <Td><Badge tone={c.isNtSource ? "violet" : "cyan"}>{c.isNtSource ? "NT" : "Non-NT"}</Badge></Td>
                      <Td>{c.consentRecordStoreShare ? <Badge tone="green">Yes</Badge> : <Badge tone="red">Missing</Badge>}</Td>
                    </tr>
                  );
                })}
              </Table>
              {canSource && matches.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
                  <Submit name="intent" value="submit">Submit CV to recruiter</Submit>
                  <span className="text-sm text-slate-400">or</span>
                  <Select name="channel" defaultValue="WHATSAPP" options={["WHATSAPP", "SMS", "EMAIL"]} className="w-36" aria-label="Invite channel" />
                  <Submit name="intent" value="invite" variant="secondary">Invite to apply</Submit>
                </div>
              )}
            </ActionForm>
          )}
        </Card>

        <Card title={`Submissions (${v.submissions.length})`} className="lg:col-span-3" actions={<Link href="/recruitment" className="text-sm text-brand-600 hover:underline">Recruitment board →</Link>} pad={false}>
          <Table head={["Candidate", "Source", "Submitted", "Match", "Decision", "Interview"]} empty="No CVs submitted yet.">
            {v.submissions.map((s) => {
              const iv = s.interviews[0];
              return (
                <tr key={s.id}>
                  <Td>
                    <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${s.candidate.id}`}>{s.candidate.name}</Link>
                    <div className="text-xs text-slate-400">{s.candidate.candidateCode} · {humanize(s.candidate.stage)}</div>
                  </Td>
                  <Td><Badge tone={s.isNtSource ? "violet" : "cyan"}>{s.isNtSource ? "NT" : "Non-NT"}</Badge></Td>
                  <Td className="whitespace-nowrap">
                    {formatDateTime(s.submittedAt)}
                    <div className="text-xs text-slate-400">{s.submittedBy?.name ?? "System"}</div>
                  </Td>
                  <Td>{s.matchScore ?? "—"}</Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={DECISION_TONE[s.decision]}>{humanize(s.decision)}</Badge>
                    {canDecide && (
                      <div className="mt-1 flex gap-1">
                        <ActionForm action={decideSubmissionAction}>
                          <input type="hidden" name="submissionId" value={s.id} />
                          <input type="hidden" name="vacancyId" value={v.id} />
                          <input type="hidden" name="decision" value="SHORTLISTED" />
                          <Submit size="sm" variant="secondary">Shortlist</Submit>
                        </ActionForm>
                        <ActionForm action={decideSubmissionAction}>
                          <input type="hidden" name="submissionId" value={s.id} />
                          <input type="hidden" name="vacancyId" value={v.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <Submit size="sm" variant="ghost">Reject</Submit>
                        </ActionForm>
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {iv ? (
                      <>
                        <Badge tone={IV_TONE[iv.status]}>{humanize(iv.status)}</Badge>
                        {iv.result !== "PENDING" && <Badge tone={iv.result === "SELECTED" ? "green" : "red"} className="ml-1">{humanize(iv.result)}</Badge>}
                        <div className="text-xs text-slate-400">{formatDateTime(iv.scheduledAt)}</div>
                      </>
                    ) : (
                      <span className="text-slate-300">Not scheduled</span>
                    )}
                    <div><Link href="/recruitment" className="text-xs text-brand-600 hover:underline">Manage →</Link></div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>
    </>
  );
}
