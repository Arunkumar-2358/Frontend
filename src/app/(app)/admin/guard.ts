import "server-only";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/session";
import { FormError } from "@/lib/action";
import { isAdmin } from "@contracts/shared/rbac";

/** Pages: redirect non-admins to the dashboard. (The API enforces admin on every /v1/admin endpoint.) */
export async function requireAdmin() {
  const actor = await requireActor();
  if (!isAdmin(actor)) redirect("/dashboard?denied=1");
  return actor;
}

/** Server actions: a friendly permission error for non-admins, before calling the API. */
export async function adminActor() {
  const actor = await requireActor();
  if (!isAdmin(actor)) throw new FormError("Only an admin can change this");
  return actor;
}
