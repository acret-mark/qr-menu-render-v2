"use server";

import { auth } from "@/lib/auth/auth.config";
import { query } from "@/lib/db/client";
import { getBusinessProfile } from "@/lib/business/profile";
import { validateLogoFile } from "@/lib/business/logo-validation";
import { uploadImage } from "@/lib/cloudinary/client";

// Cache invalidation (016-menu-data-caching) omitted — not yet replanned on
// this stack; nothing to invalidate until that spec lands (see e.g.
// 011-activate-subscription's identical note).

export type UploadLogoResult = { ok: true; logoUrl: string } | { ok: false; message: string };

export async function uploadBusinessLogo(formData: FormData): Promise<UploadLogoResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "You must be signed in to upload a logo." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "No file was received." };
  }

  const validationError = validateLogoFile(file);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const profile = await getBusinessProfile(session.user.id);
  if (!profile) {
    return { ok: false, message: "Couldn't find your business. Please try again." };
  }

  let secureUrl: string;
  try {
    secureUrl = await uploadImage(file, { folder: "business-logos" });
  } catch {
    return { ok: false, message: "The upload failed. Please try again." };
  }

  try {
    await query(`update businesses set logo_url = $1 where id = $2`, [secureUrl, profile.id]);
  } catch {
    return { ok: false, message: "The logo uploaded, but we couldn't save it. Please try again." };
  }

  return { ok: true, logoUrl: secureUrl };
}
