import { query, queryOne } from "@/lib/db/client";
import type {
  AdminBusinessDetail,
  AdminBusinessSummary,
  AdminMenuCategory,
  AdminPendingPayment,
  AdminPendingPaymentDetail,
  AdminSubscriptionRecord,
  AdminSupportTicket,
} from "./types";

/**
 * `locked` backs both the admin business list's "Expired" stat card and a
 * per-row flag, so the two can never disagree — ported ahead of
 * 032-unified-subscription-lifecycle's own implementation (see types.ts).
 * A `left join lateral` picks each business's single most recent
 * subscription row in one query — no client-side "latest row per group"
 * reduction needed on this stack (that workaround was a Supabase/PostgREST
 * limitation, not a Postgres one).
 */
export async function getBusinessList(): Promise<AdminBusinessSummary[]> {
  const rows = await query<{
    id: string;
    name: string;
    plan: string;
    status: string;
    created_at: string;
    latest_subscription_status: string | null;
  }>(`
    select b.id, b.name, b.plan, b.status, b.created_at, s.status as latest_subscription_status
    from businesses b
    left join lateral (
      select status from subscriptions
        where business_id = b.id
        order by created_at desc
        limit 1
    ) s on true
    order by b.created_at desc
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    plan: row.plan as AdminBusinessSummary["plan"],
    status: row.status as AdminBusinessSummary["status"],
    createdAt: row.created_at,
    locked: row.latest_subscription_status === "expired",
  }));
}

export async function getBusinessDetail(id: string): Promise<AdminBusinessDetail | null> {
  const row = await queryOne<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    address: string | null;
    plan: string;
    status: string;
    created_at: string;
    trial_ends_at: string | null;
  }>(
    `select id, name, slug, logo_url, contact_phone, contact_email, address, plan, status, created_at, trial_ends_at
       from businesses where id = $1`,
    [id]
  );
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    address: row.address,
    plan: row.plan as AdminBusinessDetail["plan"],
    status: row.status as AdminBusinessDetail["status"],
    createdAt: row.created_at,
    trialEndsAt: row.trial_ends_at,
  };
}

export async function getBusinessMenu(businessId: string): Promise<AdminMenuCategory[]> {
  const [categories, items] = await Promise.all([
    query<{ id: string; name: string; sort_order: number }>(
      `select id, name, sort_order from categories where business_id = $1 order by sort_order asc`,
      [businessId]
    ),
    query<{
      id: string;
      category_id: string;
      name: string;
      price: string;
      is_sold_out: boolean;
      is_displayed: boolean;
    }>(
      `select id, category_id, name, price, is_sold_out, is_displayed
         from items where business_id = $1 order by sort_order asc`,
      [businessId]
    ),
  ]);

  const itemsByCategory = new Map<string, AdminMenuCategory["items"]>();
  for (const item of items) {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      isSoldOut: item.is_sold_out,
      isDisplayed: item.is_displayed,
    });
    itemsByCategory.set(item.category_id, list);
  }

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    items: itemsByCategory.get(category.id) ?? [],
  }));
}

export async function getBusinessSubscriptions(
  businessId: string
): Promise<AdminSubscriptionRecord[]> {
  const rows = await query<{
    id: string;
    plan: string;
    amount: string;
    status: string;
    payment_method: string | null;
    created_at: string;
  }>(
    `select id, plan, amount, status, payment_method, created_at
       from subscriptions where business_id = $1 order by created_at desc`,
    [businessId]
  );

  return rows.map((row) => ({
    id: row.id,
    plan: row.plan as AdminSubscriptionRecord["plan"],
    amount: Number(row.amount),
    status: row.status as AdminSubscriptionRecord["status"],
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
  }));
}

/**
 * Every subscription awaiting payment verification, across all businesses,
 * for the Payment Queue (010-payment-queue). Ordered OLDEST-FIRST — a work
 * queue, so the longest-waiting owner sits at the top. Deliberately the
 * opposite of getBusinessSubscriptions() above (reverse-chronological
 * history) — do not "align" the two.
 */
export async function getPendingPayments(): Promise<AdminPendingPayment[]> {
  const rows = await query<{
    id: string;
    business_id: string;
    business_name: string;
    plan: string;
    amount: string;
    payment_method: string | null;
    payment_proof_url: string | null;
    created_at: string;
  }>(`
    select s.id, s.business_id, b.name as business_name, s.plan, s.amount,
           s.payment_method, s.payment_proof_url, s.created_at
      from subscriptions s
      join businesses b on b.id = s.business_id
      where s.status = 'pending'
      order by s.created_at asc
  `);

  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    plan: row.plan as AdminPendingPayment["plan"],
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    paymentProofUrl: row.payment_proof_url,
    submittedAt: row.created_at,
  }));
}

/**
 * Single subscription joined to its business, for Activate Subscription
 * (011-activate-subscription). Unlike getPendingPayments(), not filtered to
 * `status = 'pending'` — the page itself decides how to render an
 * already-resolved row (FR-008).
 */
export async function getPendingPaymentById(id: string): Promise<AdminPendingPaymentDetail | null> {
  const row = await queryOne<{
    id: string;
    business_id: string;
    business_name: string;
    contact_email: string | null;
    plan: string;
    amount: string;
    status: string;
    payment_method: string | null;
    payment_proof_url: string | null;
    created_at: string;
    activated_by: string | null;
    activated_at: string | null;
    starts_at: string | null;
    expires_at: string | null;
  }>(
    `select s.id, s.business_id, b.name as business_name, b.contact_email,
            s.plan, s.amount, s.status, s.payment_method, s.payment_proof_url, s.created_at,
            s.activated_by, s.activated_at, s.starts_at, s.expires_at
       from subscriptions s
       join businesses b on b.id = s.business_id
       where s.id = $1`,
    [id]
  );
  if (!row) return null;

  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    contactEmail: row.contact_email,
    plan: row.plan as AdminPendingPaymentDetail["plan"],
    amount: Number(row.amount),
    status: row.status as AdminPendingPaymentDetail["status"],
    paymentMethod: row.payment_method,
    paymentProofUrl: row.payment_proof_url,
    submittedAt: row.created_at,
    activatedBy: row.activated_by,
    activatedAt: row.activated_at,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Every support ticket, across all businesses, for the Support Tickets
 * inbox (012-support-ticket-management). Ordered NEWEST-FIRST — a triage
 * inbox, not a FIFO work queue like getPendingPayments(). Filtering/sorting
 * by status happens client-side against this full set (pilot-scale ticket
 * volume) — see components/admin/support-inbox.tsx.
 */
export async function getSupportTickets(): Promise<AdminSupportTicket[]> {
  const rows = await query<{
    id: string;
    business_id: string;
    business_name: string;
    business_email: string | null;
    subject: string;
    message: string;
    status: AdminSupportTicket["status"];
    admin_reply: string | null;
    replied_at: string | null;
    created_at: string;
  }>(`
    select t.id, t.business_id, b.name as business_name, b.contact_email as business_email,
           t.subject, t.message, t.status, t.admin_reply, t.replied_at, t.created_at
      from support_tickets t
      join businesses b on b.id = t.business_id
      order by t.created_at desc
  `);

  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    businessEmail: row.business_email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminReply: row.admin_reply,
    repliedAt: row.replied_at,
    createdAt: row.created_at,
  }));
}

export async function hasOpenSupportTicket(businessId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `select id from support_tickets where business_id = $1 and status in ('open', 'in_progress') limit 1`,
    [businessId]
  );
  return row !== null;
}
