import crypto from "node:crypto";
import { query, queryOne } from "@/lib/db/client";

const CONFIRMATION_TOKEN_TTL_HOURS = 24;

export async function createConfirmationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CONFIRMATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await query(
    `insert into email_confirmation_tokens (user_id, token, expires_at) values ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
  return token;
}

export type ConfirmationTokenLookup =
  | { valid: true; userId: string }
  | { valid: false };

/**
 * Looks up a confirmation token without consuming it — used by
 * auth.config.ts's authorize() (confirmationToken branch) to identify which
 * user to sign in as *before* deciding whether the sign-in itself succeeds.
 * Consumption (marking email_verified, deleting the token) only happens
 * once authorize() has committed to returning that user.
 */
export async function lookupConfirmationToken(token: string): Promise<ConfirmationTokenLookup> {
  const row = await queryOne<{ user_id: string }>(
    `select user_id from email_confirmation_tokens
       where token = $1 and consumed_at is null and expires_at > now()`,
    [token]
  );
  return row ? { valid: true, userId: row.user_id } : { valid: false };
}

export async function consumeConfirmationToken(token: string, userId: string): Promise<void> {
  await query(
    `update email_confirmation_tokens set consumed_at = now() where token = $1`,
    [token]
  );
  await query(`update users set email_verified = now() where id = $1`, [userId]);
}
