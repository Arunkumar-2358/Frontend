import { prisma } from "@/lib/db";
import { now } from "@/lib/clock";
import { istDateKey } from "@contracts/shared/dates";
import { PageHeader, Card, Table, Td, Field, Input, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { addHolidayAction, removeHolidayAction } from "./actions";

export const metadata = { title: "Holidays" };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const show = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;

export default async function HolidaysPage() {
  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });
  const today = istDateKey(now());
  return (
    <>
      <PageHeader title="Holidays" subtitle="Holiday calendar used for the red-flag 1-working-day SLA (Sundays are always non-working)." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Add holiday">
          <ActionForm action={addHolidayAction} resetOnSuccess className="space-y-3">
            <Field label="Date" required><Input type="date" name="date" required /></Field>
            <Field label="Name" required><Input name="name" required placeholder="e.g. Diwali" /></Field>
            <Submit>Add holiday</Submit>
          </ActionForm>
        </Card>
        <Card pad={false} className="lg:col-span-2">
          <Table head={["Date", "Day", "Holiday", ""]} empty="No holidays configured.">
            {holidays.map((h) => {
              const past = h.date.toISOString().slice(0, 10) < today;
              return (
                <tr key={h.id} className={past ? "text-slate-400" : undefined}>
                  <Td className="whitespace-nowrap tabular-nums">{show(h.date)}</Td>
                  <Td>{DOW[h.date.getUTCDay()]}{h.date.getUTCDay() === 0 && <Badge className="ml-1">already off</Badge>}</Td>
                  <Td>{h.name}</Td>
                  <Td>
                    <ActionForm action={removeHolidayAction} confirm={`Remove ${h.name}?`}>
                      <input type="hidden" name="id" value={h.id} />
                      <Submit size="sm" variant="ghost">Remove</Submit>
                    </ActionForm>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>
    </>
  );
}
