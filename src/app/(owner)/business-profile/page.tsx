import { auth } from "@/lib/auth/auth.config";

/**
 * Minimal placeholder — real content is 015-business-profile-editing.
 * Exists here only so 013-email-confirmation's post-confirmation redirect
 * (FR-005) has somewhere real, guarded, to land, distinct from the
 * dashboard.
 */
export default async function BusinessProfilePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-heading text-2xl font-semibold">Set up your business</h1>
      <p className="text-muted-foreground">Signed in as {session?.user?.email}.</p>
    </main>
  );
}
