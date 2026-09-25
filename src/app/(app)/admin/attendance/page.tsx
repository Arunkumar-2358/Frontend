import { api } from "@/lib/api/client";
import { addDays, formatDate, istDateKey } from "@contracts/shared/dates";
import { PageHeader, Card, Table, Td, Select, Button, LinkButton, Input } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { saveAttendanceAction } from "./actions";

export const metadata = { title: "Attendance" };

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ week?: string; team?: string }> }) {
  const sp = await searchParams;
  const grid = await api("GET /v1/admin/attendance", { query: { week: sp.week, team: sp.team } });
  const { monday, days, users, teams } = grid;
  const team = grid.team ?? undefined;
  const present = new Set(grid.present);
  const recorded = new Set(grid.recorded);
  const link = (w: string) => `/admin/attendance?week=${w}${team ? `&team=${team}` : ""}`;

  return (
    <>
      <PageHeader title="Attendance" subtitle={`"Working days" is the only manual KPI input. Week ${formatDate(monday)} – ${formatDate(addDays(monday, 6))} (Mon–Sun, IST).`} />
      <Card className="mb-4">
        <form action="/admin/attendance" className="flex flex-wrap items-end gap-2">
          <Input type="date" name="week" defaultValue={days[0]} className="w-auto" />
          <Select name="team" defaultValue={team ?? ""} placeholder="All teams" options={teams.map((t) => ({ value: t.code, label: t.name }))} className="w-auto" />
          <Button type="submit" variant="secondary">Show</Button>
          <LinkButton size="sm" href={link(istDateKey(addDays(monday, -7)))}>← Previous week</LinkButton>
          <LinkButton size="sm" href={link(istDateKey(addDays(monday, 7)))}>Next week →</LinkButton>
        </form>
      </Card>
      <ActionForm action={saveAttendanceAction}>
        {days.map((d) => <input key={d} type="hidden" name="d" value={d} />)}
        <Card pad={false}>
          <Table head={["User", ...days.map((d, i) => `${DOW[i]} ${d.slice(8)}-${d.slice(5, 7)}`), "Days"]} empty="No users.">
            {users.map((u) => (
              <tr key={u.id}>
                <Td className="whitespace-nowrap">
                  <input type="hidden" name="u" value={u.id} />
                  <span className="font-medium text-slate-900">{u.name}</span>{" "}
                  <span className="text-xs text-slate-400">{u.teamCodes.join(", ")}</span>
                </Td>
                {days.map((d, i) => {
                  const k = `${u.id}|${d}`;
                  const checked = recorded.has(k) ? present.has(k) : i < 6; // Mon–Sat default present until recorded
                  return (
                    <Td key={d} className={recorded.has(k) ? "text-center" : "bg-amber-50/40 text-center"}>
                      <input type="checkbox" name="p" value={k} defaultChecked={checked} aria-label={`${u.name} ${d}`} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    </Td>
                  );
                })}
                <Td className="text-center tabular-nums">{days.filter((d) => present.has(`${u.id}|${d}`)).length}</Td>
              </tr>
            ))}
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-400">Shaded cells are not recorded yet (pre-ticked Mon–Sat). &quot;Days&quot; counts saved present days.</span>
            <Submit>Save week</Submit>
          </div>
        </Card>
      </ActionForm>
    </>
  );
}
