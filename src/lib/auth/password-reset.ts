import crypto from "node:crypto";
import { query, queryOne } from "@/lib/db/client";
import { hashPassword, revokeAllSessions } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset-email";

const RESET_TOKEN_TTL_HOURS = 1;

/**
 * Always resolves the same way regardless of whether the email matches an
 * account (FR-003) — the caller never learns which branch ran.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await queryOne<{ id: string; email: string }>(
    `select id, email from users where email = $1`,
    [normalizedEmail]
  );
  if (!user) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await query(
    `insert into password_reset_tokens (user_id, token, expires_at) values ($1, $2, $3)`,
    [user.id, token, expiresAt]
  );

  await sendPasswordResetEmail({ toEmail: user.email, token });
}

export type ResetTokenLookup = { valid: true; userId: string } | { valid: false };

export async function lookupResetToken(token: string): Promise<ResetTokenLookup> {
  const row = await queryOne<{ user_id: string }>(
    `select user_id from password_reset_tokens
       where token = $1 and consumed_at is null and expires_at > now()`,
    [token]
  );
  return row ? { valid: true, userId: row.user_id } : { valid: false };
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const lookup = await lookupResetToken(token);
  if (!lookup.valid) {
    return false;
  }

  const passwordHash = await hashPassword(newPassword);
  await query(`update users set password_hash = $2 where id = $1`, [lookup.userId, passwordHash]);
  await query(`update password_reset_tokens set consumed_at = now() where token = $1`, [token]);
  // Same as a password change elsewhere in the app — invalidate every
  // existing session so a stolen-but-unused old session cookie stops
  // working immediately (src/lib/auth/password.ts).
  await revokeAllSessions(lookup.userId);

  return true;
}
