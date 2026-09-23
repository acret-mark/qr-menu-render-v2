import type { MenuCategory, Translations } from "./types";

// Item names are never translated (dish names are often local/proper nouns
// that don't translate well) — only item descriptions and category names
// have a translation cache on this stack. Ingredient names are omitted
// entirely (specs/030-menu-item-ingredients, deferred) — ingredients are
// always [], so this mapping step is a no-op for them by construction.
export function applyTranslations(
  categories: MenuCategory[],
  translations: Translations
): MenuCategory[] {
  return categories.map((category) => ({
    ...category,
    name: translations.categoryNames[category.id] ?? category.name,
    items: category.items.map((item) => ({
      ...item,
      description: translations.itemDescriptions[item.id] ?? item.description,
      ingredients: item.ingredients.map((ingredient) => ({
        ...ingredient,
        name: translations.ingredientNames[ingredient.id] ?? ingredient.name,
      })),
    })),
  }));
}
