"use server";

import { requestPasswordReset } from "@/lib/auth/password-reset";

/** Always resolves the same way regardless of account existence (FR-003). */
export async function requestPasswordResetAction(email: string): Promise<void> {
  await requestPasswordReset(email);
}
