import { documentFromRow } from "@/lib/documents";
import { getSupabaseAdmin } from "@/lib/server/auth";
import type { DocumentRow } from "@/lib/types";
import { PublicDocumentClient } from "./PublicDocumentClient";

export const dynamic = "force-dynamic";

export default async function PublicDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.startsWith("demo-")) return <PublicDocumentClient initialDocument={null} token={token} showBranding />;

  let initialDocument = null;
  let showBranding = true;
  try {
    const admin = getSupabaseAdmin();
    const { data: share } = await admin.from("document_shares").select("document_id,enabled,expires_at").eq("token", token).maybeSingle();
    if (share?.enabled && (!share.expires_at || new Date(share.expires_at) >= new Date())) {
      const { data: row } = await admin.from("documents").select("*").eq("id", share.document_id).maybeSingle();
      if (row) {
        const { data: account } = await admin.from("billing_accounts").select("status").eq("user_id", row.user_id).maybeSingle();
        showBranding = !["active", "trialing"].includes(account?.status ?? "free");
        if (!row.first_viewed_at) {
          const viewedAt = new Date().toISOString();
          await admin.from("documents").update({ first_viewed_at: viewedAt }).eq("id", row.id);
          row.first_viewed_at = viewedAt;
        }
        initialDocument = documentFromRow(row as DocumentRow);
      }
    }
  } catch {
    initialDocument = null;
  }
  return <PublicDocumentClient initialDocument={initialDocument} token={token} showBranding={showBranding} />;
}
