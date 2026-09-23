"use server";

import { queryOne } from "@/lib/db/client";
import { createConfirmationToken } from "@/lib/auth/confirmation";
import { sendConfirmationEmail } from "@/lib/email/send-confirmation-email";

export type ResendConfirmationResult = { ok: true } | { ok: false; message: string };

const WAIT_MESSAGE = "We couldn't resend right now — please wait a moment and try again.";

/**
 * No custom rate-limiting is added here (013-email-confirmation FR-007) —
 * this relies entirely on whatever the underlying send actually does
 * (Gmail SMTP's own account-level send cap). A send failure surfaces as the
 * generic "please wait" message (FR-008); this function still always
 * attempts a new token + send for an existing, unconfirmed account, same
 * shape as before but never reveals whether the email matched an account,
 * mirroring the same non-enumeration posture as password reset.
 */
export async function resendConfirmationAction(email: string): Promise<ResendConfirmationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await queryOne<{ id: string; email: string; email_verified: Date | null }>(
    `select id, email, email_verified from users where email = $1`,
    [normalizedEmail]
  );

  if (!user || user.email_verified) {
    return { ok: true };
  }

  const token = await createConfirmationToken(user.id);
  const result = await sendConfirmationEmail({ toEmail: user.email, token });

  return result.ok ? { ok: true } : { ok: false, message: WAIT_MESSAGE };
}
