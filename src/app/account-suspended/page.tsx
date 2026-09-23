/**
 * Minimal placeholder — real content is 022-trial-expired-suspended. Exists
 * here only so 012-owner-login's guard has somewhere real to redirect to
 * (FR-005, suspended business status).
 */
export default function AccountSuspendedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-heading text-2xl font-semibold">Account suspended</h1>
      <p className="text-muted-foreground">Contact ACRET support to reactivate your account.</p>
    </main>
  );
}
