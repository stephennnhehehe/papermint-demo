import { NextResponse } from "next/server";
import { AuthError, getSupabaseAdmin, requireRequestUser } from "@/lib/server/auth";
import { getStripe, siteUrl } from "@/lib/server/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const { data, error } = await getSupabaseAdmin()
      .from("billing_accounts")
      .select("stripe_customer_id,lifetime_access")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (data?.lifetime_access) {
      return NextResponse.json({ error: "Lifetime access does not require billing management." }, { status: 409 });
    }
    if (!data?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account exists yet." }, { status: 404 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${siteUrl(request)}/pricing`
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing." },
      { status }
    );
  }
}
