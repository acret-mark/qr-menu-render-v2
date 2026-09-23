import { query, queryOne } from "@/lib/db/client";
import { getOwnerBusiness } from "@/lib/auth/login";
import { DISPLAY_LANGUAGES, type DisplayLanguage } from "@/lib/menu/types";
import { hashItemDescription } from "./hash";
import type { CategoryOption, ItemFormData, ItemFormItem, OwnerMenuCategory, OwnerMenuItem } from "./types";

export async function getMenuForOwner(
  ownerId: string
): Promise<{ categories: OwnerMenuCategory[]; items: OwnerMenuItem[] }> {
  const business = await queryOne<{ id: string; source_language: string }>(
    `select id, source_language from businesses where owner_id = $1`,
    [ownerId]
  );
  if (!business) {
    return { categories: [], items: [] };
  }

  const [categoryRows, itemRows] = await Promise.all([
    query<{ id: string; name: string; sort_order: number }>(
      `select id, name, sort_order from categories where business_id = $1 order by sort_order asc`,
      [business.id]
    ),
    query<{
      id: string;
      category_id: string;
      name: string;
      price: string;
      description: string | null;
      photo_url: string | null;
      is_sold_out: boolean;
      is_best_seller: boolean;
    }>(
      `select id, category_id, name, price, description, photo_url, is_sold_out, is_best_seller
         from items where business_id = $1 order by sort_order asc`,
      [business.id]
    ),
  ]);

  const categories: OwnerMenuCategory[] = categoryRows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
  }));

  const itemIds = itemRows.map((row) => row.id);
  const translationRows = itemIds.length
    ? await query<{ item_id: string; language_code: DisplayLanguage; source_hash: string }>(
        `select item_id, language_code, source_hash from item_translations where item_id = any($1::uuid[])`,
        [itemIds]
      )
    : [];

  const translationsByItem = new Map<string, Map<DisplayLanguage, string>>();
  for (const row of translationRows) {
    if (!translationsByItem.has(row.item_id)) {
      translationsByItem.set(row.item_id, new Map());
    }
    translationsByItem.get(row.item_id)!.set(row.language_code, row.source_hash);
  }

  const requiredLanguages = DISPLAY_LANGUAGES.filter((lang) => lang !== business.source_language);

  const items: OwnerMenuItem[] = itemRows.map((row) => {
    const description = (row.description ?? "").trim();
    let hasStaleTranslation = false;

    if (description) {
      const currentHash = hashItemDescription(description);
      const existingForItem = translationsByItem.get(row.id);
      hasStaleTranslation = requiredLanguages.some(
        (lang) => existingForItem?.get(lang) !== currentHash
      );
    }

    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      price: Number(row.price),
      photoUrl: row.photo_url,
      isSoldOut: row.is_sold_out,
      isBestSeller: row.is_best_seller,
      hasStaleTranslation,
    };
  });

  return { categories, items };
}

export async function getItemFormData(ownerId: string, itemId?: string): Promise<ItemFormData> {
  const business = await getOwnerBusiness(ownerId);
  if (!business) {
    return { categories: [], item: null };
  }

  const categoryRows = await query<{ id: string; name: string }>(
    `select id, name from categories where business_id = $1 order by sort_order asc`,
    [business.id]
  );
  const categories: CategoryOption[] = categoryRows.map((row) => ({ id: row.id, name: row.name }));

  if (!itemId) {
    return { categories, item: null };
  }

  const itemRow = await queryOne<{
    id: string;
    name: string;
    category_id: string;
    price: string;
    description: string | null;
    photo_url: string | null;
    is_displayed: boolean;
    is_sold_out: boolean;
    is_best_seller: boolean;
    description_source: "ai_generated" | "manual" | null;
    ai_keywords: string[] | null;
  }>(
    `select id, name, category_id, price, description, photo_url, is_displayed, is_sold_out,
            is_best_seller, description_source, ai_keywords
       from items where id = $1 and business_id = $2`,
    [itemId, business.id]
  );

  if (!itemRow) {
    return { categories, item: null };
  }

  const item: ItemFormItem = {
    id: itemRow.id,
    name: itemRow.name,
    categoryId: itemRow.category_id,
    price: Number(itemRow.price),
    description: itemRow.description ?? "",
    photoUrl: itemRow.photo_url,
    isDisplayed: itemRow.is_displayed,
    isSoldOut: itemRow.is_sold_out,
    isBestSeller: itemRow.is_best_seller,
    descriptionSource: itemRow.description_source,
    aiKeywords: itemRow.ai_keywords,
  };

  return { categories, item };
}
