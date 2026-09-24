import { queryOne } from "@/lib/db/client";
import { graceDeadline, isWithinGrace } from "./expiry";

export type SubscriptionAccess = { full: true } | { full: false; lockedSince: string };

/**
 * Shared server-side read-only-lock check for the Unified Subscription
 * Lifecycle (specs/032-unified-subscription-lifecycle). Every owner-
 * dashboard mutation that must be blocked when locked (menu/category/item
 * edit actions, QR upload, any Pro-tier feature entry point) calls this
 * rather than re-deriving the grace-period math itself, so the gate and the
 * cron (src/app/api/cron/subscription-expiry/route.ts) can never drift
 * apart on what "locked" means.
 *
 * Reads the business's most recent subscription row and applies the exact
 * FR-011/FR-012 gate condition: `status IN ('trial','active') AND now() <=
 * expires_at + grace_period` -> full access; otherwise locked.
 *
 * Read-only: never writes businesses/subscriptions. Only the cron
 * transitions a subscription into the locked state.
 */
export async function getSubscriptionAccess(businessId: string): Promise<SubscriptionAccess> {
  const subscription = await queryOne<{ status: string; expires_at: string | null }>(
    `select status, expires_at from subscriptions
       where business_id = $1
       order by created_at desc
       limit 1`,
    [businessId]
  );

  const now = new Date();

  if (
    !subscription ||
    !subscription.expires_at ||
    (subscription.status !== "trial" && subscription.status !== "active")
  ) {
    // No subscription row (should not normally occur post-backfill) or a
    // status this feature's gate doesn't consider live (pending/expired/
    // cancelled). Locked, with "now" as the best available lockedSince
    // signal — there is no expires_at to derive a real grace deadline from.
    return {
      full: false,
      lockedSince: subscription?.expires_at
        ? graceDeadline(subscription.expires_at).toISOString()
        : now.toISOString(),
    };
  }

  if (isWithinGrace(subscription.expires_at, now)) {
    return { full: true };
  }

  return { full: false, lockedSince: graceDeadline(subscription.expires_at).toISOString() };
}
