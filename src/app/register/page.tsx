import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

// Auth pages are functional-only and never meant to surface in search
// results (specs/033 FR-009).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen w-full flex-1 items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            H
          </div>
          <h1 className="font-heading text-lg font-semibold">Create your Hapag account</h1>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
