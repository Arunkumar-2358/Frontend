import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { formatMobile } from "@contracts/shared/phone";
import { formatDateTime } from "@contracts/shared/dates";
import { PageHeader, Card, Empty, LinkButton, btnClass } from "@/components/ui";

export const metadata = { title: "Recall missed call" };

/** Reveal a missed caller's number for dialling (the API logs it as a PII view). */
export default async function RecallCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let mc;
  try {
    mc = await api("GET /v1/missed-calls/{id}/call", { params: { id } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (e instanceof ApiError && e.status === 403) return <Empty title="No access">This missed call is assigned to another tele-caller.</Empty>;
    throw e;
  }
  const { mobile, lead } = mc;

  return (
    <>
      <PageHeader title="Recall missed call" subtitle={`Received ${formatDateTime(mc.receivedAt)}`} actions={<LinkButton href="/missed-calls">← Back to inbox</LinkButton>} />
      <Card className="max-w-md">
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-500">{lead ? <>Caller: <Link href={`/leads/${lead.id}`} className="text-brand-600 hover:underline">{lead.name}</Link> ({lead.candidateCode})</> : "Unknown caller"}</div>
            <div className="text-2xl font-semibold tabular-nums text-slate-900">{formatMobile(mobile)}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={`tel:+91${mobile}`} className={btnClass("primary")}>📞 Call now</a>
            <a href={`https://wa.me/91${mobile}`} target="_blank" rel="noopener noreferrer" className={btnClass("secondary")}>Open WhatsApp</a>
          </div>
          <p className="text-xs text-slate-400">
            Record the result (answered / link sent / enrolled) in the <Link href="/missed-calls" className="text-brand-600 hover:underline">inbox</Link>. This view is recorded in the access log.
          </p>
        </div>
      </Card>
    </>
  );
}
