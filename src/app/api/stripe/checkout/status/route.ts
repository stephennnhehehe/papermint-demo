import { NextResponse } from "next/server";
import { AuthError, requireRequestUser } from "@/lib/server/auth";
import { getStripe, syncSubscription } from "@/lib/server/stripe";
import { isActiveSubscription } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser(request);
    const body = (await request.json()) as { sessionId?: unknown };
    if (typeof body.sessionId !== "string" || !body.sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "A valid Checkout session is required." }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(body.sessionId);
    const sessionUserId = session.client_reference_id ?? session.metadata?.user_id;
    if (sessionUserId !== user.id) {
      return NextResponse.json({ error: "This Checkout session belongs to another account." }, { status: 403 });
    }

    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId) {
      return NextResponse.json({ status: session.status, active: false });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription, user.id);
    return NextResponse.json({
      status: subscription.status,
      active: isActiveSubscription(subscription.status)
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm Checkout." },
      { status }
    );
  }
}
