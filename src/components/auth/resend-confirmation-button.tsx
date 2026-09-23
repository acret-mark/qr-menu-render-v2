"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { resendConfirmationAction } from "@/app/confirm-email/actions";

export function ResendConfirmationButton({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleResend() {
    setStatus("sending");
    setMessage(null);
    const result = await resendConfirmationAction(email);
    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleResend}
        disabled={status === "sending"}
      >
        {status === "sending" ? "Sending…" : "Resend email"}
      </Button>
      {status === "sent" && (
        <span className="text-sm text-muted-foreground">Confirmation email sent.</span>
      )}
      {status === "error" && message && (
        <span className="text-sm text-destructive">{message}</span>
      )}
    </div>
  );
}
