import { queryOne } from "@/lib/db/client";

export type DashboardStats = {
  name: string;
  logoUrl: string | null;
  plan: "standard" | "pro";
  status: "pending" | "trial" | "active" | "suspended";
  categoryCount: number;
  itemCount: number;
};

export async function getDashboardStats(ownerId: string): Promise<DashboardStats | null> {
  const business = await queryOne<{
    id: string;
    name: string;
    logo_url: string | null;
    plan: string;
    status: string;
  }>(`select id, name, logo_url, plan, status from businesses where owner_id = $1`, [ownerId]);

  if (!business) {
    return null;
  }

  const counts = await queryOne<{ category_count: string; item_count: string }>(
    `select
       (select count(*) from categories where business_id = $1) as category_count,
       (select count(*) from items where business_id = $1) as item_count`,
    [business.id]
  );

  return {
    name: business.name,
    logoUrl: business.logo_url,
    plan: business.plan as DashboardStats["plan"],
    status: business.status as DashboardStats["status"],
    categoryCount: Number(counts?.category_count ?? 0),
    itemCount: Number(counts?.item_count ?? 0),
  };
}
