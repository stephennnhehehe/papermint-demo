type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  attachment?: { filename: string; content: string };
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character] ?? character);
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "Email delivery is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      attachments: input.attachment ? [input.attachment] : undefined
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.message || "Email delivery failed.");
  return { sent: true, id: result.id as string };
}

export function documentEmailHtml(input: {
  recipientName: string;
  issuerName: string;
  type: "invoice" | "quote";
  number: string;
  total: string;
  dueLabel: string;
  publicUrl: string;
  reminder?: boolean;
}) {
  const recipientName = escapeHtml(input.recipientName || "there");
  const issuerName = escapeHtml(input.issuerName);
  const number = escapeHtml(input.number);
  const total = escapeHtml(input.total);
  const dueLabel = escapeHtml(input.dueLabel);
  const publicUrl = escapeHtml(input.publicUrl);
  const type = escapeHtml(input.type);
  const title = input.reminder
    ? `A friendly reminder about ${input.type} ${input.number}`
    : `${input.issuerName} sent you a ${input.type}`;
  return `<!doctype html><html><body style="margin:0;background:#f5f7f4;font-family:Arial,sans-serif;color:#17211b"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #dfe6df;border-radius:10px;padding:30px"><p style="margin:0 0 8px;color:#2f8c67;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">PaperMint</p><h1 style="margin:0 0 18px;font-size:24px">${escapeHtml(title)}</h1><p style="line-height:1.6">Hi ${recipientName},</p><p style="line-height:1.6">${issuerName} has shared ${type} <strong>${number}</strong> for <strong>${total}</strong>. ${dueLabel}</p><p style="margin:26px 0"><a href="${publicUrl}" style="display:inline-block;background:#17211b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:7px;font-weight:700">View ${type}</a></p><p style="color:#66736b;font-size:13px;line-height:1.5">You can review and download the document from the secure link above. Payment instructions are included on the document.</p></div></div></body></html>`;
}
