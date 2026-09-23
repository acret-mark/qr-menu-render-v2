// Client-safe auth constants — deliberately has zero imports. password.ts
// (and anything it imports, transitively including `pg` via
// src/lib/db/client.ts) must never be imported from a "use client" file;
// this file exists so client components can get MIN_PASSWORD_LENGTH
// without dragging that whole server-only chain into the browser bundle.
export const MIN_PASSWORD_LENGTH = 6;
