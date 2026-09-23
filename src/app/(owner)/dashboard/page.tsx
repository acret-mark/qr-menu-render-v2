import { auth } from "@/lib/auth/auth.config";
import { getDashboardStats } from "@/lib/business/dashboard-stats";
import { MaybeLink } from "@/components/dashboard/maybe-link";

// 017-category-manager, 018/019-menu-item-list/add-edit-item, and
// 020-qr-code-generation don't exist yet at this point in the replan — see
// owner-tab-bar.tsx's identical convention. Flips to true, with nothing
// else in this file changing, when each is implemented.
const CATEGORIES_ENABLED = false;
const MENU_ENABLED = false;
const QR_ENABLED = false;
const SUBSCRIPTION_ENABLED = false;

function getManilaHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hourCycle: "h23",
    }).format(date)
  );
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();
  // The (owner) layout already guarantees a signed-in user with a valid
  // business row before this page renders.
  const stats = await getDashboardStats(session!.user!.id);

  const categoryCount = stats?.categoryCount ?? 0;
  const itemCount = stats?.itemCount ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-semibold">Dashboard</h1>

      {stats && (
        <p className="text-base">
          {getGreeting(getManilaHour(new Date()))}, {stats.name}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <MaybeLink
          href="/categories"
          enabled={CATEGORIES_ENABLED}
          className="rounded-lg border border-border bg-card p-4 text-center"
        >
          <div className="font-heading text-2xl font-semibold">{categoryCount}</div>
          <div className="text-sm text-muted-foreground">Categories</div>
        </MaybeLink>
        <MaybeLink
          href="/menu"
          enabled={MENU_ENABLED}
          className="rounded-lg border border-border bg-card p-4 text-center"
        >
          <div className="font-heading text-2xl font-semibold">{itemCount}</div>
          <div className="text-sm text-muted-foreground">Menu Items</div>
        </MaybeLink>
      </div>

      {stats && (
        <MaybeLink
          href="/business-profile#subscription"
          enabled={SUBSCRIPTION_ENABLED}
          className="rounded-lg border border-border bg-card p-4 text-sm"
        >
          <span className="text-muted-foreground">Plan:</span>{" "}
          <span className="font-medium capitalize">{stats.plan}</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="text-muted-foreground">Status:</span>{" "}
          <span className="font-medium capitalize">{stats.status}</span>
        </MaybeLink>
      )}

      <MaybeLink
        href="/qr"
        enabled={QR_ENABLED}
        className="flex h-11 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium"
      >
        Download QR
      </MaybeLink>
    </div>
  );
}
