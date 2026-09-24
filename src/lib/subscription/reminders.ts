import { query } from "@/lib/db/client";

export type PendingReminderCandidate = {
  subscriptionId: string;
  businessId: string;
};

/**
 * Claims subscriptions due for a payment reminder — a single conditional
 * UPDATE that doubles as both the eligibility filter and the claim, so two
 * overlapping or retried cron runs can never both claim (and thus never
 * both email) the same subscription (FR-005). No RLS/service-role concern
 * on this stack — this route already gates on CRON_SECRET before calling
 * this function, and every write here goes through the same single
 * Postgres pool every other query uses.
 */
export async function claimDueReminders(
  thresholdDays: number
): Promise<PendingReminderCandidate[]> {
  const rows = await query<{ id: string; business_id: string }>(
    `update subscriptions
       set reminder_sent_at = now()
       where status = 'pending'
         and reminder_sent_at is null
         and created_at < now() - ($1 || ' days')::interval
       returning id, business_id`,
    [thresholdDays]
  );

  return rows.map((row) => ({
    subscriptionId: row.id,
    businessId: row.business_id,
  }));
}
