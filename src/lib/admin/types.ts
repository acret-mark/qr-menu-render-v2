export type BusinessStatus = "active" | "trial" | "pending" | "suspended";

// businesses.plan — deliberately does NOT include "trial" (see
// SubscriptionPlanType below) — that's a subscriptions.plan-only value.
export type PlanType = "standard" | "pro";

export interface AdminBusinessSummary {
  id: string;
  name: string;
  plan: PlanType;
  status: BusinessStatus;
  createdAt: string;
  /**
   * True when the business's most recent subscription row is `expired`.
   * Ported ahead of 032-unified-subscription-lifecycle's own implementation
   * (that spec's cron is what will ever actually *write* an `expired`
   * subscription row — until then this is always false, which is correct:
   * inert, not wrong).
   */
  locked: boolean;
}

export interface AdminBusinessDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  plan: PlanType;
  status: BusinessStatus;
  createdAt: string;
  trialEndsAt: string | null;
}

export interface AdminMenuItem {
  id: string;
  name: string;
  price: number;
  isSoldOut: boolean;
  isDisplayed: boolean;
}

export interface AdminMenuCategory {
  id: string;
  name: string;
  items: AdminMenuItem[];
}

export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled";

export type SubscriptionPlanType = PlanType | "trial";

export interface AdminSubscriptionRecord {
  id: string;
  plan: SubscriptionPlanType;
  amount: number;
  status: SubscriptionStatus;
  paymentMethod: string | null;
  createdAt: string;
}

/** A subscription awaiting payment verification, for the Payment Queue (A-04). */
export interface AdminPendingPayment {
  id: string;
  businessId: string;
  businessName: string;
  plan: PlanType;
  amount: number;
  paymentMethod: string | null;
  paymentProofUrl: string | null;
  submittedAt: string;
}

/** Single-subscription detail view for Activate Subscription (A-05). */
export interface AdminPendingPaymentDetail {
  id: string;
  businessId: string;
  businessName: string;
  contactEmail: string | null;
  plan: PlanType;
  amount: number;
  status: SubscriptionStatus;
  paymentMethod: string | null;
  paymentProofUrl: string | null;
  submittedAt: string;
  activatedBy: string | null;
  activatedAt: string | null;
  startsAt: string | null;
  expiresAt: string | null;
}

export type TicketStatus = "open" | "in_progress" | "resolved";

export interface AdminSupportTicket {
  id: string;
  businessId: string;
  businessName: string;
  businessEmail: string | null;
  subject: string;
  message: string;
  status: TicketStatus;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}
