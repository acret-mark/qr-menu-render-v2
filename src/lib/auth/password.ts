import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { query, queryOne } from "@/lib/db/client";

const BCRYPT_ROUNDS = 12;
const SESSION_IDLE_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function sessionExpiryFromNow(): Date {
  return new Date(Date.now() + SESSION_IDLE_DAYS * 24 * 60 * 60 * 1000);
}

export type SessionRow = {
  id: string;
  session_token: string;
  user_id: string;
  expires: Date;
};

/** Called from auth.config.ts's jwt callback on initial sign-in. */
export async function createSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomUUID();
  await query(
    `insert into sessions (session_token, user_id, expires) values ($1, $2, $3)`,
    [sessionToken, userId, sessionExpiryFromNow()]
  );
  return sessionToken;
}

/**
 * Called from auth.config.ts's session callback on every request. Returns
 * null for a missing/expired row — the caller treats that as "not signed
 * in" even though a JWT cookie may still be present. Sliding the expiry
 * forward here is what gives this a 30-day *idle* timeout rather than a
 * fixed one.
 */
export async function touchSession(sessionToken: string): Promise<SessionRow | null> {
  const row = await queryOne<SessionRow>(
    `update sessions set expires = $2
       where session_token = $1 and expires > now()
       returning id, session_token, user_id, expires`,
    [sessionToken, sessionExpiryFromNow()]
  );
  return row;
}

/** Single sign-out — deletes just this session's row. */
export async function revokeSession(sessionToken: string): Promise<void> {
  await query(`delete from sessions where session_token = $1`, [sessionToken]);
}

/**
 * Deletes every session row for a user — e.g. on password change, so a
 * stolen-but-not-yet-noticed session cookie stops working immediately
 * rather than sliding along for up to another 30 days.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await query(`delete from sessions where user_id = $1`, [userId]);
}
