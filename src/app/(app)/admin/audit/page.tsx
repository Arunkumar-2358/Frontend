import Link from "next/link";
import type { Prisma } from "@contracts";
import { prisma } from "@/lib/db";
import { formatDateTime, fromIstInputValue, addDays } from "@contracts/shared/dates";
import { PageHeader, Card, Table, Td, Badge, Input, Select, Button, LinkButton, Pagination, Field } from "@/components/ui";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
const ACTIONS = ["STAGE_CHANGE", "FIELD_EDIT", "CREATE", "REASSIGN", "VIEW_PII", "LOGIN", "IMPORT", "CONTACT_LOGGED", "MESSAGE_SENT", "REMINDER_SENT", "TASK_CREATED", "TASK_COMPLETED", "JOB_RUN", "RED_FLAG", "SETTING_CHANGE", "DATA_DELETION", "EXPORT"];

type SP = { action?: string; entityType?: string; entityId?: string; actor?: string; from?: string; to?: string; page?: string };

function compact(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = sp.from ? fromIstInputValue(sp.from) : null;
  const to = sp.to ? fromIstInputValue(sp.to) : null;
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.action ? { action: sp.action } : {}),
    ...(sp.entityType ? { entityType: sp.entityType } : {}),
    ...(sp.entityId ? { entityId: sp.entityId.trim() } : {}),
    ...(sp.actor ? (sp.actor.startsWith("system") ? { actorId: null, actorLabel: { contains: sp.actor.replace(/^system:?/, "") } } : { actorId: sp.actor }) : {}),
    ...(from || to ? { at: { ...(from ? { gte: from } : {}), ...(to ? { lt: addDays(to, 1) } : {}) } } : {}),
  };
  const [total, rows, entityTypes, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter((e): e is [string, string] => !!e[1]));
    return `/admin/audit?${u.toString()}`;
  };

  return (
    <>
      <PageHeader title="Audit log" subtitle={`${total.toLocaleString("en-IN")} entries · every stage change, edit, reassignment, PII view and automated action.`} />
      <Card className="mb-4">
        <form action="/admin/audit" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <Field label="Action"><Select name="action" defaultValue={sp.action ?? ""} placeholder="Any" options={ACTIONS} /></Field>
          <Field label="Entity type"><Select name="entityType" defaultValue={sp.entityType ?? ""} placeholder="Any" options={entityTypes.map((e) => ({ value: e.entityType, label: e.entityType }))} /></Field>
          <Field label="Entity id"><Input name="entityId" defaultValue={sp.entityId ?? ""} /></Field>
          <Field label="Actor"><Select name="actor" defaultValue={sp.actor ?? ""} placeholder="Anyone" options={[{ value: "system", label: "System (any)" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} /></Field>
          <Field label="From"><Input type="date" name="from" defaultValue={sp.from ?? ""} /></Field>
          <Field label="To"><Input type="date" name="to" defaultValue={sp.to ?? ""} /></Field>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary">Filter</Button>
            <LinkButton href="/admin/audit" variant="ghost">Reset</LinkButton>
          </div>
        </form>
      </Card>
      <Card pad={false}>
        <Table head={["When (IST)", "Actor", "Action", "Entity", "Diff"]} empty="No entries match.">
          {rows.map((r) => {
            const full = r.diff === null ? "" : JSON.stringify(r.diff, null, 2);
            return (
              <tr key={r.id}>
                <Td className="whitespace-nowrap tabular-nums">{formatDateTime(r.at)}</Td>
                <Td className="whitespace-nowrap">{r.actorLabel ?? r.actorId ?? "—"}</Td>
                <Td><Badge tone={r.action === "VIEW_PII" || r.action === "DATA_DELETION" ? "amber" : r.action === "SETTING_CHANGE" ? "violet" : "slate"}>{r.action}</Badge></Td>
                <Td className="whitespace-nowrap">
                  <Link className="text-brand-600 hover:underline" href={`/admin/audit?entityType=${encodeURIComponent(r.entityType)}&entityId=${encodeURIComponent(r.entityId)}`}>{r.entityType}</Link>
                  <div className="font-mono text-xs text-slate-400">{r.entityId}</div>
                </Td>
                <Td className="max-w-xl">
                  {full.length > 160 ? (
                    <details>
                      <summary className="cursor-pointer font-mono text-xs break-all text-slate-600">{compact(r.diff)}</summary>
                      <pre className="mt-1 max-h-80 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">{full}</pre>
                    </details>
                  ) : (
                    <code className="font-mono text-xs break-all text-slate-600">{compact(r.diff)}</code>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={qs} />
      </Card>
    </>
  );
}
