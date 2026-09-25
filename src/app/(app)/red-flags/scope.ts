import type { Prisma, RedFlag } from "@contracts";
import { canManageRedFlags, leaderTeams, type Actor } from "@/lib/rbac";

/** Coordinator/admin: all flags. Leaders: their teams' flags. Anyone: flags they own the action for. */
export function redFlagScope(a: Actor): Prisma.RedFlagWhereInput {
  if (canManageRedFlags(a)) return {};
  if (a.kind !== "user") return {};
  const lt = leaderTeams(a);
  return { OR: [{ actionOwnerId: a.id }, ...(lt.length ? [{ teamCode: { in: lt } }] : [])] };
}

export function canViewRedFlag(a: Actor, f: Pick<RedFlag, "teamCode" | "actionOwnerId">) {
  if (canManageRedFlags(a)) return true;
  if (a.kind !== "user") return false;
  return f.actionOwnerId === a.id || leaderTeams(a).includes(f.teamCode);
}

export const STATUS_TONE = { OPEN: "red", CAPA_SUGGESTED: "amber", IMPLEMENTED: "blue", CLOSED: "green" } as const;
export const STATUS_LABEL = { OPEN: "Open", CAPA_SUGGESTED: "CAPA suggested", IMPLEMENTED: "Implemented", CLOSED: "Closed" } as const;
