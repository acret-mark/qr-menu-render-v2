"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { verifyResetTokenAction, type VerifyResetTokenResult } from "@/app/reset-password/actions";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export function VerifyResetLink({ token }: { token: string | null }) {
  const [state, setState] = useState<VerifyResetTokenResult["status"] | "loading" | "missing">(
    token ? "loading" : "missing"
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyResetTokenAction(token).then((result) => {
      if (!cancelled) setState(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "missing" || state === "invalid") {
    return (
      <>
        <h1 className="font-heading text-lg font-semibold">Link no longer valid</h1>
        <p className="text-sm text-muted-foreground">
          This password reset link has expired or was already used.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Request a new link
        </Link>
      </>
    );
  }

  if (state === "loading") {
    return <p className="text-sm text-muted-foreground">Verifying your link…</p>;
  }

  if (state === "error") {
    return (
      <>
        <h1 className="font-heading text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">Please try again.</p>
        <Link href="." className="text-sm text-primary underline-offset-4 hover:underline">
          Try again
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-heading text-lg font-semibold">Set a new password</h1>
      <ResetPasswordForm token={token as string} />
    </>
  );
}
