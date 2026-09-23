"use server";

import { signIn, InvalidConfirmationTokenSignin } from "@/lib/auth/auth.config";

export type ConfirmAccountResult = { status: "ok" } | { status: "invalid" } | { status: "error" };

/**
 * Replaces Supabase Auth's verifyOtp()/type=email flow (013-email-confirmation,
 * contracts/auth-confirm-route.md). Distinguishes "link no longer valid"
 * (FR-006) from a genuine transient/system error (FR-006a) the same way the
 * original did: an explicit invalid-token response vs. anything else that
 * throws.
 */
export async function confirmAccountAction(token: string): Promise<ConfirmAccountResult> {
  try {
    await signIn("credentials", { confirmationToken: token, redirect: false });
    return { status: "ok" };
  } catch (error) {
    if (error instanceof InvalidConfirmationTokenSignin) {
      return { status: "invalid" };
    }
    console.error("Confirmation link processing failed", error);
    return { status: "error" };
  }
}
