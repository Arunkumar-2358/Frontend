import Link from "next/link";
import type { DeletionRequestStatus } from "@contracts";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@contracts/shared/dates";
import { PageHeader, Card, Table, Td, Badge, Input, Pagination, LinkButton } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { processDeletionAction, rejectDeletionAction } from "./actions";

export const metadata = { title: "Data-deletion requests" };

const TONE = { REQUESTED: "amber", COMPLETED: "green", REJECTED: "slate" } as const;

export default async function DeletionsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = (["REQUESTED", "COMPLETED", "REJECTED"] as DeletionRequestStatus[]).find((s) => s === sp.status);
  const { total, rows, page, pageSize: PAGE_SIZE } = await api("GET /v1/admin/deletions", { query: { status, page: Math.max(1, Number(sp.page) || 1) } });

  return (
    <>
      <PageHeader
        title="Data-deletion requests"
        subtitle="DPDP Act: processing anonymises the candidate's personal data (name, contact details, registration number, files, notes, message bodies) while keeping stage and KPI events."
        actions={
          <div className="flex gap-1">
            {[undefined, "REQUESTED", "COMPLETED", "REJECTED"].map((s) => (
              <LinkButton key={s ?? "all"} size="sm" variant={status === s ? "primary" : "secondary"} href={s ? `/admin/deletions?status=${s}` : "/admin/deletions"}>{s ? s.charAt(0) + s.slice(1).toLowerCase() : "All"}</LinkButton>
            ))}
          </div>
        }
      />
      <Card pad={false}>
        <Table head={["Requested", "Candidate", "Via", "Reason", "Status", "Processed", "Action"]} empty="No deletion requests.">
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap">{formatDateTime(r.requestedAt)}</Td>
              <Td>
                <Link href={`/leads/${r.candidate.id}`} className="text-brand-600 hover:underline">{r.candidate.name}</Link> <span className="text-xs text-slate-400">{r.candidate.candidateCode}</span>
              </Td>
              <Td>{r.requestedVia ?? "—"}</Td>
              <Td className="min-w-48">{r.reason ?? "—"}</Td>
              <Td><Badge tone={TONE[r.status]}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge></Td>
              <Td className="whitespace-nowrap text-xs">{r.processedAt ? `${formatDateTime(r.processedAt)} · ${r.processedByName ?? "—"}` : "—"}</Td>
              <Td>
                {r.status === "REQUESTED" ? (
                  <div className="flex min-w-72 flex-col gap-1">
                    <ActionForm action={processDeletionAction} confirm={`Permanently anonymise ${r.candidate.name} (${r.candidate.candidateCode})? This cannot be undone.`}>
                      <input type="hidden" name="id" value={r.id} />
                      <Submit size="sm" variant="danger">Process (anonymise)</Submit>
                    </ActionForm>
                    <ActionForm action={rejectDeletionAction} className="flex gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <Input name="reason" placeholder="Rejection reason" className="py-1 text-xs" />
                      <Submit size="sm" variant="secondary">Reject</Submit>
                    </ActionForm>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/admin/deletions?page=${p}${status ? `&status=${status}` : ""}`} />
      </Card>
    </>
  );
}
