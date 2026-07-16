import { getSupabaseClient } from "./supabase";
import { isSupabaseConfigured } from "./supabase";
import { localFetchDocument, localSaveDocument } from "./local-store";

async function authenticatedRequest(path: string, body: unknown) {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in is required.");
  const response = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request failed.");
  return result;
}

export async function shareDocument(userId: string, documentId: string, sendEmail = false, reminder = false) {
  if (userId === "demo-user" || !isSupabaseConfigured()) {
    const document = localFetchDocument(userId, documentId);
    if (!document) throw new Error("Document not found.");
    localSaveDocument(userId, {
      ...document,
      status: document.status === "draft" ? "sent" : document.status,
      sentAt: document.sentAt ?? new Date().toISOString()
    });
    return {
      url: `${window.location.origin}/d/demo-${documentId}`,
      emailSent: false,
      message: sendEmail ? "Demo mode created a share link; no real email was sent." : "Share link created."
    };
  }
  return authenticatedRequest(`/api/documents/${documentId}/share`, { sendEmail, reminder });
}

export async function acceptPublicQuote(token: string, acceptedBy: string) {
  if (token.startsWith("demo-")) {
    const id = token.slice(5);
    const document = localFetchDocument("demo-user", id);
    if (!document) throw new Error("Quote not found.");
    localSaveDocument("demo-user", { ...document, acceptedAt: new Date().toISOString(), acceptedBy });
    return;
  }
  const response = await fetch(`/api/public/documents/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acceptedBy })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Unable to accept this quote.");
}
