import Link from "next/link";
import { requireActor } from "@/lib/session";
import { canAccessPath } from "@/lib/nav";
import { hasRole } from "@/lib/rbac";
import { decrypt } from "@/lib/crypto";
import { maskMobile } from "@contracts/shared/phone";
import { formatDate } from "@contracts/shared/dates";
import { globalSearch } from "@/server/search/service";
import { PageHeader, Card, Table, Td, Badge, StageBadge, Empty, humanize, Input, Button, LinkButton } from "@/components/ui";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor();
  const q = (await searchParams).q?.trim() ?? "";
  const roles = actor.roles.map((r) => r.role);
  const canVacancies = canAccessPath("/vacancies", roles);
  const canPeople = hasRole(actor, "admin", "team1_leader", "team2_leader", "team3_leader", "ta_coordinator");
  const r = q ? await globalSearch(actor, q, { vacancies: canVacancies, people: canPeople }) : null;
  const total = r ? r.leadCount + r.vacancyCount + r.clients.length + r.people.length : 0;

  return (
    <>
      <PageHeader title="Search" subtitle={q ? `${total} result${total === 1 ? "" : "s"} for “${q}”` : "Find leads, vacancies, clients and people"} />
      <Card className="mb-6">
        <form className="flex gap-2">
          <Input name="q" defaultValue={q} autoFocus placeholder="Name, NTC code, mobile, email, specialty, city, vacancy, client…" />
          <Button type="submit">Search</Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Tips: a full mobile or email matches exactly · 4 digits match the last 4 of a mobile · several words must all match (e.g. <em>nurse hyderabad</em>).
        </p>
      </Card>

      {!q ? null : total === 0 ? (
        <Empty title="Nothing found">Try fewer words, a candidate code like NTC000123, or the full 10-digit mobile.</Empty>
      ) : (
        <div className="space-y-6">
          {r!.leadCount > 0 && (
            <Card
              title={`Leads · ${r!.leadCount}`}
              pad={false}
              actions={r!.leadCount > r!.leads.length ? <LinkButton size="sm" href={`/leads?q=${encodeURIComponent(q)}`}>See all {r!.leadCount} in Leads →</LinkButton> : undefined}
            >
              <Table head={["Lead", "Category / specialty", "Location", "Mobile", "Stage", "Owner"]}>
                {r!.leads.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <Link href={`/leads/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.name}</Link>
                      <div className="text-xs text-slate-500">{c.candidateCode}</div>
                    </Td>
                    <Td>{[c.mainCategory && humanize(c.mainCategory), c.primarySpecialty].filter(Boolean).join(" · ") || "—"}</Td>
                    <Td>{c.currentLocation ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-slate-500">{maskMobile(decrypt(c.mobileEnc))}</Td>
                    <Td><StageBadge stage={c.stage} cold={c.isCold} /></Td>
                    <Td>{c.owner?.name ?? "Unassigned"}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
          {r!.vacancyCount > 0 && (
            <Card
              title={`Vacancies · ${r!.vacancyCount}`}
              pad={false}
              actions={r!.vacancyCount > r!.vacancies.length ? <LinkButton size="sm" href={`/vacancies?q=${encodeURIComponent(q)}`}>See all in Vacancies →</LinkButton> : undefined}
            >
              <Table head={["Vacancy", "Client", "Location", "CVs", "Posted", "Status"]}>
                {r!.vacancies.map((v) => (
                  <tr key={v.id}>
                    <Td>
                      <Link href={`/vacancies/${v.id}`} className="font-medium text-brand-600 hover:underline">{v.title}</Link>
                      <div className="text-xs text-slate-500">{v.code} · {humanize(v.category)}</div>
                    </Td>
                    <Td>{v.clientOrg.name}</Td>
                    <Td>{v.location}</Td>
                    <Td className="tabular-nums">{v._count.submissions}</Td>
                    <Td className="whitespace-nowrap">{formatDate(v.postedAt)}</Td>
                    <Td><Badge tone={v.status === "OPEN" ? "green" : v.status === "PENDING" ? "amber" : "slate"}>{humanize(v.status)}</Badge></Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
          {r!.clients.length > 0 && (
            <Card title={`Clients · ${r!.clients.length}`} pad={false}>
              <Table head={["Client", "Type", "City", "Vacancies"]}>
                {r!.clients.map((o) => (
                  <tr key={o.id}>
                    <Td><Link href={`/vacancies?org=${o.id}`} className="font-medium text-brand-600 hover:underline">{o.name}</Link></Td>
                    <Td><Badge tone="blue">{humanize(o.type)}</Badge></Td>
                    <Td>{o.city ?? "—"}</Td>
                    <Td className="tabular-nums">{o._count.vacancies}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
          {r!.people.length > 0 && (
            <Card title={`People · ${r!.people.length}`} pad={false}>
              <Table head={["Name", "Email", "Teams & roles"]}>
                {r!.people.map((u) => (
                  <tr key={u.id}>
                    <Td className="font-medium">{u.name}{!u.active && <Badge className="ml-2">Inactive</Badge>}</Td>
                    <Td className="text-slate-500">{u.email}</Td>
                    <Td>{u.roles.map((g) => `${g.team.name.split(" – ")[0]} · ${humanize(g.role.toUpperCase())}`).join(", ")}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
