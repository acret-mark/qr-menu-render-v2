import { randomSlug, slugify } from "./slug";
import { query, queryOne } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { createConfirmationToken } from "@/lib/auth/confirmation";
import { sendConfirmationEmail } from "@/lib/email/send-confirmation-email";
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email";

const MAX_SLUG_ATTEMPTS = 25;
const UNIQUE_VIOLATION = "23505";

export type RegisterOwnerInput = {
  businessName: string;
  email: string;
  password: string;
};

export type RegisterOwnerResult =
  | { ok: true }
  | { ok: false; stage: "duplicate-email" | "business"; message: string };

export const BUSINESS_SETUP_FAILED_MESSAGE =
  "Your account was created, but we couldn't finish setting up your business. Please contact support.";

/**
 * Ported from qr-menu-dev's registerOwner()/createBusinessForOwner(), with
 * one deliberate behavior change: the original deferred business-row
 * creation to /auth/confirm specifically because Supabase's "owners can
 * insert own business" RLS policy needed an authenticated auth.uid() to
 * match against, which didn't exist until the owner had a session. There is
 * no RLS on this stack (Constitution Principle I v3.0.0), so that
 * constraint doesn't apply — the business row (and its welcome email) is
 * created here, at registration time, rather than deferred to confirmation.
 * Login itself is still blocked until the email is confirmed
 * (auth.config.ts's authorize()), so this doesn't change what an
 * unconfirmed owner can actually do.
 */
async function createBusinessForOwner(
  ownerId: string,
  businessName: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const baseSlug = slugify(businessName) || randomSlug();
  let candidate = baseSlug;
  let suffix = 1;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    try {
      await query(
        `insert into businesses (name, slug, owner_id, status, plan)
           values ($1, $2, $3, 'pending', 'standard')`,
        [businessName, candidate, ownerId]
      );
      return { ok: true };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === UNIQUE_VIOLATION) {
        suffix += 1;
        candidate = `${baseSlug}-${suffix}`;
        continue;
      }
      console.error("Failed to create business row for owner", ownerId, err);
      return { ok: false, message: BUSINESS_SETUP_FAILED_MESSAGE };
    }
  }

  console.error("Exhausted slug attempts for owner", ownerId, businessName);
  return { ok: false, message: BUSINESS_SETUP_FAILED_MESSAGE };
}

export async function registerOwner({
  businessName,
  email,
  password,
}: RegisterOwnerInput): Promise<RegisterOwnerResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await queryOne<{ id: string }>(`select id from users where email = $1`, [
    normalizedEmail,
  ]);
  if (existing) {
    return {
      ok: false,
      stage: "duplicate-email",
      message: "An account with this email already exists.",
    };
  }

  const passwordHash = await hashPassword(password);
  const user = await queryOne<{ id: string }>(
    `insert into users (email, password_hash) values ($1, $2) returning id`,
    [normalizedEmail, passwordHash]
  );
  const ownerId = user!.id;

  const businessResult = await createBusinessForOwner(ownerId, businessName);
  if (!businessResult.ok) {
    return { ok: false, stage: "business", message: businessResult.message };
  }

  await sendWelcomeEmail({ toEmail: normalizedEmail, businessName });

  const token = await createConfirmationToken(ownerId);
  await sendConfirmationEmail({ toEmail: normalizedEmail, token });

  return { ok: true };
}
