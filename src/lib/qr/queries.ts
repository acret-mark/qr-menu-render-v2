import { queryOne } from "@/lib/db/client";

export interface BusinessForQr {
  name: string;
  slug: string;
}

export async function getBusinessForQr(ownerId: string): Promise<BusinessForQr | null> {
  return queryOne<BusinessForQr>(`select name, slug from businesses where owner_id = $1`, [ownerId]);
}
