import type { Metadata } from "next";
import { VerifyResetLink } from "@/components/auth/verify-reset-link";

// Auth pages are functional-only and never meant to surface in search
// results (specs/033 FR-009).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen w-full flex-1 items-center justify-center bg-muted/30 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-xl border border-border bg-background p-8 text-center shadow-sm">
        <VerifyResetLink token={token ?? null} />
      </div>
    </main>
  );
}
