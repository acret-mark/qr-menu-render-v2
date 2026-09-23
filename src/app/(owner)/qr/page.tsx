import { auth } from "@/lib/auth/auth.config";
import { getBusinessForQr } from "@/lib/qr/queries";
import { QrCodeView } from "@/components/qr/qr-code-view";

export default async function QrCodePage() {
  const session = await auth();
  // The (owner) layout already guarantees a signed-in user with a valid
  // business row before this page renders.
  const business = await getBusinessForQr(session!.user!.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-semibold">QR Code</h1>
      {business && <QrCodeView name={business.name} slug={business.slug} />}
    </div>
  );
}
