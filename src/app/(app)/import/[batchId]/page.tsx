import Link from "next/link";
import { notFound } from "next/navigation";
import type { ImportRowStatus, Prisma } from "@contracts";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { formatDateTime } from "@contracts/shared/dates";
import { batchGroups } from "@/server/import/pipeline";
import { PageHeader, Card, Table, Td, Badge, Stat, Empty, Pagination, LinkButton, humanize, btnClass, type Tone } from "@/components/ui";
import { cellText } from "../upload";

export const metadata = { title: "Import report" };

const PAGE_SIZE = 50;
const REJECT_STATUSES: ImportRowStatus[] = ["NEEDS_MAPPING", "DUPLICATE_IN_FILE", "DUPLICATE_IN_DB", "INVALID_MOBILE", "ERROR"];
const STATUS_TONE: Record<ImportRowStatus, Tone> = {
  ACCEPTED: "green",
  NEEDS_MAPPING: "amber",
  DUPLICATE_IN_FILE: "slate",
  DUPLICATE_IN_DB: "slate",
  INVALID_MOBILE: "red",
  ERROR: "red",
};

export default async function ImportBatchPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<{ page?: string; status?: string }> }) {
  const actor = await requireActor();
  if (!hasRole(actor, "data_analyst", "admin", "team1_leader")) return <Empty title="No access">Import reports are for the data analyst, Team 1 leader and admin.</Empty>;
  const { batchId } = await params;
  const sp = await searchParams;
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId }, include: { uploadedBy: { select: { name: true } } } });
  if (!batch) notFound();

  const status = REJECT_STATUSES.includes(sp.status as ImportRowStatus) ? (sp.status as ImportRowStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ImportRowWhereInput = { batchId, status: status ?? { not: "ACCEPTED" } };
  const [groups, rejects, rejectTotal, byStatus] = await Promise.all([
    batchGroups(batchId),
    prisma.importRow.findMany({ where, orderBy: { rowNumber: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.importRow.count({ where }),
    prisma.importRow.groupBy({ by: ["status"], where: { batchId }, _count: true }),
  ]);
  const statusCount = new Map(byStatus.map((s) => [s.status, s._count]));
  const href = (p: { page?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (p.status) qs.set("status", p.status);
    if (p.page && p.page > 1) qs.set("page", String(p.page));
    const s = qs.toString();
    return `/import/${batchId}${s ? `?${s}` : ""}`;
  };
  const totalRejects = batch.totalRows - batch.acceptedRows;

  return (
    <>
      <PageHeader
        title="Import report"
        subtitle={
          <>
            {batch.fileName} · {humanize(batch.source)} · uploaded {formatDateTime(batch.createdAt)} by {batch.uploadedBy?.name ?? "system"}
            {batch.mappingName && <> · mapping “{batch.mappingName}”</>}
            {batch.status !== "COMPLETED" && <> · <Badge tone="amber">{humanize(batch.status)}</Badge></>}
          </>
        }
        actions={
          <>
            <LinkButton href="/import">← All imports</LinkButton>
            {totalRejects > 0 && (
              <a href={`/api/import/rejects/${batchId}`} className={btnClass("secondary")}>Download rejects (.xlsx)</a>
            )}
            {batch.needsMappingRows > 0 && <LinkButton href="/leads?stage=MAPPING" variant="primary">Fix “Needs mapping” leads →</LinkButton>}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total rows" value={batch.totalRows.toLocaleString("en-IN")} />
        <Stat label="Accepted" value={batch.acceptedRows.toLocaleString("en-IN")} tone="green" hint="Now Validated, routed to Team 1" />
        <Stat label="Needs mapping" value={batch.needsMappingRows.toLocaleString("en-IN")} tone={batch.needsMappingRows ? "amber" : undefined} hint="Lead created, missing category / geography" />
        <Stat label="Duplicates" value={batch.duplicateRows.toLocaleString("en-IN")} hint={`${statusCount.get("DUPLICATE_IN_FILE") ?? 0} in file · ${statusCount.get("DUPLICATE_IN_DB") ?? 0} in database`} />
        <Stat label="Invalid" value={batch.invalidRows.toLocaleString("en-IN")} tone={batch.invalidRows ? "red" : undefined} hint={`${statusCount.get("INVALID_MOBILE") ?? 0} bad mobile · ${statusCount.get("ERROR") ?? 0} other`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Leads created — by category, job title and location" pad={false} className="lg:col-span-1">
          <Table head={["Category", "Job title", "Location", "Leads"]} empty="No leads were created from this file.">
            {groups.map((g, i) => (
              <tr key={i}>
                <Td>{g.category ? humanize(g.category) : <span className="text-amber-600">—</span>}</Td>
                <Td>{g.jobTitle ?? <span className="text-slate-300">—</span>}</Td>
                <Td>{g.location ?? <span className="text-amber-600">—</span>}</Td>
                <Td className="tabular-nums font-medium">{g.count}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card
          title={`Rejected / flagged rows (${totalRejects.toLocaleString("en-IN")})`}
          pad={false}
          className="lg:col-span-2"
        >
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
            <Link href={href({})} className={btnClass(status ? "ghost" : "secondary", "sm")}>All</Link>
            {REJECT_STATUSES.map((s) => (
              <Link key={s} href={href({ status: s })} className={btnClass(status === s ? "secondary" : "ghost", "sm")}>
                {humanize(s)} <span className="tabular-nums text-slate-400">{statusCount.get(s) ?? 0}</span>
              </Link>
            ))}
          </div>
          <Table head={["Row", "Status", "Reason", "Raw values"]} empty="No rejected rows — everything was accepted.">
            {rejects.map((r) => {
              const raw = Object.entries((r.raw ?? {}) as Record<string, unknown>).filter(([, v]) => cellText(v).trim() !== "");
              return (
                <tr key={r.id}>
                  <Td className="tabular-nums">{r.rowNumber}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[r.status]}>{humanize(r.status)}</Badge>
                    {r.candidateId && (
                      <div className="mt-1">
                        <Link href={`/leads/${r.candidateId}`} className="text-xs text-brand-600 hover:underline">Open lead</Link>
                      </div>
                    )}
                  </Td>
                  <Td className="max-w-64 text-slate-600">{r.rejectionReason}</Td>
                  <Td className="min-w-64">
                    <div className="space-y-0.5 text-xs">
                      {raw.slice(0, 8).map(([k, v]) => (
                        <div key={k} className="truncate" title={`${k}: ${cellText(v)}`}>
                          <span className="text-slate-400">{k}:</span> {cellText(v)}
                        </div>
                      ))}
                      {raw.length > 8 && <div className="text-slate-400">+{raw.length - 8} more (see download)</div>}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={rejectTotal} hrefFor={(p) => href({ page: p, status })} />
        </Card>
      </div>
    </>
  );
}
