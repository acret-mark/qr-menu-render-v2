import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * requireAdmin() guard for every route nested under this group
 * (specs/007-admin-login, contracts/require-admin-guard.md). Runs
 * server-side on every request — no session validity check alone is
 * sufficient (FR-003), and standing is re-derived from `admin_users`
 * membership every time (FR-004/FR-006), never cached client-side.
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
