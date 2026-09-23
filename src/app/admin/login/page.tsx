import { AdminLoginForm } from "@/components/admin/login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen w-full flex-1 items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            H
          </div>
          <h1 className="font-heading text-lg font-semibold">Hapag Admin</h1>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}
