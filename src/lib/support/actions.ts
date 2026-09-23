"use server";

import { auth } from "@/lib/auth/auth.config";
import { query, queryOne } from "@/lib/db/client";

export type SubmitSupportTicketResult = { ok: true } | { ok: false; message: string };

export async function submitSupportTicket(formData: FormData): Promise<SubmitSupportTicketResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "You must be signed in to submit a ticket." };
  }

  const business = await queryOne<{ id: string }>(
    `select id from businesses where owner_id = $1`,
    [session.user.id]
  );
  if (!business) {
    return { ok: false, message: "Couldn't find your business. Please try again." };
  }

  const subject = formData.get("subject");
  const message = formData.get("message");

  if (typeof subject !== "string" || subject.trim().length === 0) {
    return { ok: false, message: "Please enter a subject." };
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return { ok: false, message: "Please describe what's happening." };
  }

  try {
    await query(
      `insert into support_tickets (business_id, subject, message, status) values ($1, $2, $3, 'open')`,
      [business.id, subject.trim(), message.trim()]
    );
    return { ok: true };
  } catch {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
