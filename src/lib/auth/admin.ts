import { auth } from "@/lib/auth/auth.config";

/**
 * Server-side admin-membership check — the FR-003/FR-004/FR-006 guard.
 * A valid Auth.js session alone is never sufficient; `session.user.isAdmin`
 * is derived in auth.config.ts's authorize()/session callbacks from actual
 * `admin_users` table membership, re-checked on every request (no client-
 * cached role, no custom JWT claim trusted on its own).
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return null;
  }
  return session.user;
}
