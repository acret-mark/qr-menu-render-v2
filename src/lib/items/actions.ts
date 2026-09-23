"use server";

import { auth } from "@/lib/auth/auth.config";
import { query, queryOne } from "@/lib/db/client";
import { getOwnerBusiness } from "@/lib/auth/login";
import { DISPLAY_LANGUAGES, type DisplayLanguage } from "@/lib/menu/types";
import { hashItemDescription } from "./hash";
import { translateText } from "@/lib/deepl/client";
import { uploadImage } from "@/lib/cloudinary/client";
import { validateLogoFile } from "@/lib/business/logo-validation";
import { generateDescription } from "@/lib/ai-description/client";
import { checkAndIncrementDailyLimit } from "@/lib/ai-description/rate-limit";

// Subscription-lockout check (specs/032-unified-subscription-lifecycle) not
// yet replanned/implemented on this stack — see categories/actions.ts's
// identical note. Ingredients (specs/030-menu-item-ingredients) likewise
// deferred — saveItem() here has no `ingredients` field.

export type SetItemSoldOutInput = {
  id: string;
  isSoldOut: boolean;
};

export type SetItemSoldOutResult = { ok: true } | { ok: false; reason: string };

export async function setItemSoldOut(input: SetItemSoldOutInput): Promise<SetItemSoldOutResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "not-authenticated" };
  }

  const business = await getOwnerBusiness(session.user.id);
  if (!business) {
    return { ok: false, reason: "no-business" };
  }

  await query(`update items set is_sold_out = $1 where id = $2 and business_id = $3`, [
    input.isSoldOut,
    input.id,
    business.id,
  ]);

  return { ok: true };
}

/** Direct port of categories/actions.ts's applyTranslations() onto item_translations. */
async function applyItemDescriptionTranslations(
  itemId: string,
  businessId: string,
  description: string,
  sourceLanguage: string
): Promise<boolean> {
  const requiredLanguages = DISPLAY_LANGUAGES.filter((lang) => lang !== sourceLanguage);

  if (!description.trim()) {
    return false;
  }

  const currentHash = hashItemDescription(description);

  const existingRows = await query<{ language_code: DisplayLanguage; source_hash: string }>(
    `select language_code, source_hash from item_translations where item_id = $1`,
    [itemId]
  );
  const existingByLanguage = new Map(existingRows.map((row) => [row.language_code, row.source_hash]));

  const staleLanguages = requiredLanguages.filter(
    (lang) => existingByLanguage.get(lang) !== currentHash
  );

  await Promise.allSettled(
    staleLanguages.map(async (lang) => {
      const result = await translateText(description, lang);
      if (!result.ok) {
        console.error(`saveItem: translation failed for item ${itemId} -> ${lang}`);
        return;
      }

      try {
        await query(
          `insert into item_translations (item_id, business_id, language_code, translated_description, source_hash)
             values ($1, $2, $3, $4, $5)
             on conflict (item_id, language_code)
             do update set translated_description = excluded.translated_description,
                            source_hash = excluded.source_hash,
                            translated_at = now()`,
          [itemId, businessId, lang, result.text, currentHash]
        );
      } catch (err) {
        console.error(`saveItem: upsert failed for item ${itemId} -> ${lang}`, err);
      }
    })
  );

  const finalRows = await query<{ language_code: DisplayLanguage; source_hash: string }>(
    `select language_code, source_hash from item_translations where item_id = $1`,
    [itemId]
  );
  const finalByLanguage = new Map(finalRows.map((row) => [row.language_code, row.source_hash]));

  return requiredLanguages.some((lang) => finalByLanguage.get(lang) !== currentHash);
}

export type SaveItemInput = {
  id?: string;
  name: string;
  categoryId: string;
  price: number;
  description: string;
  photoUrl: string | null;
  isDisplayed: boolean;
  isSoldOut: boolean;
  isBestSeller: boolean;
  acceptedAiDraft?: { keywords: string[] };
};

export type SaveItemResult = { ok: true; id: string } | { ok: false; reason: string };

function isValidPrice(price: number): boolean {
  if (!Number.isFinite(price) || price < 0) {
    return false;
  }
  return Math.round(price * 100) === price * 100;
}

export async function saveItem(input: SaveItemInput): Promise<SaveItemResult> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, reason: "empty-name" };
  }
  if (!input.categoryId) {
    return { ok: false, reason: "missing-category" };
  }
  if (!isValidPrice(input.price)) {
    return { ok: false, reason: "invalid-price" };
  }

  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "not-authenticated" };
  }

  const business = await queryOne<{ id: string; source_language: string }>(
    `select id, source_language from businesses where owner_id = $1`,
    [session.user.id]
  );
  if (!business) {
    return { ok: false, reason: "no-business" };
  }

  const category = await queryOne<{ id: string }>(
    `select id from categories where id = $1 and business_id = $2`,
    [input.categoryId, business.id]
  );
  if (!category) {
    return { ok: false, reason: "invalid-category" };
  }

  const description = input.description.trim();
  let itemId: string;

  if (input.id) {
    const existing = await queryOne<{
      description: string | null;
      ai_keywords: string[] | null;
      ai_generated_at: string | null;
    }>(
      `select description, ai_keywords, ai_generated_at from items where id = $1 and business_id = $2`,
      [input.id, business.id]
    );
    if (!existing) {
      return { ok: false, reason: "not-found" };
    }

    const descriptionChanged = (existing.description ?? "").trim() !== description;

    const provenance = input.acceptedAiDraft
      ? {
          source: "ai_generated" as const,
          keywords: input.acceptedAiDraft.keywords,
          generatedAt: new Date(),
        }
      : descriptionChanged
        ? { source: "manual" as const, keywords: existing.ai_keywords, generatedAt: existing.ai_generated_at }
        : { source: undefined, keywords: existing.ai_keywords, generatedAt: existing.ai_generated_at };

    const updated = await queryOne<{ id: string }>(
      `update items set name = $1, category_id = $2, price = $3, description = $4, photo_url = $5,
                         is_displayed = $6, is_sold_out = $7, is_best_seller = $8,
                         description_source = coalesce($9, description_source),
                         ai_keywords = $10, ai_generated_at = $11
         where id = $12 and business_id = $13
         returning id`,
      [
        name,
        input.categoryId,
        input.price,
        description || null,
        input.photoUrl,
        input.isDisplayed,
        input.isSoldOut,
        input.isBestSeller,
        provenance.source ?? null,
        provenance.keywords,
        provenance.generatedAt,
        input.id,
        business.id,
      ]
    );
    if (!updated) {
      return { ok: false, reason: "update-failed" };
    }
    itemId = updated.id;
  } else {
    const provenance = input.acceptedAiDraft
      ? { source: "ai_generated" as const, keywords: input.acceptedAiDraft.keywords, generatedAt: new Date() }
      : description
        ? { source: "manual" as const, keywords: null, generatedAt: null }
        : { source: null, keywords: null, generatedAt: null };

    const maxRow = await queryOne<{ sort_order: number }>(
      `select sort_order from items where category_id = $1 order by sort_order desc limit 1`,
      [input.categoryId]
    );
    const nextSortOrder = maxRow ? maxRow.sort_order + 1 : 0;

    const created = await queryOne<{ id: string }>(
      `insert into items (business_id, category_id, name, price, description, photo_url,
                           is_displayed, is_sold_out, is_best_seller,
                           description_source, ai_keywords, ai_generated_at, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         returning id`,
      [
        business.id,
        input.categoryId,
        name,
        input.price,
        description || null,
        input.photoUrl,
        input.isDisplayed,
        input.isSoldOut,
        input.isBestSeller,
        provenance.source,
        provenance.keywords,
        provenance.generatedAt,
        nextSortOrder,
      ]
    );
    if (!created) {
      return { ok: false, reason: "insert-failed" };
    }
    itemId = created.id;
  }

  await applyItemDescriptionTranslations(itemId, business.id, description, business.source_language);

  return { ok: true, id: itemId };
}

export type DeleteItemResult = { ok: true } | { ok: false; reason: string };

export async function deleteItem(input: { id: string }): Promise<DeleteItemResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "not-authenticated" };
  }

  const business = await getOwnerBusiness(session.user.id);
  if (!business) {
    return { ok: false, reason: "no-business" };
  }

  await query(`delete from items where id = $1 and business_id = $2`, [input.id, business.id]);

  return { ok: true };
}

export type UploadItemPhotoResult = { ok: true; photoUrl: string } | { ok: false; message: string };

export async function uploadItemPhoto(formData: FormData): Promise<UploadItemPhotoResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "You must be signed in to upload a photo." };
  }

  const business = await getOwnerBusiness(session.user.id);
  if (!business) {
    return { ok: false, message: "Couldn't find your business. Please try again." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "No file was received." };
  }

  const validationError = validateLogoFile(file);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  try {
    const secureUrl = await uploadImage(file, { folder: "items" });
    return { ok: true, photoUrl: secureUrl };
  } catch {
    return { ok: false, message: "The upload failed. Please try again." };
  }
}

export type GenerateItemDescriptionInput = {
  itemId?: string;
  name: string;
  keywords?: string;
};

export type GenerateItemDescriptionResult =
  | { ok: true; text: string }
  | { ok: false; reason: "limit-reached" }
  | { ok: false; reason: "generation-failed" };

export async function generateItemDescription(
  input: GenerateItemDescriptionInput
): Promise<GenerateItemDescriptionResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: "generation-failed" };
  }

  const business = await getOwnerBusiness(session.user.id);
  if (!business) {
    return { ok: false, reason: "generation-failed" };
  }

  if (input.itemId) {
    const { allowed } = await checkAndIncrementDailyLimit(input.itemId, business.id);
    if (!allowed) {
      return { ok: false, reason: "limit-reached" };
    }
  }

  const result = await generateDescription(input.name, input.keywords);

  if (!result.ok) {
    return { ok: false, reason: "generation-failed" };
  }

  return { ok: true, text: result.text };
}
