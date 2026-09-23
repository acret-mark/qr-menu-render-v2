import { auth } from "@/lib/auth/auth.config";
import { getSupportTicketForOwner } from "@/lib/support/queries";
import { TicketOpenView } from "@/components/support/ticket-open-view";
import { TicketResolvedView } from "@/components/support/ticket-resolved-view";

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  // The (owner) layout already guarantees a signed-in user with a valid
  // business row before this page renders.
  const ticket = await getSupportTicketForOwner(session!.user!.id, id);

  if (!ticket) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-xl font-semibold">Ticket</h1>
        <p className="px-4 py-8 text-center text-base text-muted-foreground">
          That ticket couldn&rsquo;t be found.
        </p>
      </div>
    );
  }

  const hasReply = ticket.adminReply !== null;

  return hasReply || ticket.status === "resolved" ? (
    <TicketResolvedView ticket={ticket} />
  ) : (
    <TicketOpenView ticket={ticket} />
  );
}
