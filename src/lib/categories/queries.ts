import { query, queryOne } from "@/lib/db/client";
import { DISPLAY_LANGUAGES, type DisplayLanguage } from "@/lib/menu/types";
import { hashCategoryName } from "./hash";
import type { OwnerCategory } from "./types";

export async function getCategoriesForOwner(ownerId: string): Promise<OwnerCategory[]> {
  const business = await queryOne<{ id: string; source_language: string }>(
    `select id, source_language from businesses where owner_id = $1`,
    [ownerId]
  );
  if (!business) {
    return [];
  }

  const categories = await query<{ id: string; name: string; sort_order: number }>(
    `select id, name, sort_order from categories where business_id = $1 order by sort_order asc`,
    [business.id]
  );
  if (categories.length === 0) {
    return [];
  }

  const requiredLanguages = DISPLAY_LANGUAGES.filter((lang) => lang !== business.source_language);
  const categoryIds = categories.map((c) => c.id);

  const [itemCounts, translationRows] = await Promise.all([
    query<{ category_id: string; item_count: string }>(
      `select category_id, count(*) as item_count from items
         where category_id = any($1::uuid[]) group by category_id`,
      [categoryIds]
    ),
    query<{ category_id: string; language_code: DisplayLanguage; source_hash: string }>(
      `select category_id, language_code, source_hash from category_translations
         where category_id = any($1::uuid[])`,
      [categoryIds]
    ),
  ]);

  const itemCountByCategory = new Map(itemCounts.map((row) => [row.category_id, Number(row.item_count)]));

  const translationsByCategory = new Map<string, Map<DisplayLanguage, string>>();
  for (const row of translationRows) {
    if (!translationsByCategory.has(row.category_id)) {
      translationsByCategory.set(row.category_id, new Map());
    }
    translationsByCategory.get(row.category_id)!.set(row.language_code, row.source_hash);
  }

  return categories.map((category) => {
    const currentHash = hashCategoryName(category.name);
    const existingForCategory = translationsByCategory.get(category.id);
    const hasStaleTranslation = requiredLanguages.some(
      (lang) => existingForCategory?.get(lang) !== currentHash
    );

    return {
      id: category.id,
      name: category.name,
      sortOrder: category.sort_order,
      itemCount: itemCountByCategory.get(category.id) ?? 0,
      hasStaleTranslation,
    };
  });
}
