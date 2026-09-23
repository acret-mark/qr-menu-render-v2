import Link from "next/link";
import { ResendConfirmationButton } from "@/components/auth/resend-confirmation-button";

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className="flex min-h-screen w-full flex-1 items-center justify-center bg-muted/30 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-background p-8 text-center shadow-sm">
        <h1 className="font-heading text-lg font-semibold">Check your email</h1>
        {email ? (
          <>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
              Click it to activate your account.
            </p>
            <ResendConfirmationButton email={email} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t tell which account this is for.
            </p>
            <Link href="/register" className="text-sm text-primary underline-offset-4 hover:underline">
              Back to registration
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
