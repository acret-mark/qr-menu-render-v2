import { auth } from "@/lib/auth/auth.config";
import { getBusinessProfile } from "@/lib/business/profile";
import { BusinessProfilePanel } from "@/components/business/business-profile-panel";
import { AccountTabs } from "@/components/business/account-tabs";
import { SubscriptionPanel } from "@/components/subscription/subscription-panel";
import { SupportPanel } from "@/components/support/support-panel";

/**
 * The shared Profile / Subscription / Support tab shell
 * (015-business-profile-editing, 021-owner-subscription-tab,
 * 022-owner-support-tab). Replaces the placeholder 013-email-confirmation
 * introduced as its post-confirmation redirect target.
 */
export default async function BusinessProfilePage() {
  const session = await auth();
  // The (owner) layout already guarantees a signed-in user with a valid
  // business row before this page renders.
  const profile = await getBusinessProfile(session!.user!.id);

  return (
    <AccountTabs
      profilePanel={<BusinessProfilePanel initialProfile={profile!} />}
      subscriptionPanel={<SubscriptionPanel />}
      supportPanel={<SupportPanel />}
    />
  );
}
