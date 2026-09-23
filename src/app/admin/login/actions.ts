"use server";

import {
  signIn,
  InvalidCredentialsSignin,
  UnconfirmedEmailSignin,
} from "@/lib/auth/auth.config";

export type LoginAdminResult = { ok: true } | { ok: false; message: string };

const GENERIC_LOGIN_ERROR = "Invalid email or password.";

export async function loginAdminAction(
  email: string,
  password: string
): Promise<LoginAdminResult> {
  try {
    await signIn("credentials", {
      email,
      password,
      loginContext: "admin",
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof InvalidCredentialsSignin || error instanceof UnconfirmedEmailSignin) {
      // Same generic message either way (FR-009) — an admin-context login
      // never distinguishes "wrong password" from "not on the admin roster."
      return { ok: false, message: GENERIC_LOGIN_ERROR };
    }
    throw error;
  }
}
