"use server";

import { registerOwner, type RegisterOwnerResult } from "@/lib/auth/register";

export async function registerOwnerAction(input: {
  businessName: string;
  email: string;
  password: string;
}): Promise<RegisterOwnerResult> {
  return registerOwner(input);
}
