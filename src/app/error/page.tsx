/**
 * Minimal placeholder — real content is 023-error-500-state. Exists here
 * only so 012-owner-login's guard has somewhere real to redirect to
 * (missing business row / unrecognized status, FR-010/FR-010a).
 */
export default function ErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-heading text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">Please contact support if this keeps happening.</p>
    </main>
  );
}
