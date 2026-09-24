import type { Metadata } from "next";

// Covers /admin/login and every page behind admin authentication
// ((protected)/*) in one place — a metadata-only pass-through layout one
// level up to cover both without duplicating the directive on every admin
// page (specs/033 FR-008).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
