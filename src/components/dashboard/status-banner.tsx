import { MaybeLink } from "@/components/dashboard/maybe-link";

// Both "pending" and "trial" per 016-owner-dashboard-shell's own FR-008/009
// (a later spec, 032-unified-subscription-lifecycle, changes this to a
// pending-only banner plus a separate locked-state banner — not yet
// replanned/implemented here, so this stays true to 016's own scope).
const BANNER_TEXT: Record<"pending" | "trial", string> = {
  pending: "Your account is awaiting payment verification.",
  trial: "You're on a free trial — add a plan to keep access.",
};

const SUBSCRIPTION_SCREEN_ENABLED = true;
const SUBSCRIPTION_PATH = "/business-profile#subscription";

export function StatusBanner({ status }: { status: "pending" | "trial" }) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
      <p>{BANNER_TEXT[status]}</p>
      <MaybeLink
        href={SUBSCRIPTION_PATH}
        enabled={SUBSCRIPTION_SCREEN_ENABLED}
        className="mt-1 inline-block text-sm font-medium underline underline-offset-2"
      >
        Complete your subscription
      </MaybeLink>
    </div>
  );
}
