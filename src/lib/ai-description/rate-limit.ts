import { queryOne } from "@/lib/db/client";

const DAILY_LIMIT = Number(process.env.AI_DESCRIPTION_DAILY_LIMIT ?? 10);

/**
 * Counts and caps description-generation attempts per item per day
 * (FR-017). Unlike qr-menu-dev, `item_description_generations` genuinely
 * exists on this stack (db/migrations/0001_initial_schema.sql — that table
 * was referenced by this exact code but never actually migrated in the
 * original repo, specs/Hapag-SRS.md §12.10) — no fail-open-on-missing-table
 * handling is needed. A single `insert ... on conflict ... do update ...
 * where` does the check-and-increment atomically, closing the race a
 * separate select-then-update would have under concurrent requests.
 */
export async function checkAndIncrementDailyLimit(
  itemId: string,
  businessId: string
): Promise<{ allowed: boolean }> {
  const row = await queryOne<{ generation_count: number }>(
    `insert into item_description_generations (item_id, business_id, generated_on, generation_count)
       values ($1, $2, current_date, 1)
       on conflict (item_id, generated_on)
       do update set generation_count = item_description_generations.generation_count + 1
       where item_description_generations.generation_count < $3
       returning generation_count`,
    [itemId, businessId, DAILY_LIMIT]
  );

  return { allowed: row !== null };
}
