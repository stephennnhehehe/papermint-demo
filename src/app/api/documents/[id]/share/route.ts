import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PaperMintPdf } from "@/components/pdf/DocumentPdf";
import { formatAud } from "@/lib/calculations";
import { documentFromRow } from "@/lib/documents";
import { AuthError, getSupabaseAdmin, requireRequestUser } from "@/lib/server/auth";
import { documentEmailHtml, sendTransactionalEmail } from "@/lib/server/email";
import type { DocumentRow } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRequestUser(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin.from("documents").select("*").eq("id", id).eq("user_id", user.id).single();
    if (error || !row) return Response.json({ error: "Document not found." }, { status: 404 });

    const { data: share, error: shareError } = await admin.from("document_shares").upsert(
      { user_id: user.id, document_id: id, enabled: true, updated_at: new Date().toISOString() },
      { onConflict: "user_id,document_id" }
    ).select("token").single();
    if (shareError) throw shareError;

    const sentAt = row.sent_at ?? new Date().toISOString();
    await admin.from("documents").update({
      sent_at: sentAt,
      status: row.status === "draft" ? "sent" : row.status
    }).eq("id", id).eq("user_id", user.id);

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
    const publicUrl = `${siteUrl}/d/${share.token}`;
    let emailSent = false;
    let message = "Share link created.";

    if (body.sendEmail) {
      if (!row.bill_to?.email) return Response.json({ error: "Add a customer email address before sending." }, { status: 400 });
      const document = documentFromRow({ ...row, sent_at: sentAt } as DocumentRow);
      const { data: account } = await admin.from("billing_accounts").select("status,lifetime_access").eq("user_id", user.id).maybeSingle();
      const showBranding = !account?.lifetime_access && !["active", "trialing"].includes(account?.status ?? "free");
      const pdfElement = React.createElement(PaperMintPdf, { document, showBranding }) as Parameters<typeof renderToBuffer>[0];
      const buffer = await renderToBuffer(pdfElement);
      const dueLabel = document.type === "invoice"
        ? `Payment is due ${document.dueDate || "as agreed"}.`
        : `This quote is valid until ${document.validUntil || "the stated date"}.`;
      const delivery = await sendTransactionalEmail({
        to: row.bill_to.email,
        subject: `${body.reminder ? "Reminder: " : ""}${document.type === "invoice" ? "Invoice" : "Quote"} ${document.number} from ${document.company.name}`,
        html: documentEmailHtml({
          recipientName: document.billTo.name,
          issuerName: document.company.name || "Your supplier",
          type: document.type,
          number: document.number,
          total: formatAud(Number(row.totals?.total ?? 0)),
          dueLabel,
          publicUrl,
          reminder: Boolean(body.reminder)
        }),
        attachment: { filename: `${document.type}-${document.number}.pdf`, content: buffer.toString("base64") }
      });
      emailSent = delivery.sent;
      message = delivery.sent ? "Email sent." : delivery.reason || "Share link created.";
      if (body.reminder && delivery.sent) {
        await admin.from("document_events").insert({ user_id: user.id, document_id: id, event_type: "reminder_sent" });
      }
    }

    return Response.json({ url: publicUrl, emailSent, message });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to share document." }, { status: 500 });
  }
}
