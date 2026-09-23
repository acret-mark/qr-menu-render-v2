import { InactiveMenuScreen } from "@/components/menu/inactive-menu-screen";

// A slug with extra, unrecognized path segments must hit the same
// unavailable-menu screen, not a framework-level 404 (specs/005-inactive-
// menu-state FR-003).
export default async function MenuCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <InactiveMenuScreen slug={slug} />;
}
