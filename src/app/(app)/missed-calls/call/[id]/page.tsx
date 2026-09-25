import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { decrypt } from "@/lib/crypto";
import { formatMobile } from "@contracts/shared/phone";
import { formatDateTime } from "@contracts/shared/dates";
import { logPiiView } from "@/server/candidates/service";
import { PageHeader, Card, Empty, LinkButton, btnClass } from "@/components/ui";

export const metadata = { title: "Recall missed call" };

/** Reveal a missed caller's number for dialling (logged as a PII view). */
export default async function RecallCallPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const mc = await prisma.missedCall.findUnique({ where: { id } });
  if (!mc) notFound();
  const allowed = hasRole(actor, "team1_leader", "admin") || (hasRole(actor, "telecaller") && (mc.assignedToId === actor.id || mc.assignedToId === null));
  if (!allowed) return <Empty title="No access">This missed call is assigned to another tele-caller.</Empty>;

  if (mc.candidateId) await logPiiView(actor, mc.candidateId);
  else await audit(actor, "VIEW_PII", "missed_call", mc.id);
  const mobile = decrypt(mc.fromMobileEnc) ?? "";
  const lead = mc.candidateId ? await prisma.candidate.findUnique({ where: { id: mc.candidateId }, select: { id: true, name: true, candidateCode: true } }) : null;

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
