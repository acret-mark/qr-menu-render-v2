"use server";

import { auth } from "@/lib/auth/auth.config";
import { query, queryOne } from "@/lib/db/client";
import { uploadImage } from "@/lib/cloudinary/client";
import { validateLogoFile } from "@/lib/business/logo-validation";
import { PLAN_PRICES, type PlanType } from "./types";

const OFFERED_PAYMENT_METHODS = ["gcash", "bank_transfer"] as const;
type OfferedPaymentMethod = (typeof OFFERED_PAYMENT_METHODS)[number];

function isOfferedPaymentMethod(value: FormDataEntryValue | null): value is OfferedPaymentMethod {
  return typeof value === "string" && (OFFERED_PAYMENT_METHODS as readonly string[]).includes(value);
}

export type SubmitSubscriptionPaymentResult = { ok: true } | { ok: false; message: string };

/**
 * Always inserts a new row (FR-007) — never updates an existing one.
 * Subscription-lockout gating (032-unified-subscription-lifecycle) not yet
 * replanned; this action is unconditionally available, matching this
 * spec's own original scope.
 */
export async function submitSubscriptionPayment(
  formData: FormData
): Promise<SubmitSubscriptionPaymentResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "You must be signed in to submit a payment." };
  }

  const business = await queryOne<{ id: string; plan: PlanType }>(
    `select id, plan from businesses where owner_id = $1`,
    [session.user.id]
  );
  if (!business) {
    return { ok: false, message: "Couldn't find your business. Please try again." };
  }

  const paymentMethod = formData.get("paymentMethod");
  if (!isOfferedPaymentMethod(paymentMethod)) {
    return { ok: false, message: "Please choose a payment method." };
  }

  const targetPlan = formData.get("targetPlan");
  if (targetPlan !== "current" && targetPlan !== "pro") {
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Please attach proof of payment." };
  }

  const validationError = validateLogoFile(file);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const plan: PlanType = targetPlan === "pro" ? "pro" : business.plan;
  const amount = PLAN_PRICES[plan];

  let proofUrl: string;
  try {
    proofUrl = await uploadImage(file, { folder: "payment-proofs" });
  } catch {
    return { ok: false, message: "The upload failed. Please try again." };
  }

  try {
    await query(
      `insert into subscriptions (business_id, plan, amount, status, payment_method, payment_proof_url)
         values ($1, $2, $3, 'pending', $4, $5)`,
      [business.id, plan, amount, paymentMethod, proofUrl]
    );
  } catch {
    return { ok: false, message: "The proof uploaded, but we couldn't save it. Please try again." };
  }

  return { ok: true };
}
