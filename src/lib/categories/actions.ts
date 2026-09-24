"use server";

import { auth } from "@/lib/auth/auth.config";
import { query, queryOne } from "@/lib/db/client";
import { invalidateMenuCache } from "@/lib/menu/cache";
import { getSubscriptionAccess } from "@/lib/subscription/access-gate";
import { DISPLAY_LANGUAGES, type DisplayLanguage, type SourceLanguage } from "@/lib/menu/types";
import { hashCategoryName } from "./hash";
import { translateText } from "@/lib/deepl/client";
import type { OwnerCategory } from "./types";

// Reject reason shared by every action below when the caller's subscription
// is locked (spec FR-012, specs/032-unified-subscription-lifecycle).
const LOCKED_REASON = "subscription-locked";

export type SaveCategoryInput = {
  id?: string;
  name: string;
};

/**
 * Translate-on-save (FR-011/FR-011a/FR-012/FR-013): for each display
 * language other than one matching the business's source language, skip
 * languages whose category_translations row already matches the current
 * name's hash, and upsert the rest — attempted concurrently and awaited in
 * full before saveCategory returns, so a failed language never blocks the
 * others or the category's own save. Returns whether any required language
 * is still missing/stale afterward (FR-013a).
 */
async function applyTranslations(
  categoryId: string,
  businessId: string,
  name: string,
  sourceLanguage: SourceLanguage
): Promise<boolean> {
  const requiredLanguages = DISPLAY_LANGUAGES.filter((lang) => lang !== sourceLanguage);
  const currentHash = hashCategoryName(name);

  const existingRows = await query<{ language_code: DisplayLanguage; source_hash: string }>(
    `select language_code, source_hash from category_translations where category_id = $1`,
    [categoryId]
  );
  const existingByLanguage = new Map(existingRows.map((row) => [row.language_code, row.source_hash]));

  const staleLanguages = requiredLanguages.filter(
    (lang) => existingByLanguage.get(lang) !== currentHash
  );

  await Promise.allSettled(
    staleLanguages.map(async (lang) => {
      const result = await translateText(name, lang);
      if (!result.ok) {
        console.error(`saveCategory: translation failed for category ${categoryId} -> ${lang}`);
        return;
      }

      try {
        await query(
          `insert into category_translations (category_id, business_id, language_code, translated_name, source_hash)
             values ($1, $2, $3, $4, $5)
             on conflict (category_id, language_code)
             do update set translated_name = excluded.translated_name,
                            source_hash = excluded.source_hash,
                            translated_at = now()`,
          [categoryId, businessId, lang, result.text, currentHash]
        );
      } catch (err) {
        console.error(`saveCategory: upsert failed for category ${categoryId} -> ${lang}`, err);
      }
    })
  );

  const finalRows = await query<{ language_code: DisplayLanguage; source_hash: string }>(
    `select language_code, source_hash from category_translations where category_id = $1`,
    [categoryId]
  );
  const finalByLanguage = new Map(finalRows.map((row) => [row.language_code, row.source_hash]));

  return requiredLanguages.some((lang) => finalByLanguage.get(lang) !== currentHash);
}

export type SaveCategoryResult =
  | { ok: true; category: OwnerCategory }
  | { ok: false; reason: string };

export async function saveCategory(input: SaveCategoryInput): Promise<SaveCategoryResult> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, reason: "empty-name" };
  }

  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "not-authenticated" };
  }

  const business = await queryOne<{ id: string; slug: string; source_language: SourceLanguage }>(
    `select id, slug, source_language from businesses where owner_id = $1`,
    [session.user.id]
  );
  if (!business) {
    return { ok: false, reason: "no-business" };
  }

  const access = await getSubscriptionAccess(business.id);
  if (!access.full) {
    return { ok: false, reason: LOCKED_REASON };
  }

  if (input.id) {
    const data = await queryOne<{ id: string; name: string; sort_order: number }>(
      `update categories set name = $1 where id = $2 and business_id = $3
         returning id, name, sort_order`,
      [name, input.id, business.id]
    );
    if (!data) {
      return { ok: false, reason: "update-failed" };
    }

    const hasStaleTranslation = await applyTranslations(
      data.id,
      business.id,
      data.name,
      business.source_language
    );

    invalidateMenuCache(business.slug);

    return {
      ok: true,
      category: {
        id: data.id,
        name: data.name,
        sortOrder: data.sort_order,
        itemCount: 0,
        hasStaleTranslation,
      },
    };
  }

  const maxRow = await queryOne<{ sort_order: number }>(
    `select sort_order from categories where business_id = $1 order by sort_order desc limit 1`,
    [business.id]
  );
  const nextSortOrder = maxRow ? maxRow.sort_order + 1 : 0;

  const data = await queryOne<{ id: string; name: string; sort_order: number }>(
    `insert into categories (business_id, name, sort_order) values ($1, $2, $3)
       returning id, name, sort_order`,
    [business.id, name, nextSortOrder]
  );
  if (!data) {
    return { ok: false, reason: "insert-failed" };
  }

  const hasStaleTranslation = await applyTranslations(
    data.id,
    business.id,
    data.name,
    business.source_language
  );

  invalidateMenuCache(business.slug);

  return {
    ok: true,
    category: {
      id: data.id,
      name: data.name,
      sortOrder: data.sort_order,
      itemCount: 0,
      hasStaleTranslation,
    },
  };
}

export type DeleteCategoryInput = {
  id: string;
};

export type DeleteCategoryResult = { ok: true } | { ok: false; reason: string };

export async function deleteCategory(input: DeleteCategoryInput): Promise<DeleteCategoryResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "not-authenticated" };
  }

  const business = await queryOne<{ id: string; slug: string }>(
    `select id, slug from businesses where owner_id = $1`,
    [session.user.id]
  );
  if (!business) {
    return { ok: false, reason: "no-business" };
  }

  const access = await getSubscriptionAccess(business.id);
  if (!access.full) {
    return { ok: false, reason: LOCKED_REASON };
  }

  await query(`delete from categories where id = $1 and business_id = $2`, [input.id, business.id]);

  invalidateMenuCache(business.slug);

  return { ok: true };
}

export type ReorderCategoryInput = {
  id: string;
  direction: "up" | "down";
};

export type ReorderCategoryResult = { ok: true } | { ok: false; reason: "boundary" | string };

export async function reorderCategory(
  input: ReorderCategoryInput
): Promise<ReorderCategoryResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "not-authenticated" };
  }

  const business = await queryOne<{ id: string; slug: string }>(
    `select id, slug from businesses where owner_id = $1`,
    [session.user.id]
  );
  if (!business) {
    return { ok: false, reason: "no-business" };
  }

  const access = await getSubscriptionAccess(business.id);
  if (!access.full) {
    return { ok: false, reason: LOCKED_REASON };
  }

  const categories = await query<{ id: string; sort_order: number }>(
    `select id, sort_order from categories where business_id = $1 order by sort_order asc`,
    [business.id]
  );

  const index = categories.findIndex((category) => category.id === input.id);
  if (index === -1) {
    return { ok: false, reason: "not-found" };
  }

  const neighborIndex = input.direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= categories.length) {
    return { ok: false, reason: "boundary" };
  }

  const current = categories[index];
  const neighbor = categories[neighborIndex];

  await Promise.all([
    query(`update categories set sort_order = $1 where id = $2 and business_id = $3`, [
      neighbor.sort_order,
      current.id,
      business.id,
    ]),
    query(`update categories set sort_order = $1 where id = $2 and business_id = $3`, [
      current.sort_order,
      neighbor.id,
      business.id,
    ]),
  ]);

  invalidateMenuCache(business.slug);

  return { ok: true };
}
