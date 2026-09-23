"use server";

import { auth } from "@/lib/auth/auth.config";
import { query, queryOne } from "@/lib/db/client";

export type BusinessProfile = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
};

export type BusinessProfileUpdate = Partial<
  Pick<BusinessProfile, "name" | "contactPhone" | "contactEmail" | "address">
>;

export type UpdateBusinessProfileResult = { ok: true } | { ok: false; message: string };

const UPDATE_FAILED_MESSAGE = "Couldn't save your changes. Please try again.";

export async function getBusinessProfile(ownerId: string): Promise<BusinessProfile | null> {
  const row = await queryOne<{
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    address: string | null;
  }>(
    `select id, slug, name, logo_url, contact_phone, contact_email, address
       from businesses where owner_id = $1`,
    [ownerId]
  );
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    address: row.address,
  };
}

/**
 * A Server Action, unlike qr-menu-dev's client-callable version (a browser
 * Supabase client calling supabase.from(...) directly, RLS-enforced). There
 * is no browser-callable DB client on this stack — every mutation goes
 * through a Server Action instead, same as every other feature ported so
 * far. Re-derives the caller's own business_id from the session rather than
 * trusting a businessId argument, closing what would otherwise be a
 * cross-tenant write path.
 */
export async function updateBusinessProfile(
  updates: BusinessProfileUpdate
): Promise<UpdateBusinessProfileResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: UPDATE_FAILED_MESSAGE };
  }

  const business = await queryOne<{ id: string }>(
    `select id from businesses where owner_id = $1`,
    [session.user.id]
  );
  if (!business) {
    return { ok: false, message: UPDATE_FAILED_MESSAGE };
  }

  try {
    await query(
      `update businesses set name = $1, contact_phone = $2, contact_email = $3, address = $4
         where id = $5`,
      [updates.name, updates.contactPhone, updates.contactEmail, updates.address, business.id]
    );
    return { ok: true };
  } catch {
    return { ok: false, message: UPDATE_FAILED_MESSAGE };
  }
}
