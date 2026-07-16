import { formatAud } from "@/lib/calculations";
import { documentEmailHtml, isEmailConfigured, sendTransactionalEmail } from "@/lib/server/email";
import { getSupabaseAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";

function sydneyDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorised." }, { status: 401 });
  }
  if (!isEmailConfigured()) return Response.json({ error: "Email delivery is not configured." }, { status: 503 });

  const admin = getSupabaseAdmin();
  const { data: settings, error: settingsError } = await admin.from("reminder_settings").select("*").eq("enabled", true);
  if (settingsError) throw settingsError;
  const today = sydneyDate();
  let sent = 0;

  for (const setting of settings ?? []) {
    const { data: documents } = await admin.from("documents").select("*").eq("user_id", setting.user_id).eq("type", "invoice").not("status", "in", "(paid,cancelled,draft)").not("due_date", "is", null);
    for (const document of documents ?? []) {
      if (!document.bill_to?.email) continue;
      const diff = daysBetween(today, document.due_date);
      const reminderKey = diff === 0 ? `due-${document.due_date}`
        : diff > 0 && setting.before_days.includes(diff) ? `before-${diff}-${document.due_date}`
        : diff < 0 && setting.overdue_days.includes(Math.abs(diff)) ? `overdue-${Math.abs(diff)}-${document.due_date}`
        : "";
      if (!reminderKey) continue;
      const { data: existing } = await admin.from("reminder_deliveries").select("id").eq("document_id", document.id).eq("reminder_key", reminderKey).maybeSingle();
      if (existing) continue;
      const { data: share } = await admin.from("document_shares").upsert({ user_id: document.user_id, document_id: document.id, enabled: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,document_id" }).select("token").single();
      if (!share) continue;
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
      const publicUrl = `${siteUrl}/d/${share.token}`;
      const delivery = await sendTransactionalEmail({
        to: document.bill_to.email,
        subject: `Reminder: Invoice ${document.number} from ${document.company?.name || "your supplier"}`,
        html: documentEmailHtml({ recipientName: document.bill_to?.name || "", issuerName: document.company?.name || "Your supplier", type: "invoice", number: document.number, total: formatAud(Number(document.totals?.total ?? 0)), dueLabel: diff < 0 ? `Payment was due ${document.due_date}.` : `Payment is due ${document.due_date}.`, publicUrl, reminder: true })
      });
      if (delivery.sent) {
        await admin.from("reminder_deliveries").insert({ user_id: document.user_id, document_id: document.id, reminder_key: reminderKey, recipient: document.bill_to.email, provider_id: delivery.id, status: "sent" });
        await admin.from("document_events").insert({ user_id: document.user_id, document_id: document.id, event_type: "reminder_sent", metadata: { reminder_key: reminderKey } });
        sent += 1;
      }
    }
  }
  return Response.json({ ok: true, sent, date: today });
}
