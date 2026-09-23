import { auth } from "@/lib/auth/auth.config";
import { getSubscriptionStatusForOwner } from "@/lib/subscription/queries";
import { SubscriptionSubmitForm } from "@/components/subscription/subscription-submit-form";
import { PLAN_PRICES } from "@/lib/subscription/types";

const PLAN_LABELS = { standard: "Standard", pro: "Pro" } as const;

const STATUS_LABELS = {
  active: "Active",
  pending: "Pending verification",
  expired: "Expired",
  cancelled: "Cancelled",
} as const;

export async function SubscriptionPanel() {
  const session = await auth();
  // Every owner route already guarantees a signed-in user with a valid
  // business row before any panel content renders.
  const status = await getSubscriptionStatusForOwner(session!.user!.id);

  if (!status) {
    return null;
  }

  const { currentPlan, latest } = status;
  // FR-004: payment instructions and the submission control are hidden
  // entirely once the subscription is active — this spec's own literal
  // scope (a later 032-unified-subscription-lifecycle amendment shows this
  // block unconditionally instead; not replanned here, see plan.md).
  const showPaymentBlock = !latest || latest.status !== "active";

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-4 rounded-lg border border-border bg-muted p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-heading text-lg font-semibold">{PLAN_LABELS[currentPlan]}</span>
          <span className="text-sm font-medium">
            {latest ? STATUS_LABELS[latest.status] : "No subscription yet"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">₱{PLAN_PRICES[currentPlan]} / month</p>
        {latest?.expiresAt && (
          <div className="mt-3 flex justify-between border-t border-dashed border-border pt-3 text-sm text-muted-foreground">
            <span>Renews / expires</span>
            <span className="font-medium text-foreground">
              {new Date(latest.expiresAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        )}
        {latest?.paymentMethod && (
          <div className="mt-3 flex justify-between border-t border-dashed border-border pt-3 text-sm text-muted-foreground">
            <span>Payment method</span>
            <span className="font-medium text-foreground">
              {latest.paymentMethod === "gcash" ? "GCash" : "Bank Transfer"}
            </span>
          </div>
        )}
      </div>

      {showPaymentBlock && (
        <>
          <div className="mx-4 rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">Manual payment instructions</p>
            <p className="mt-2 text-muted-foreground">
              GCash: 0917-123-4567 (Hapag Inc.)
              <br />
              Bank Transfer: BDO Savings — 1234-5678-90 (Hapag Inc.)
            </p>
            <p className="mt-2 text-muted-foreground">
              After paying, choose your method and upload proof below.
            </p>
          </div>

          <SubscriptionSubmitForm currentPlan={currentPlan} />
        </>
      )}
    </div>
  );
}
