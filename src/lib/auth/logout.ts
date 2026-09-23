"use server";

import { signOut } from "@/lib/auth/auth.config";
import { LOGIN_PATH } from "@/lib/auth/login";

const ADMIN_LOGIN_PATH = "/admin/login";

// Ported from qr-menu-dev: admin and owner sessions are structurally
// identical (the `sessions` table, no separate auth system for admins) —
// only the post-logout destination differs. Auth.js's signOut() clears the
// JWT cookie; the now-orphaned `sessions` table row is left to its own
// 30-day idle expiry rather than explicitly deleted here (unlike a password
// change, which does call revokeAllSessions() — see src/lib/auth/password.ts
// — a stale row with no valid cookie pointing at it isn't reachable again).
export async function signOutOwner(): Promise<void> {
  await signOut({ redirectTo: LOGIN_PATH });
}

export async function signOutAdmin(): Promise<void> {
  await signOut({ redirectTo: ADMIN_LOGIN_PATH });
}
