import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { formatMobile } from "@contracts/shared/phone";
import { PageHeader, Card, Empty, StageBadge, LinkButton, btnClass } from "@/components/ui";

export const metadata = { title: "Call lead" };

/** Reveal a lead's number for dialling from a phone (the API logs it as a PII view). */
export default async function CallLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let c;
  try {
    c = await api("GET /v1/queue/{id}/call", { params: { id } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (e instanceof ApiError && e.status === 403) return <Empty title="No access">You can only call leads you own or have a task for.</Empty>;
    throw e;
  }
  const mobile = c.mobile ?? "";
  const alt = c.altMobile;

  return (
    <>
      <PageHeader title={c.name} subtitle={<span className="inline-flex items-center gap-2">{c.candidateCode} <StageBadge stage={c.stage} cold={c.isCold} /></span>} actions={<LinkButton href="/queue">← Back to queue</LinkButton>} />
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
          {c.email && (
            <div>
              <div className="text-xs text-slate-500">Email</div>
              <a href={`mailto:${c.email}`} className="text-brand-700 hover:underline">{c.email}</a>
            </div>
          )}
          <p className="text-xs text-slate-400">
            After the call, log the outcome from your <Link href="/queue" className="text-brand-600 hover:underline">queue</Link>. This view is recorded in the access log.
          </p>
        </div>
      </Card>
    </>
  );
}
