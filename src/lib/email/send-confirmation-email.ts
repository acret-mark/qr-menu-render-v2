import { sendMail } from "./google-smtp-client";

export type SendConfirmationEmailInput = {
  toEmail: string;
  token: string;
};

export type SendConfirmationEmailResult = { ok: true } | { ok: false; reason: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Replaces Supabase Auth's built-in "Confirm signup" email template
 * (013-email-confirmation, specs/Hapag-SRS.md §12.11) — there is no
 * Supabase Dashboard on this stack to configure a template in, so the app
 * generates and sends this email itself, linking to our own
 * /auth/confirm route with our own one-time token instead of Supabase's
 * {{ .TokenHash }}.
 *
 * Server-only by construction — never import this from a "use client" file.
 */
export async function sendConfirmationEmail({
  toEmail,
  token,
}: SendConfirmationEmailInput): Promise<SendConfirmationEmailResult> {
  const confirmUrl = `${SITE_URL}/auth/confirm?token=${encodeURIComponent(token)}`;
  return sendMail({
    to: toEmail,
    subject: "Confirm your Hapag account",
    text: [
      "Thanks for registering with Hapag.",
      "",
      `Confirm your account here: ${confirmUrl}`,
      "",
      "This link expires in 24 hours. If you didn't create this account, you can ignore this email.",
    ].join("\n"),
  });
}
