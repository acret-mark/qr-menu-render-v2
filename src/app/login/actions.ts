"use server";

import {
  signIn,
  InvalidCredentialsSignin,
  UnconfirmedEmailSignin,
} from "@/lib/auth/auth.config";

export type LoginOwnerResult =
  | { ok: true }
  | { ok: false; reason: "invalid-credentials" | "unconfirmed-email"; message: string };

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
const UNCONFIRMED_EMAIL_MESSAGE = "Please confirm your email before signing in.";

export async function loginOwnerAction(
  email: string,
  password: string
): Promise<LoginOwnerResult> {
  try {
    await signIn("credentials", {
      email,
      password,
      loginContext: "owner",
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof UnconfirmedEmailSignin) {
      return { ok: false, reason: "unconfirmed-email", message: UNCONFIRMED_EMAIL_MESSAGE };
    }
    if (error instanceof InvalidCredentialsSignin) {
      return { ok: false, reason: "invalid-credentials", message: INVALID_CREDENTIALS_MESSAGE };
    }
    throw error;
  }
}
