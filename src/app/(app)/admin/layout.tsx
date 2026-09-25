import { requireAdmin } from "./guard";
import { AdminSubnav } from "./subnav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <AdminSubnav />
      {children}
    </>
  );
}
