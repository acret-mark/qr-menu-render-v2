import {
  OwnerListSkeleton,
  OwnerPageHeaderSkeleton,
} from "@/components/dashboard/owner-shell-skeleton";

// Note: no OwnerShell wrapper — see dashboard/loading.tsx.
export default function MenuLoading() {
  return (
    <div className="flex flex-col gap-4">
      <OwnerPageHeaderSkeleton />
      <OwnerListSkeleton rows={6} />
    </div>
  );
}
