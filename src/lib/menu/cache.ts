import { updateTag } from "next/cache";

// Single naming convention for a business's menu-content cache tag, used by
// every read function in queries.ts and every write path that should make
// its effect visible on the public menu near-instantly.
export function menuCacheTag(slug: string): string {
  return `menu:${slug}`;
}

// updateTag, not revalidateTag: Next 16's revalidateTag now defaults to
// stale-while-revalidate semantics (the next request still gets one more
// stale read while fresh data loads in the background), which would mean a
// customer's very next load after an owner's edit could still see the old
// value. updateTag expires the tag immediately and blocks the next request
// for fresh data instead — the "near-immediate for everything" freshness
// target this spec calls for. Its one constraint (callable only from a
// Server Action) is a non-issue here: every write path in this codebase is
// already a Server Action ("use server" at the top of its file) — there is
// no browser-callable DB client on this stack for it to conflict with.
export function invalidateMenuCache(slug: string): void {
  updateTag(menuCacheTag(slug));
}
