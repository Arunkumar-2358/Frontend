import Link from "next/link";
import { api } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@contracts/shared/dates";
import { formatMobile } from "@contracts/shared/phone";
import { STAGE_LABEL } from "@contracts/shared/lifecycle";
import { PageHeader, Card, Field, Input, Badge, Stat, Dl, humanize, Table, Td } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { changePasswordAction, signOutOtherDevicesAction, updateProfileAction } from "./actions";
import { AppearancePicker } from "./appearance";
import { PushToggle } from "./push";
import { parseThemePref } from "@/lib/theme";

export const metadata = { title: "My profile" };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", data_analyst: "Data analyst", ta_lead: "TA lead", team1_leader: "Team 1 leader", telecaller: "Tele-caller",
  sourcer: "Talent sourcer", team2_leader: "Team 2 leader", recruiter: "Recruiter", team3_leader: "Team 3 leader", ta_coordinator: "TA coordinator",
};

export default async function ProfilePage() {
  const { user, openTasks, overdue, owned, byStage, contactsThisWeek, doneThisWeek, attendance, activity } = await api("GET /v1/me/profile");
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <PageHeader title="My profile" subtitle="Your account, team roles and this week at a glance" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-xl font-semibold text-white">{initials}</div>
              <div>
                <div className="text-lg font-semibold text-ink">{user.name}</div>
                <div className="text-sm text-slate-500">{user.email}</div>
                {user.phone && <div className="text-sm text-slate-500">{formatMobile(user.phone)}</div>}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {user.roles.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <Badge tone="blue">{ROLE_LABEL[r.role] ?? r.role}</Badge>
                  <span className="text-slate-700">{r.team.name}</span>
                  {r.category && <Badge>{humanize(r.category)}</Badge>}
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <Dl items={[["Member since", formatDate(user.createdAt)], ["Last sign-in", user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"]]} />
            </div>
          </Card>

          <Card title="Edit details">
            <ActionForm action={updateProfileAction} className="space-y-3">
              <Field label="Full name" required>
                <Input name="name" defaultValue={user.name} required />
              </Field>
              <Field label="Work mobile" hint="10-digit Indian mobile; +91 is optional">
                <Input name="phone" defaultValue={user.phone ?? ""} inputMode="tel" />
              </Field>
              <Field label="Email" hint="Ask an admin to change your login email">
                <Input value={user.email} disabled readOnly />
              </Field>
              <Submit>Save details</Submit>
            </ActionForm>
          </Card>

          <Card title="Change password">
            <ActionForm action={changePasswordAction} className="space-y-3" resetOnSuccess>
              <Field label="Current password">
                <Input name="current" type="password" autoComplete="current-password" required />
              </Field>
              <Field label="New password" hint="At least 8 characters, letters and numbers">
                <Input name="next" type="password" autoComplete="new-password" required />
              </Field>
              <Field label="Confirm new password">
                <Input name="confirm" type="password" autoComplete="new-password" required />
              </Field>
              <Submit>Update password</Submit>
            </ActionForm>
          </Card>

          <Card title="Signed-in devices">
            <p className="text-sm text-slate-600">Lost a phone or used a shared computer? Sign out everywhere except this device.</p>
            <ActionForm action={signOutOtherDevicesAction} className="mt-3" confirm="Sign out of all other devices? Anyone signed in elsewhere will need to sign in again.">
              <Submit variant="secondary">Sign out of all other devices</Submit>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Appearance" actions={<span className="text-xs text-slate-500">Saved to your account</span>}>
            <AppearancePicker initial={parseThemePref(user.theme)} />
          </Card>

          <Card title="Notifications on this device" actions={<span className="text-xs text-slate-500">Per device, not per account</span>}>
            <PushToggle />
          </Card>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat label="Open tasks" value={openTasks} hint={overdue ? `${overdue} overdue` : "none overdue"} tone={overdue ? "red" : undefined} />
            <Stat label="Leads I own" value={owned} />
            <Stat label="Contacts this week" value={contactsThisWeek} />
            <Stat label="Tasks done this week" value={doneThisWeek} hint={`${attendance} working day${attendance === 1 ? "" : "s"} logged`} />
          </div>

          <Card title="My leads by stage" actions={<Link href="/leads" className="text-sm font-medium text-brand-600 hover:underline">Open talent pool →</Link>}>
            {byStage.length === 0 ? (
              <p className="text-sm text-slate-400">You don&apos;t own any leads right now.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {byStage.map((s) => (
                  <Link key={s.stage} href={`/leads?stage=${s.stage}`} className="rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50">
                    <div className="text-xl font-semibold text-ink tabular-nums">{s.count}</div>
                    <div className="text-xs text-slate-500">{STAGE_LABEL[s.stage]}</div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title="Recent activity" pad={false}>
            <Table head={["When", "Action", "Record"]} empty="No activity yet.">
              {activity.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap text-slate-500">{formatDateTime(a.at)}</Td>
                  <Td>{humanize(a.action)}</Td>
                  <Td>
                    {a.entityType === "candidate" ? (
                      <Link href={`/leads/${a.entityId}`} className="text-brand-600 hover:underline">Lead</Link>
                    ) : a.entityType === "red_flag" ? (
                      <Link href={`/red-flags/${a.entityId}`} className="text-brand-600 hover:underline">Red flag</Link>
                    ) : (
                      humanize(a.entityType.toUpperCase())
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
