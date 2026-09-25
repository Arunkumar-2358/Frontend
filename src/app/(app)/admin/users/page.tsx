import { prisma } from "@/lib/db";
import { formatDateTime } from "@contracts/shared/dates";
import { PageHeader, Card, Table, Td, Badge, Field, Input, Select, humanize } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { addGrantAction, createUserAction, removeGrantAction, resetPasswordAction, setActiveAction } from "./actions";
import { CATEGORIES, ROLES, ROLE_LABEL } from "./options";

export const metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const [users, teams] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { roles: { include: { team: true }, orderBy: { team: { code: "asc" } } } } }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
  ]);
  const teamOpts = teams.map((t) => ({ value: t.code, label: `${t.code} · ${t.name}` }));
  const roleOpts = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

  return (
    <>
      <PageHeader title="Users & roles" subtitle={`${users.filter((u) => u.active).length} active of ${users.length} users. A user can hold several team/role grants; the category is their specialisation inside the team (blank = all).`} />

      <Card title="Create user" className="mb-4">
        <ActionForm action={createUserAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required><Input name="name" required /></Field>
          <Field label="Email" required><Input type="email" name="email" required /></Field>
          <Field label="Temporary password" required hint="Min 8 characters; share it securely"><Input type="text" name="password" required minLength={8} autoComplete="off" /></Field>
          <Field label="Phone"><Input name="phone" /></Field>
          <Field label="Team (first grant)"><Select name="team" placeholder="None yet" options={teamOpts} /></Field>
          <Field label="Role"><Select name="role" placeholder="Choose…" options={roleOpts} /></Field>
          <Field label="Category specialisation"><Select name="category" placeholder="All categories" options={CATEGORIES} /></Field>
          <div className="flex items-end"><Submit>Create user</Submit></div>
        </ActionForm>
      </Card>

      <Card pad={false}>
        <Table head={["User", "Grants (team · role · category)", "Add grant", "Status", "Password"]}>
          {users.map((u) => (
            <tr key={u.id} className={u.active ? undefined : "bg-slate-50 text-slate-400"}>
              <Td className="min-w-48">
                <div className="font-medium text-slate-900">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
                <div className="text-xs text-slate-400">{u.lastLoginAt ? `Last login ${formatDateTime(u.lastLoginAt)}` : "Never signed in"}</div>
              </Td>
              <Td className="min-w-64">
                {u.roles.length === 0 && <span className="text-xs text-amber-600">No grants — the user sees only the dashboard</span>}
                <ul className="space-y-1">
                  {u.roles.map((g) => (
                    <li key={g.id} className="flex items-center gap-2">
                      <Badge tone="blue">{g.team.code}</Badge>
                      <span>{ROLE_LABEL[g.role]}</span>
                      {g.category && <Badge>{humanize(g.category)}</Badge>}
                      <ActionForm action={removeGrantAction} confirm={`Remove ${ROLE_LABEL[g.role]} (${g.team.code}) from ${u.name}?`} className="inline">
                        <input type="hidden" name="grantId" value={g.id} />
                        <Submit size="sm" variant="ghost">✕</Submit>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </Td>
              <Td>
                <ActionForm action={addGrantAction} className="flex min-w-96 flex-wrap gap-1">
                  <input type="hidden" name="userId" value={u.id} />
                  <Select name="team" required placeholder="Team" options={teams.map((t) => ({ value: t.code, label: t.code }))} className="w-24 py-1 text-xs" />
                  <Select name="role" required placeholder="Role" options={roleOpts} className="w-36 py-1 text-xs" />
                  <Select name="category" placeholder="All" options={CATEGORIES} className="w-28 py-1 text-xs" />
                  <Submit size="sm" variant="secondary">Add</Submit>
                </ActionForm>
              </Td>
              <Td>
                <ActionForm action={setActiveAction} confirm={u.active ? `Deactivate ${u.name}?` : undefined}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                  {u.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                  <Submit size="sm" variant={u.active ? "ghost" : "secondary"} className="ml-1">{u.active ? "Deactivate" : "Activate"}</Submit>
                </ActionForm>
              </Td>
              <Td>
                <ActionForm action={resetPasswordAction} resetOnSuccess className="flex min-w-56 gap-1">
                  <input type="hidden" name="userId" value={u.id} />
                  <Input name="password" placeholder="New temp password" minLength={8} autoComplete="off" className="py-1 text-xs" />
                  <Submit size="sm" variant="secondary">Set</Submit>
                </ActionForm>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
