"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestPasswordResetAction } from "@/app/forgot-password/actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);

    if (!email.trim()) {
      setEmailError("Email is required.");
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordResetAction(email.trim());
      // Same acknowledgment regardless of whether the email matched an
      // account (FR-003) — requestPasswordResetAction never reports back
      // which branch it took.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way.
        </p>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          className={cn(
            "h-11 rounded-lg border border-border bg-background px-3.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            emailError && "border-destructive"
          )}
          aria-invalid={!!emailError}
        />
        {emailError && <span className="text-xs text-destructive">{emailError}</span>}
      </div>

      <Button type="submit" size="lg" disabled={submitting} className="mt-2 h-11 w-full">
        {submitting ? "Sending…" : "Send reset link"}
      </Button>

      <div className="mt-2 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </div>
    </form>
  );
}
