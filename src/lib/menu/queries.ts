import { unstable_cache } from "next/cache";
import { query, queryOne } from "@/lib/db/client";
import { getInitialDisplayLanguage } from "./language";
import { menuCacheTag } from "./cache";
import { applyTranslations } from "./translations";
import type { Business, MenuCategory, MenuItem, Translations, DisplayLanguage } from "./types";

const CACHE_REVALIDATE_SECONDS = 5;

interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  plan: Business["plan"];
  source_language: Business["sourceLanguage"];
}

// A business whose status is "active" OR "trial" resolves here — pending and
// suspended fall through to null, same as a slug that never existed at all
// (specs/005-inactive-menu-state FR-002).
//
// Widened to include "trial" here per specs/032-unified-subscription-
// lifecycle FR-013: a locked (grace-period-elapsed) business's public menu
// MUST stay fully live — read-only lockout only ever affects the owner
// dashboard's edit actions (access-gate.ts), never what customers see. Since
// this stack has no RLS-based visibility policy to separately widen (unlike
// qr-menu-dev's own "public can read active-or-trial-business rows" RLS
// migration), this one-line filter is the whole mechanism — flagged as a
// "revisit later" item in 005's own replan notes, now resolved here. This
// necessarily also means a still-pending trial that was never locked (a
// business just granted a fresh trial) has a live public menu from the
// start, same as an active business — matching FR-012's "a trial grant is
// not limited to unlocking the owner's own dashboard" framing from
// specs/029 (retired), carried forward by 032.
//
// Cached and tagged per-slug (specs/016) — a 5s safety-net window,
// invalidated near-instantly by every owner/admin write path that touches
// this business (src/lib/menu/cache.ts).
export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  return unstable_cache(
    async () => {
      const row = await queryOne<BusinessRow>(
        `select id, name, slug, logo_url, address, plan, source_language
         from businesses
         where slug = $1 and status in ('active', 'trial')`,
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
    },
    ["business-by-slug", slug],
    { tags: [menuCacheTag(slug)], revalidate: CACHE_REVALIDATE_SECONDS }
  )();
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

interface ItemIngredientRow {
  item_id: string;
  id: string;
  name: string;
}

// Sort order is `sort_order` only — never reordered by best-seller status,
// for any plan (specs/001-sold-out-best-seller FR-004: badge-only, no
// reordering, until Pro pin-to-top is separately specified). `slug` is used
// only for the cache tag below — the query itself is still keyed by
// `businessId`, its real parameter.
export async function getMenuData(businessId: string, slug: string): Promise<MenuCategory[]> {
  return unstable_cache(
    async () => {
      const [categories, items, itemIngredientRows] = await Promise.all([
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
        // Attach order, per FR-011 (030-menu-item-ingredients) — this query
        // is ordered so the grouping below preserves it without re-sorting.
        query<ItemIngredientRow>(
          `select ii.item_id, i.id, i.name
             from item_ingredients ii
             join ingredients i on i.id = ii.ingredient_id
             where ii.business_id = $1
             order by ii.created_at asc`,
          [businessId]
        ),
      ]);

      const ingredientsByItem = new Map<string, { id: string; name: string }[]>();
      for (const row of itemIngredientRows) {
        const list = ingredientsByItem.get(row.item_id) ?? [];
        list.push({ id: row.id, name: row.name });
        ingredientsByItem.set(row.item_id, list);
      }

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
          ingredients: ingredientsByItem.get(item.id) ?? [],
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
    },
    ["menu-data", businessId],
    { tags: [menuCacheTag(slug)], revalidate: CACHE_REVALIDATE_SECONDS }
  )();
}

interface CategoryTranslationRow {
  category_id: string;
  translated_name: string | null;
}

interface ItemTranslationRow {
  item_id: string;
  translated_description: string | null;
}

interface IngredientTranslationRow {
  ingredient_id: string;
  translated_name: string | null;
}

// `slug` is used only for the cache tag — a language switch invalidates
// alongside the rest of the business's menu (one shared tag, specs/016), not
// a separate per-language tag.
export async function getTranslations(
  businessId: string,
  language: DisplayLanguage,
  slug: string
): Promise<Translations> {
  return unstable_cache(
    async () => {
      const [categoryRows, itemRows, ingredientRows] = await Promise.all([
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
        query<IngredientTranslationRow>(
          `select ingredient_id, translated_name from ingredient_translations
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

      const ingredientNames: Record<string, string> = {};
      for (const row of ingredientRows) {
        if (row.translated_name) ingredientNames[row.ingredient_id] = row.translated_name;
      }

      return { categoryNames, itemDescriptions, ingredientNames };
    },
    ["menu-translations", businessId, language],
    { tags: [menuCacheTag(slug)], revalidate: CACHE_REVALIDATE_SECONDS }
  )();
}

export async function loadDisplayCategories(business: Business): Promise<{
  sourceCategories: MenuCategory[];
  initialLanguage: DisplayLanguage;
  initialCategories: MenuCategory[];
  needsClientProbe: boolean;
}> {
  const sourceCategories = await getMenuData(business.id, business.slug);

  let initialLanguage: DisplayLanguage = "en";
  let initialCategories = sourceCategories;
  let needsClientProbe = false;

  if (business.plan === "pro") {
    const resolved = await getInitialDisplayLanguage(business.sourceLanguage);
    initialLanguage = resolved.language;
    needsClientProbe = resolved.needsClientProbe;
    if (!resolved.skipTranslation && initialLanguage !== business.sourceLanguage) {
      const translations = await getTranslations(business.id, initialLanguage, business.slug);
      initialCategories = applyTranslations(sourceCategories, translations);
    }
  }

  return { sourceCategories, initialLanguage, initialCategories, needsClientProbe };
}
