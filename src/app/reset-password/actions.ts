"use server";

import { lookupResetToken, resetPassword } from "@/lib/auth/password-reset";

export type VerifyResetTokenResult = { status: "ok" } | { status: "invalid" } | { status: "error" };

export async function verifyResetTokenAction(token: string): Promise<VerifyResetTokenResult> {
  try {
    const lookup = await lookupResetToken(token);
    return lookup.valid ? { status: "ok" } : { status: "invalid" };
  } catch (error) {
    console.error("Reset link verification failed", error);
    return { status: "error" };
  }
}

export type SubmitResetPasswordResult = { ok: true } | { ok: false; message: string };

export async function submitResetPasswordAction(
  token: string,
  newPassword: string
): Promise<SubmitResetPasswordResult> {
  const ok = await resetPassword(token, newPassword);
  if (!ok) {
    return { ok: false, message: "This link is no longer valid — please request a new one." };
  }
  return { ok: true };
}
