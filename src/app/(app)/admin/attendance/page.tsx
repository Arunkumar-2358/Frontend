import type { TeamCode } from "@contracts";
import { prisma } from "@/lib/db";
import { now } from "@/lib/clock";
import { addDays, formatDate, fromIstInputValue, istDateKey, startOfIstWeek } from "@contracts/shared/dates";
import { PageHeader, Card, Table, Td, Select, Button, LinkButton, Input } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { saveAttendanceAction } from "./actions";
import { utcDay } from "./days";
import { TEAM_CODES } from "../users/options";

export const metadata = { title: "Attendance" };

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ week?: string; team?: string }> }) {
  const sp = await searchParams;
  const anchor = (sp.week && fromIstInputValue(sp.week)) || now();
  const monday = startOfIstWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => istDateKey(addDays(monday, i)));
  const team = TEAM_CODES.includes(sp.team as TeamCode) ? (sp.team as TeamCode) : undefined;
  const [users, rows, teams] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, roles: { some: team ? { team: { code: team } } : { role: { not: "admin" } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, roles: { select: { team: { select: { code: true } } } } },
    }),
    prisma.attendance.findMany({ where: { date: { gte: utcDay(days[0]), lte: utcDay(days[6]) } } }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
  ]);
  const present = new Set(rows.filter((r) => r.present).map((r) => `${r.userId}|${r.date.toISOString().slice(0, 10)}`));
  const recorded = new Set(rows.map((r) => `${r.userId}|${r.date.toISOString().slice(0, 10)}`));
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
                  <span className="text-xs text-slate-400">{[...new Set(u.roles.map((r) => r.team.code))].join(", ")}</span>
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
