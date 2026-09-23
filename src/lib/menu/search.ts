import type { MenuCategory, MenuItem } from "./types";

export interface SearchResult {
  item: MenuItem;
  categoryName: string;
}

// Case-insensitive substring match against item name and description — not
// exact-match, not word-boundary. Checks whichever MenuCategory[] is
// currently active (the caller passes translated categories for the
// current display language), so this naturally follows the Pro-plan
// language toggle without any language-specific branching here. Item name
// is never translated, so name matching is language-independent by
// construction — see translations.ts.
//
// Returns each match paired with its parent category's name (not just the
// bare MenuItem[]) since flattening across categories would otherwise lose
// that association — the detail view needs it to show which category a
// search result belongs to (specs/002-public-menu-home FR-002i).
export function filterItems(categories: MenuCategory[], query: string): SearchResult[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  return categories.flatMap((category) =>
    category.items
      .filter(
        (item) =>
          item.name.toLowerCase().includes(trimmed) ||
          (item.description?.toLowerCase().includes(trimmed) ?? false)
      )
      .map((item) => ({ item, categoryName: category.name }))
  );
}
