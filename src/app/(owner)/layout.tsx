import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth.config";
import {
  getOwnerBusiness,
  isKnownBusinessStatus,
  LOGIN_PATH,
  SUSPENDED_PATH,
  ERROR_PATH,
} from "@/lib/auth/login";
import { OwnerShell } from "@/components/dashboard/owner-shell";

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

  return (
    <OwnerShell status={business.status} businessName={business.name}>
      {children}
    </OwnerShell>
  );
}
