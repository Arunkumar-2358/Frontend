import Link from "next/link";
import { api } from "@/lib/api/client";
import { requireActor } from "@/lib/session";
import { formatDateTime } from "@contracts/shared/dates";
import { hasRole } from "@contracts/shared/rbac";
import { PageHeader, Card, Table, Td, Pagination, LinkButton } from "@/components/ui";

export const metadata = { title: "Scorecards" };

export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const { total, page, pageSize: PAGE_SIZE, evaluations: evals } = await api("GET /v1/evaluations", { query: { page: Math.max(1, Math.floor(Number(sp.page)) || 1) } });
  const canScore = hasRole(actor, "admin", "recruiter", "team3_leader");
  const canEditTemplates = hasRole(actor, "admin", "team3_leader");

  return (
    <>
      <PageHeader
        title="Scorecards"
        subtitle="Weighted interview evaluation — compare up to 3 candidates side by side"
        actions={
          <>
            <LinkButton href="/evaluations/templates">{canEditTemplates ? "Manage templates" : "Templates"}</LinkButton>
            {canScore && <LinkButton href="/evaluations/new" variant="primary">+ New evaluation</LinkButton>}
          </>
        }
      />
      <Card pad={false}>
        <Table head={["Title", "Vacancy", "Template", "Candidates", "Created"]} empty="No evaluations yet.">
          {evals.map((e) => (
            <tr key={e.id}>
              <Td><Link className="font-medium text-brand-600 hover:underline" href={`/evaluations/${e.id}`}>{e.title}</Link></Td>
              <Td>{e.vacancy ? <Link className="hover:underline" href={`/vacancies/${e.vacancy.id}`}>{e.vacancy.code} · {e.vacancy.title}</Link> : <span className="text-slate-300">—</span>}</Td>
              <Td>{e.template.name}</Td>
              <Td className="text-xs">{e.candidates.map((c) => `${c.candidate.name} (${c.candidate.candidateCode})`).join(", ")}</Td>
              <Td className="whitespace-nowrap">
                {formatDateTime(e.createdAt)}
                {e.createdById && <div className="text-xs text-slate-400">{e.creatorName}</div>}
              </Td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/evaluations?page=${p}`} />
      </Card>
    </>
  );
}
