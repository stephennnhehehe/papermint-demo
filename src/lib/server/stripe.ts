import Stripe from "stripe";
import { isActiveSubscription, type PaidPlan } from "@/lib/billing";
import { getSupabaseAdmin } from "./auth";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function siteUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

export function priceIdForPlan(plan: PaidPlan) {
  return plan === "weekly" ? process.env.STRIPE_WEEKLY_PRICE_ID : process.env.STRIPE_MONTHLY_PRICE_ID;
}

export function planFromSubscription(subscription: Stripe.Subscription): PaidPlan {
  if (subscription.metadata.plan === "weekly" || subscription.metadata.plan === "monthly") {
    return subscription.metadata.plan;
  }

  const price = subscription.items.data[0]?.price;
  if (price?.id && price.id === process.env.STRIPE_WEEKLY_PRICE_ID) return "weekly";
  if (price?.id && price.id === process.env.STRIPE_MONTHLY_PRICE_ID) return "monthly";
  return price?.recurring?.interval === "week" ? "weekly" : "monthly";
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const values = subscription.items.data.map((item) => item.current_period_end).filter(Boolean);
  const end = values.length > 0 ? Math.max(...values) : null;
  return end ? new Date(end * 1000).toISOString() : null;
}

export async function syncSubscription(subscription: Stripe.Subscription, fallbackUserId?: string) {
  const admin = getSupabaseAdmin();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  let userId = subscription.metadata.user_id || fallbackUserId || "";

  if (!userId) {
    const { data } = await admin
      .from("billing_accounts")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.user_id ?? "";
  }

  if (!userId) {
    const customer = await getStripe().customers.retrieve(customerId);
    if (!customer.deleted) userId = customer.metadata.supabase_user_id ?? "";
  }

  if (!userId) throw new Error(`Unable to match Stripe subscription ${subscription.id} to a PaperMint user.`);

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan = planFromSubscription(subscription);
  const { error } = await admin.from("billing_accounts").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan,
    status: subscription.status,
    current_period_end: subscriptionPeriodEnd(subscription),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

export async function hasActiveSubscription(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("billing_accounts")
    .select("status,lifetime_access")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.lifetime_access) || isActiveSubscription(data?.status);
}
