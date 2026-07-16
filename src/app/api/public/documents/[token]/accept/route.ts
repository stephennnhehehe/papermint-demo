import { getSupabaseAdmin } from "@/lib/server/auth";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({}));
  const acceptedBy = String(body.acceptedBy || "").trim().slice(0, 120);
  if (acceptedBy.length < 2) return Response.json({ error: "Enter the name of the person accepting this quote." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: share } = await admin.from("document_shares").select("document_id,enabled,expires_at").eq("token", token).maybeSingle();
  if (!share?.enabled || (share.expires_at && new Date(share.expires_at) < new Date())) {
    return Response.json({ error: "This link is no longer available." }, { status: 404 });
  }
  const { data: document } = await admin.from("documents").select("id,type,accepted_at").eq("id", share.document_id).maybeSingle();
  if (!document || document.type !== "quote") return Response.json({ error: "Quote not found." }, { status: 404 });
  if (!document.accepted_at) {
    const { error } = await admin.from("documents").update({ accepted_at: new Date().toISOString(), accepted_by: acceptedBy }).eq("id", document.id);
    if (error) throw error;
  }
  return Response.json({ accepted: true });
}
