import { getSupabaseClient } from "./supabase";
import type { PaidPlan } from "./billing";

async function billingRequest(path: string, body?: Record<string, unknown>, redirect = true) {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in with an account to manage a subscription.");

  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body ?? {})
  });
  const result = (await response.json()) as { url?: string; error?: string; manage?: boolean; active?: boolean };
  if (!response.ok || (redirect && !result.url)) {
    const error = new Error(result.error || "Unable to open secure billing.") as Error & { manage?: boolean };
    error.manage = result.manage;
    throw error;
  }
  if (redirect && result.url) window.location.assign(result.url);
  return result;
}

export function startStripeCheckout(plan: PaidPlan) {
  return billingRequest("/api/stripe/checkout", { plan });
}

export function openStripePortal() {
  return billingRequest("/api/stripe/portal");
}

export function syncStripeCheckout(sessionId: string) {
  return billingRequest("/api/stripe/checkout/status", { sessionId }, false);
}
