"use server";

import { auth } from "@/lib/auth/auth.config";
import { query, queryOne } from "@/lib/db/client";
import { invalidateMenuCache } from "@/lib/menu/cache";
import { sendActivationConfirmation } from "@/lib/email/send-activation-confirmation";
import type { PlanType, TicketStatus } from "./types";

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
 * before this function is ever called, is now the sole guard). Flips
 * businesses.status to 'active' (specs/005-inactive-menu-state), so the
 * public menu's cache must be invalidated for the affected business
 * (specs/016-menu-data-caching FR-009) — the function itself only returns
 * business_id, so one extra lookup resolves the slug invalidateMenuCache
 * needs.
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

  const activatedBusiness = await queryOne<{ slug: string }>(
    `select slug from businesses where id = $1`,
    [activatedBusinessId]
  );
  if (activatedBusiness) {
    invalidateMenuCache(activatedBusiness.slug);
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

export type ReplyToSupportTicketResult = { ok: true } | { ok: false; reason: "empty-reply" | string };

/**
 * Writes the ticket's single admin reply, overwriting any previous one in
 * place — the schema holds exactly one admin_reply/replied_at pair, never a
 * thread (FR-007). Defaults status to "resolved" unless the caller passes
 * an explicit override (FR-009) — the admin's status control, if set to
 * something else at send time, wins over this default.
 */
export async function replyToSupportTicket(input: {
  ticketId: string;
  reply: string;
  status?: TicketStatus;
}): Promise<ReplyToSupportTicketResult> {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return { ok: false, reason: "not-authenticated" };
  }

  const reply = input.reply.trim();
  if (!reply) {
    return { ok: false, reason: "empty-reply" };
  }

  try {
    await query(
      `update support_tickets set admin_reply = $1, replied_at = now(), status = $2 where id = $3`,
      [reply, input.status ?? "resolved", input.ticketId]
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "reply-failed" };
  }
}

export type SetTicketStatusResult = { ok: true } | { ok: false; reason: string };

/**
 * Status-only update — never touches admin_reply/replied_at (FR-011).
 * Independent of replyToSupportTicket(): usable at any time, e.g. to mark
 * in_progress before any reply exists, or to reopen a resolved ticket.
 */
export async function setTicketStatus(input: {
  ticketId: string;
  status: TicketStatus;
}): Promise<SetTicketStatusResult> {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return { ok: false, reason: "not-authenticated" };
  }

  try {
    await query(`update support_tickets set status = $1 where id = $2`, [
      input.status,
      input.ticketId,
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "status-update-failed" };
  }
}
