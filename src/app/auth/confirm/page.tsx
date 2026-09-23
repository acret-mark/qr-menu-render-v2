import { ConfirmAccount } from "@/components/auth/confirm-account";

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen w-full flex-1 items-center justify-center bg-muted/30 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-background p-8 text-center shadow-sm">
        <ConfirmAccount token={token ?? null} />
      </div>
    </main>
  );
}
