import { requireAdmin } from "@/lib/auth/admin";

/**
 * Placeholder landing page proving the requireAdmin() guard end-to-end
 * (specs/007-admin-login). Real content is 008-business-list.
 */
export default async function AdminHomePage() {
  const admin = await requireAdmin();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="font-heading text-2xl font-semibold">Admin panel</h1>
      <p className="text-muted-foreground">Signed in as {admin?.email}.</p>
    </main>
  );
}
