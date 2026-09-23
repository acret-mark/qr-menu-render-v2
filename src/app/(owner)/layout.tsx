import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth.config";
import {
  getOwnerBusiness,
  isKnownBusinessStatus,
  LOGIN_PATH,
  SUSPENDED_PATH,
  ERROR_PATH,
} from "@/lib/auth/login";

const BANNER_COPY: Record<"pending" | "trial", string> = {
  pending: "Awaiting payment verification.",
  trial: "You're on a free trial — add a plan to keep access.",
};

/**
 * requireOwnerBusiness() guard (012-owner-login,
 * contracts/require-owner-business-guard.md) for every route nested under
 * this group. Re-derives the business row server-side on every request —
 * never cached client-side (FR-003, FR-011).
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect(LOGIN_PATH);
  }

  const business = await getOwnerBusiness(session.user.id);
  if (!business || !isKnownBusinessStatus(business.status)) {
    redirect(ERROR_PATH);
  }

  if (business.status === "suspended") {
    redirect(SUSPENDED_PATH);
  }

  const banner = business.status === "pending" || business.status === "trial"
    ? BANNER_COPY[business.status]
    : null;

  return (
    <>
      {banner && (
        <div className="bg-warning px-4 py-2 text-center text-sm text-warning-foreground">
          {banner}
        </div>
      )}
      {children}
    </>
  );
}
