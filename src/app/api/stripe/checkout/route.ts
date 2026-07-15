import { NextResponse } from "next/server";
import { paidPlans, isPaidPlan } from "@/lib/billing";
import { AuthError, getSupabaseAdmin, requireRequestUser } from "@/lib/server/auth";
import { getStripe, hasActiveSubscription, priceIdForPlan, siteUrl } from "@/lib/server/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const body = (await request.json()) as { plan?: unknown };
    if (!isPaidPlan(body.plan)) {
      return NextResponse.json({ error: "Choose a valid PaperMint plan." }, { status: 400 });
    }
    if (await hasActiveSubscription(user.id)) {
      return NextResponse.json(
        { error: "You already have an active subscription. Use Manage billing to change it.", manage: true },
        { status: 409 }
      );
    }

    const stripe = getStripe();
    const admin = getSupabaseAdmin();
    const { data: account, error: accountError } = await admin
      .from("billing_accounts")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (accountError) throw accountError;

    let customerId = account?.stripe_customer_id ?? "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
      const { error } = await admin.from("billing_accounts").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
    }

    const priceId = priceIdForPlan(body.plan);
    const plan = paidPlans[body.plan];
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: "aud",
            unit_amount: plan.amount,
            recurring: { interval: plan.interval },
            product_data: {
              name: `PaperMint ${body.plan === "weekly" ? "Weekly" : "Monthly"}`,
              description: "Unlimited invoices and quotes with PaperMint branding removed."
            }
          },
          quantity: 1
        };
    const origin = siteUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [lineItem],
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: { user_id: user.id, plan: body.plan },
      subscription_data: { metadata: { user_id: user.id, plan: body.plan } }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status }
    );
  }
}
