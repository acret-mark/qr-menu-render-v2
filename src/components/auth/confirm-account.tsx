"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmAccountAction, type ConfirmAccountResult } from "@/app/auth/confirm/actions";

export function ConfirmAccount({ token }: { token: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<ConfirmAccountResult["status"] | "loading" | "missing">(
    token ? "loading" : "missing"
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    confirmAccountAction(token).then((result) => {
      if (cancelled) return;
      if (result.status === "ok") {
        router.push("/business-profile");
        router.refresh();
        return;
      }
      setState(result.status);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state === "missing") {
    return (
      <>
        <h1 className="font-heading text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">This confirmation link is incomplete.</p>
        <Link href="/register" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to registration
        </Link>
      </>
    );
  }

  if (state === "loading") {
    return <p className="text-sm text-muted-foreground">Confirming your account…</p>;
  }

  if (state === "invalid") {
    return (
      <>
        <h1 className="font-heading text-lg font-semibold">Link no longer valid</h1>
        <p className="text-sm text-muted-foreground">
          This confirmation link has expired or was already used.
        </p>
        <Link href="/confirm-email" className="text-sm text-primary underline-offset-4 hover:underline">
          Request a new link
        </Link>
      </>
    );
  }

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
