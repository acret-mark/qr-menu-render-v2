import { queryOne } from "@/lib/db/client";

export type BusinessStatus = "pending" | "trial" | "active" | "suspended";

export type OwnerBusiness = {
  id: string;
  slug: string;
  status: BusinessStatus;
  name: string;
};

export const LOGIN_PATH = "/login";
export const DASHBOARD_PATH = "/dashboard";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const SUSPENDED_PATH = "/account-suspended";
export const ERROR_PATH = "/error";

const KNOWN_BUSINESS_STATUSES: readonly BusinessStatus[] = [
  "pending",
  "trial",
  "active",
  "suspended",
];

export function isKnownBusinessStatus(status: string): status is BusinessStatus {
  return (KNOWN_BUSINESS_STATUSES as readonly string[]).includes(status);
}

/**
 * Used by the (owner) route-group guard (012-owner-login) — every request
 * re-derives this server-side, never cached client-side (FR-003, FR-011).
 */
export async function getOwnerBusiness(ownerId: string): Promise<OwnerBusiness | null> {
  const row = await queryOne<OwnerBusiness>(
    `select id, slug, status, name from businesses where owner_id = $1`,
    [ownerId]
  );
  return row;
}
