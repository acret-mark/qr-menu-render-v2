import type { Metadata } from "next";
import { InactiveMenuScreen } from "@/components/menu/inactive-menu-screen";

// Same noindex rationale as the main /menu/[slug] route (specs/033 FR-006) —
// a malformed menu URL is still a public-menu-family page.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
