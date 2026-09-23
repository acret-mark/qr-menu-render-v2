import { queryOne } from "@/lib/db/client";
import type { LatestSubscription, OwnerSubscriptionStatus, SubscriptionPlanType, SubscriptionStatus } from "./types";

export async function getSubscriptionStatusForOwner(
  ownerId: string
): Promise<OwnerSubscriptionStatus | null> {
  const business = await queryOne<{ id: string; plan: OwnerSubscriptionStatus["currentPlan"] }>(
    `select id, plan from businesses where owner_id = $1`,
    [ownerId]
  );
  if (!business) {
    return null;
  }

  const latestRow = await queryOne<{
    id: string;
    plan: string;
    status: string;
    payment_method: string | null;
    created_at: string;
    expires_at: string | null;
  }>(
    `select id, plan, status, payment_method, created_at, expires_at
       from subscriptions where business_id = $1 order by created_at desc limit 1`,
    [business.id]
  );

  return {
    currentPlan: business.plan,
    latest: latestRow
      ? ({
          id: latestRow.id,
          plan: latestRow.plan as SubscriptionPlanType,
          status: latestRow.status as SubscriptionStatus,
          paymentMethod: latestRow.payment_method,
          createdAt: latestRow.created_at,
          expiresAt: latestRow.expires_at,
        } satisfies LatestSubscription)
      : null,
  };
}
