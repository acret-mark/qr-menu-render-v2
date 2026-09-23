import { sendMail } from "./google-smtp-client";

export type SendPasswordResetEmailInput = {
  toEmail: string;
  token: string;
};

export type SendPasswordResetEmailResult = { ok: true } | { ok: false; reason: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Replaces Supabase Auth's built-in "Reset Password" email template
 * (014-password-reset, specs/Hapag-SRS.md §12.11) — same reasoning as
 * send-confirmation-email.ts: our own token in password_reset_tokens,
 * our own /reset-password route, no Supabase Dashboard template involved.
 *
 * Server-only by construction — never import this from a "use client" file.
 */
export async function sendPasswordResetEmail({
  toEmail,
  token,
}: SendPasswordResetEmailInput): Promise<SendPasswordResetEmailResult> {
  const resetUrl = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: toEmail,
    subject: "Reset your Hapag password",
    text: [
      "A password reset was requested for your Hapag account.",
      "",
      `Reset your password here: ${resetUrl}`,
      "",
      "This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.",
    ].join("\n"),
  });
}
