import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen w-full flex-1 items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-8 shadow-sm">
        <h1 className="font-heading text-lg font-semibold">Reset your password</h1>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
