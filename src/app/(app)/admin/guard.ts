import "server-only";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/session";
import { isAdmin, ForbiddenError } from "@/lib/rbac";

/** Pages: redirect non-admins to the dashboard. */
export async function requireAdmin() {
  const actor = await requireActor();
  if (!isAdmin(actor)) redirect("/dashboard?denied=1");
  return actor;
}

/** Server actions: throw a friendly permission error for non-admins. */
export async function adminActor() {
  const actor = await requireActor();
  if (!isAdmin(actor)) throw new ForbiddenError("Only an admin can change this");
  return actor;
}
