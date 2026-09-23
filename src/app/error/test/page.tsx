import { notFound } from "next/navigation";

// Dev-only verification aid for S-04 (spec.md US2/FR-007) — throws for real,
// so visiting this route in development exercises the actual
// throw → nearest error.tsx boundary → ErrorState pipeline, not just a
// re-render of /error's static content. Gated out of production with the
// same notFound() convention already used elsewhere in this codebase.
export default function ForceErrorTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  throw new Error("Forced error for S-04 dev verification");
}
