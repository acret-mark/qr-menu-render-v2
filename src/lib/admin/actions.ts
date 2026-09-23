"use server";

import { auth } from "@/lib/auth/auth.config";
import { query, queryOne } from "@/lib/db/client";
import { sendActivationConfirmation } from "@/lib/email/send-activation-confirmation";
import type { PlanType } from "./types";

export type ActivateSubscriptionInput = {
  subscriptionId: string;
  plan: PlanType;
  startsAt: string;
  expiresAt: string;
  businessName: string;
  contactEmail: string | null;
};

export type ActivateSubscriptionResult =
  | { ok: true; alreadyActive: boolean; emailSent: boolean }
  | { ok: false; reason: string };

/**
 * Calls the activate_subscription() Postgres function
 * (db/migrations/0002_subscription_functions.sql — ported from
 * qr-menu-dev's security-definer RPC, with its internal is_admin() guard
 * dropped per Constitution Principle I v3.0.0: the admin check below,
 * before this function is ever called, is now the sole guard). Cache
 * invalidation (specs/016-menu-data-caching) doesn't exist yet on this
 * stack — deliberately omitted here, to be added when that spec lands.
 */
export async function activateSubscription(
  input: ActivateSubscriptionInput
): Promise<ActivateSubscriptionResult> {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return { ok: false, reason: "not-authenticated" };
  }

  let activatedBusinessId: string | null;
  try {
    const result = await queryOne<{ business_id: string }>(
      `select business_id from activate_subscription($1, $2, $3, $4, $5)`,
      [input.subscriptionId, session.user.id, input.plan, input.startsAt, input.expiresAt]
    );
    activatedBusinessId = result?.business_id ?? null;
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "activation-failed" };
  }

  // The function's own conditional `where status = 'pending'` update
  // returns no row when it matched zero — the subscription was already
  // non-pending. Safe no-op per FR-007: no email, no error.
  if (!activatedBusinessId) {
    return { ok: true, alreadyActive: true, emailSent: false };
  }

  const emailResult = await sendActivationConfirmation({
    toEmail: input.contactEmail,
    businessName: input.businessName,
    plan: input.plan,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
  });

  return { ok: true, alreadyActive: false, emailSent: emailResult.ok };
}

export type RejectSubscriptionResult = { ok: true } | { ok: false; reason: string };

/**
 * Single-table conditional update — no function/atomicity concern, no
 * email. Rejection leaves the business exactly as it was.
 */
export async function rejectSubscription(input: {
  subscriptionId: string;
}): Promise<RejectSubscriptionResult> {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return { ok: false, reason: "not-authenticated" };
  }

  try {
    await query(
      `update subscriptions set status = 'cancelled' where id = $1 and status = 'pending'`,
      [input.subscriptionId]
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "reject-failed" };
  }
}
