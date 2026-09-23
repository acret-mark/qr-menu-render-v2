import { auth } from "@/lib/auth/auth.config";

/**
 * Placeholder proving the requireOwnerBusiness() guard end-to-end
 * (012-owner-login). Real content is 016-owner-dashboard-shell.
 */
export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Signed in as {session?.user?.email}.</p>
    </main>
  );
}
