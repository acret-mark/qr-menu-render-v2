import { query, queryOne } from "@/lib/db/client";
import type { SupportTicketDetail, SupportTicketSummary, TicketStatus } from "./types";

export async function getSupportTicketsForOwner(ownerId: string): Promise<SupportTicketSummary[]> {
  const business = await queryOne<{ id: string }>(
    `select id from businesses where owner_id = $1`,
    [ownerId]
  );
  if (!business) {
    return [];
  }

  const rows = await query<{ id: string; subject: string; status: TicketStatus; created_at: string }>(
    `select id, subject, status, created_at from support_tickets
       where business_id = $1 order by created_at desc`,
    [business.id]
  );

  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function getSupportTicketForOwner(
  ownerId: string,
  ticketId: string
): Promise<SupportTicketDetail | null> {
  const business = await queryOne<{ id: string }>(
    `select id from businesses where owner_id = $1`,
    [ownerId]
  );
  if (!business) {
    return null;
  }

  const row = await queryOne<{
    id: string;
    subject: string;
    message: string;
    status: TicketStatus;
    admin_reply: string | null;
    replied_at: string | null;
    created_at: string;
  }>(
    `select id, subject, message, status, admin_reply, replied_at, created_at
       from support_tickets where id = $1 and business_id = $2`,
    [ticketId, business.id]
  );
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminReply: row.admin_reply,
    repliedAt: row.replied_at,
    createdAt: row.created_at,
  };
}
