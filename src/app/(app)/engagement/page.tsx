import Link from "next/link";
import clsx from "clsx";
import type { EngagementTier } from "@contracts";
import { ENGAGEMENT_LABEL, ENGAGEMENT_TIERS } from "@contracts/shared/engagement";
import { formatDate, formatDateTime } from "@contracts/shared/dates";
import { api } from "@/lib/api/client";
import { PageHeader, Card, Table, Td, Badge, Input, Pagination, StageBadge, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { TierBadge } from "@/components/engagement";
import { jobIntentAction, reengageAction } from "./actions";

export const metadata = { title: "Engagement" };

const INTENT: Record<string, { label: string; tone: "green" | "red" | "slate" }> = {
  LOOKING: { label: "needs a job", tone: "green" },
  NOT_LOOKING: { label: "not looking", tone: "red" },
  UNCLEAR: { label: "to review", tone: "slate" },
};

export default async function EngagementPage({ searchParams }: { searchParams: Promise<{ tier?: string; page?: string }> }) {
  const sp = await searchParams;
  const tierParam = (ENGAGEMENT_TIERS as string[]).includes(sp.tier ?? "") ? (sp.tier as EngagementTier) : undefined;
  const { scope, canAct, tier, page, pageSize, total, days, counts, awaitingReply, rows } = await api("GET /v1/engagement", {
    query: { tier: tierParam, page: Math.max(1, Number(sp.page) || 1) },
  });
  const range: Record<EngagementTier, string> = {
    SUPER_ACTIVE: `visited in the last ${days.superActive} days`,
    ACTIVE: `last visit ${days.superActive + 1}–${days.active} days ago`,
    WARM: `last visit ${days.active + 1}–${days.warm} days ago`,
    COLD: `no visit for more than ${days.warm} days`,
  };
  const href = (t?: EngagementTier | null, p?: number) => `/engagement?${new URLSearchParams({ ...(t ? { tier: t } : {}), ...(p && p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Engagement"
        subtitle={`${scope === "all" ? "All enrolled + qualified leads" : "Qualified leads allocated to you"}, by how recently they used the Nextenti platform. Cold leads get a WhatsApp asking if they need a job; a “yes” makes them Super active immediately.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {ENGAGEMENT_TIERS.map((t) => (
          <Link
            key={t}
            href={tier === t ? href() : href(t)}
            className={clsx("rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-brand-300", tier === t ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200")}
          >
            <div className="text-[13px] font-medium tracking-[0.06em] text-ink uppercase">{ENGAGEMENT_LABEL[t]}</div>
            <div className="mt-2 text-[34px] leading-none font-medium text-ink tabular-nums">{counts[t]}</div>
            <div className="mt-3 text-xs text-slate-500">{range[t]}</div>
            {t === "COLD" && awaitingReply > 0 && <div className="mt-1 text-xs font-medium text-amber-600">{awaitingReply} messaged, awaiting reply</div>}
          </Link>
        ))}
      </div>

      <Card
        title={`${tier ? ENGAGEMENT_LABEL[tier] : "All"} leads (${total})`}
        actions={tier && <Link className="text-sm text-brand-600 hover:underline" href={href()}>Show all tiers</Link>}
        pad={false}
      >
        <Table head={["Lead", "Pipeline stage", "Engagement", "WhatsApp", ...(canAct ? ["Action"] : [])]} empty="No leads in this tier.">
          {rows.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link className="font-medium text-brand-600 hover:underline" href={`/leads/${c.id}`}>{c.name}</Link>
                <div className="text-xs text-slate-400">
                  {c.candidateCode}
                  {c.mainCategory ? ` · ${humanize(c.mainCategory)}` : ""}
                  {scope === "all" && c.owner ? ` · ${c.owner.name}` : ""}
                </div>
              </Td>
              <Td className="whitespace-nowrap">
                <StageBadge stage={c.stage} />
              </Td>
              <Td className="whitespace-nowrap">
                <TierBadge tier={c.tier} />
                <div className="mt-1 text-xs text-slate-500">Last active: {formatDate(c.lastEngagedAt) || "never"}</div>
                <div className="text-xs text-slate-400">Platform visit: {formatDate(c.lastPlatformVisitAt) || "none recorded"}</div>
                {c.jobIntentAt && <div className="text-xs text-emerald-600">Needs a job: {formatDate(c.jobIntentAt)}</div>}
              </Td>
              <Td>
                {c.reengageSentAt ? <div className="whitespace-nowrap text-xs">Sent {formatDateTime(c.reengageSentAt)}</div> : <span className="text-xs text-slate-300">not sent</span>}
                {c.lastReply && (
                  <div className="mt-1 max-w-56 text-xs">
                    <Badge tone={INTENT[c.lastReply.intent].tone}>{INTENT[c.lastReply.intent].label}</Badge>
                    <span className="ml-1 text-slate-500" title={c.lastReply.body}>“{c.lastReply.body.length > 60 ? `${c.lastReply.body.slice(0, 57)}…` : c.lastReply.body}”</span>
                  </div>
                )}
              </Td>
              {canAct && (
                <Td>
                  <div className="min-w-56 space-y-2">
                    <ActionForm action={jobIntentAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="candidateId" value={c.id} />
                      <Input name="notes" placeholder="Call notes (optional)" className="w-full py-1 text-xs" />
                      <Submit size="sm" variant="success">Needs a job → Super active</Submit>
                    </ActionForm>
                    {c.tier === "COLD" && (
                      <ActionForm action={reengageAction}>
                        <input type="hidden" name="candidateId" value={c.id} />
                        <Submit size="sm" variant="secondary">{c.reengageSentAt ? "Resend WhatsApp" : "Send WhatsApp now"}</Submit>
                      </ActionForm>
                    )}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Table>
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => href(tier, p)} />
      </Card>
    </>
  );
}
