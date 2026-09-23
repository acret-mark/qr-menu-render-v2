import { query, queryOne } from "@/lib/db/client";
import { getInitialDisplayLanguage } from "./language";
import { applyTranslations } from "./translations";
import type { Business, MenuCategory, MenuItem, Translations, DisplayLanguage } from "./types";

interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  plan: Business["plan"];
  source_language: Business["sourceLanguage"];
}

// Only a business whose status is currently "active" resolves here — pending,
// suspended, and trial all fall through to null, same as a slug that never
// existed at all (specs/005-inactive-menu-state FR-002: the customer MUST NOT
// be able to tell those cases apart). No caching layer (specs/016, deferred).
export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  const row = await queryOne<BusinessRow>(
    `select id, name, slug, logo_url, address, plan, source_language
     from businesses
     where slug = $1 and status = 'active'`,
    [slug]
  );
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    address: row.address,
    plan: row.plan,
    sourceLanguage: row.source_language,
  };
}

interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
}

interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string;
  photo_url: string | null;
  is_sold_out: boolean;
  is_best_seller: boolean;
  sort_order: number;
}

// Ingredients are omitted entirely (specs/030-menu-item-ingredients,
// deferred) — every item's `ingredients` is always `[]`, which the type
// already tolerates harmlessly. Sort order is `sort_order` only — never
// reordered by best-seller status, for any plan (specs/001-sold-out-best-
// seller FR-004: badge-only, no reordering, until Pro pin-to-top is
// separately specified).
export async function getMenuData(businessId: string): Promise<MenuCategory[]> {
  const [categories, items] = await Promise.all([
    query<CategoryRow>(
      `select id, name, sort_order from categories where business_id = $1 order by sort_order asc`,
      [businessId]
    ),
    query<ItemRow>(
      `select id, category_id, name, description, price, photo_url, is_sold_out, is_best_seller, sort_order
       from items
       where business_id = $1 and is_displayed = true
       order by sort_order asc`,
      [businessId]
    ),
  ]);

  const itemsByCategory = new Map<string, MenuItem[]>();
  for (const item of items) {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push({
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      photoUrl: item.photo_url,
      isSoldOut: item.is_sold_out,
      isBestSeller: item.is_best_seller,
      ingredients: [],
    });
    itemsByCategory.set(item.category_id, list);
  }

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      items: itemsByCategory.get(category.id) ?? [],
    }))
    .filter((category) => category.items.length > 0);
}

interface CategoryTranslationRow {
  category_id: string;
  translated_name: string | null;
}

interface ItemTranslationRow {
  item_id: string;
  translated_description: string | null;
}

// Ingredient translations are never queried — ingredients are always []
// (specs/030, deferred), so ingredientNames is always empty; the shape is
// kept for applyTranslations' type.
export async function getTranslations(
  businessId: string,
  language: DisplayLanguage
): Promise<Translations> {
  const [categoryRows, itemRows] = await Promise.all([
    query<CategoryTranslationRow>(
      `select category_id, translated_name from category_translations
       where business_id = $1 and language_code = $2`,
      [businessId, language]
    ),
    query<ItemTranslationRow>(
      `select item_id, translated_description from item_translations
       where business_id = $1 and language_code = $2`,
      [businessId, language]
    ),
  ]);

  const categoryNames: Record<string, string> = {};
  for (const row of categoryRows) {
    if (row.translated_name) categoryNames[row.category_id] = row.translated_name;
  }

  const itemDescriptions: Record<string, string> = {};
  for (const row of itemRows) {
    if (row.translated_description) itemDescriptions[row.item_id] = row.translated_description;
  }

  return { categoryNames, itemDescriptions, ingredientNames: {} };
}

export async function loadDisplayCategories(business: Business): Promise<{
  sourceCategories: MenuCategory[];
  initialLanguage: DisplayLanguage;
  initialCategories: MenuCategory[];
  needsClientProbe: boolean;
}> {
  const sourceCategories = await getMenuData(business.id);

  let initialLanguage: DisplayLanguage = "en";
  let initialCategories = sourceCategories;
  let needsClientProbe = false;

  if (business.plan === "pro") {
    const resolved = await getInitialDisplayLanguage(business.sourceLanguage);
    initialLanguage = resolved.language;
    needsClientProbe = resolved.needsClientProbe;
    if (!resolved.skipTranslation && initialLanguage !== business.sourceLanguage) {
      const translations = await getTranslations(business.id, initialLanguage);
      initialCategories = applyTranslations(sourceCategories, translations);
    }
  }

  return { sourceCategories, initialLanguage, initialCategories, needsClientProbe };
}
