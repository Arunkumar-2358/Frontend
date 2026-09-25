import { api } from "@/lib/api/client";
import { PageHeader, Card, Table, Td, Input, Select, Checkbox } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { deleteRuleAction, saveRuleAction } from "./actions";
import { CATEGORIES } from "../users/options";

export const metadata = { title: "Assignment rules" };

export default async function RulesPage() {
  const { rules, users, teams } = await api("GET /v1/admin/rules");
  const userOpts = users.map((u) => ({ value: u.id, label: u.name }));
  const teamOpts = teams.map((t) => ({ value: t.code, label: t.code }));
  const cls = "py-1 text-xs";

  return (
    <>
      <PageHeader title="Assignment rules" subtitle="Routing of leads to agents when a lead enters a team (e.g. Nursing → Jennifer in Team 1a)." />
      <Card className="mb-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>When a lead enters a team, the active rules for that team and the lead&apos;s <b>category</b> are used; if none match, the team&apos;s <b>category-agnostic</b> rules (blank category) apply.</li>
          <li>The rule with the highest <b>priority</b> wins. If several rules share the top priority (e.g. Doctor → Mounika and Doctor → Shivani), the lead goes to the agent with the <b>fewest open tasks</b>, so load is balanced.</li>
          <li>Inactive rules and deactivated users are skipped. Changes apply to new routing only — existing leads keep their owner.</li>
        </ul>
      </Card>

      <Card pad={false}>
        <Table head={["Team · category · assign to · priority · active", ""]} empty="No rules — leads entering a team stay unassigned.">
          {rules.map((r) => (
            <tr key={r.id} className={r.active ? undefined : "bg-slate-50"}>
              <Td className="p-0">
                <ActionForm action={saveRuleAction} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Select name="teamCode" defaultValue={r.teamCode} options={teamOpts} className={`w-24 ${cls}`} />
                  <Select name="category" defaultValue={r.category ?? ""} placeholder="Any category" options={CATEGORIES} className={`w-36 ${cls}`} />
                  <Select name="userId" defaultValue={r.userId} options={r.user.active ? userOpts : [{ value: r.userId, label: `${r.user.name} (inactive)` }, ...userOpts]} className={`w-40 ${cls}`} />
                  <Input type="number" name="priority" defaultValue={r.priority} className={`w-20 ${cls}`} />
                  <Checkbox name="active" label="Active" defaultChecked={r.active} />
                  <Submit size="sm" variant="secondary">Save</Submit>
                </ActionForm>
              </Td>
              <Td>
                <ActionForm action={deleteRuleAction} confirm="Delete this rule?">
                  <input type="hidden" name="id" value={r.id} />
                  <Submit size="sm" variant="ghost">Delete</Submit>
                </ActionForm>
              </Td>
            </tr>
          ))}
        </Table>
        <div className="border-t border-slate-100 px-3 py-3">
          <div className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Add rule</div>
          <ActionForm action={saveRuleAction} resetOnSuccess className="flex flex-wrap items-center gap-2">
            <Select name="teamCode" required placeholder="Team" options={teamOpts} className={`w-24 ${cls}`} />
            <Select name="category" placeholder="Any category" options={CATEGORIES} className={`w-36 ${cls}`} />
            <Select name="userId" required placeholder="Assign to…" options={userOpts} className={`w-40 ${cls}`} />
            <Input type="number" name="priority" defaultValue={0} className={`w-20 ${cls}`} />
            <Checkbox name="active" label="Active" defaultChecked />
            <Submit size="sm">Add rule</Submit>
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
