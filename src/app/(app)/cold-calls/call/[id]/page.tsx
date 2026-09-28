import { notFound } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { formatMobile } from "@contracts/shared/phone";
import { PageHeader, Card, Empty, StageBadge, LinkButton, btnClass } from "@/components/ui";
import { OutcomeForm } from "../../outcome-form";

export const metadata = { title: "Cold-lead call" };

/** Reveal a cold lead's number for dialling (the API logs it as a PII view), then log the outcome. */
export default async function ColdCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let c;
  try {
    c = await api("GET /v1/cold-calls/{id}/call", { params: { id } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (e instanceof ApiError && (e.status === 403 || e.status === 422)) return <Empty title="No call allocated">{e.message}</Empty>;
    throw e;
  }
  const mobile = c.mobile ?? "";
  const alt = c.altMobile;

  return (
    <>
      <PageHeader title={c.name} subtitle={<span className="inline-flex items-center gap-2">{c.candidateCode} <StageBadge stage={c.stage} /></span>} actions={<LinkButton href="/cold-calls">← Back to cold-lead calls</LinkButton>} />
      <Card className="max-w-md">
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-500">Mobile</div>
            <div className="text-2xl font-semibold tabular-nums text-slate-900">{formatMobile(mobile)}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={`tel:+91${mobile}`} className={btnClass("primary")}>📞 Call now</a>
            <a href={`https://wa.me/91${mobile}`} target="_blank" rel="noopener noreferrer" className={btnClass("secondary")}>Open WhatsApp</a>
          </div>
          {alt && (
            <div>
              <div className="text-xs text-slate-500">Alternate mobile</div>
              <a href={`tel:+91${alt}`} className="text-lg tabular-nums text-brand-700 hover:underline">{formatMobile(alt)}</a>
            </div>
          )}
          <div className="border-t border-slate-100 pt-4">
            <div className="mb-2 text-sm font-medium text-ink">After the call: does the candidate need a job?</div>
            <OutcomeForm candidateId={c.id} />
          </div>
          <p className="text-xs text-slate-400">This view is recorded in the access log.</p>
        </div>
      </Card>
    </>
  );
}
