import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { formatDateTime } from "@contracts/shared/dates";
import { hasRole } from "@/lib/rbac";
import { PageHeader, Card, Table, Td, Pagination, LinkButton } from "@/components/ui";

export const metadata = { title: "Scorecards" };

const PAGE_SIZE = 25;

export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [total, evals] = await Promise.all([
    prisma.evaluation.count(),
    prisma.evaluation.findMany({
      include: {
        vacancy: { select: { id: true, code: true, title: true } },
        template: { select: { name: true } },
        candidates: { include: { candidate: { select: { name: true, candidateCode: true } } }, orderBy: { slot: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);
  const creators = await prisma.user.findMany({ where: { id: { in: evals.map((e) => e.createdById).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const creatorName = new Map(creators.map((u) => [u.id, u.name]));
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
                {e.createdById && <div className="text-xs text-slate-400">{creatorName.get(e.createdById)}</div>}
              </Td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/evaluations?page=${p}`} />
      </Card>
    </>
  );
}
