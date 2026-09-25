import { redirect } from "next/navigation";
import { getShell, logout, requireActor } from "@/lib/session";
import { navFor } from "@contracts/shared/access";
import { timeAgo } from "@contracts/shared/ago";
import { AppShell } from "@/components/shell/app-shell";
import { ThemeSync } from "@/components/theme-watcher";
import { parseThemePref } from "@/lib/theme";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  data_analyst: "Data analyst",
  ta_lead: "TA lead",
  team1_leader: "Team 1 leader",
  telecaller: "Tele-caller",
  sourcer: "Talent sourcer",
  team2_leader: "Team 2 leader",
  recruiter: "Recruiter",
  team3_leader: "Team 3 leader",
  ta_coordinator: "TA coordinator",
};

const TEAM_PILL: Record<string, string> = {
  T1A: "Team 1a · TA Leads",
  T1B: "Team 1b · Communication",
  T2: "Team 2 · Sourcing",
  T3A: "Team 3 · Recruitment",
  T3B: "Team 3 · Recruitment",
  T3C: "Team 3 · Recruitment",
  T4: "Team 4 · Data & Quality",
};

async function signOut() {
  "use server";
  await logout();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const roles = [...new Set(actor.roles.map((r) => r.role))];
  const items = navFor(roles);
  const { user: me, overdueTasks: overdue, unread, notifications: recent } = await getShell();
  const groups = [...new Set(items.map((i) => i.group))].map((g) => ({
    group: g,
    items: items
      .filter((i) => i.group === g)
      .map((i) => ({ href: i.href, label: i.label, badge: i.href === "/tasks" && overdue ? overdue : i.href === "/notifications" && unread ? unread : undefined })),
  }));
  const teamPill = roles.includes("admin") ? "Nextenti · Admin" : TEAM_PILL[actor.roles[0]?.team ?? ""] ?? "Nextenti";

  return (
    <AppShell
      groups={groups}
      user={{ name: actor.name, roleText: roles.map((r) => ROLE_LABEL[r] ?? r).join(" · "), teamPill }}
      unread={unread}
      notifications={recent.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.readAt, ago: timeAgo(n.createdAt) }))}
      signOut={signOut}
    >
      <ThemeSync pref={parseThemePref(me.theme)} />
      {children}
    </AppShell>
  );
}
