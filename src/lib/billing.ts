import type { BillingPlan, BillingStatus } from "./types";

export const FREE_WEEKLY_DOCUMENT_LIMIT = 5;

export const paidPlans = {
  weekly: {
    amount: 99,
    displayPrice: "$0.99",
    interval: "week" as const
  },
  monthly: {
    amount: 299,
    displayPrice: "$2.99",
    interval: "month" as const
  }
};

export type PaidPlan = keyof typeof paidPlans;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "weekly" || value === "monthly";
}

export function isActiveSubscription(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export function startOfLocalWeek(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - distanceFromMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function freeBillingStatus(documentsUsed = 0, date = new Date()): BillingStatus {
  return {
    plan: "free",
    status: "free",
    currentPeriodEnd: null,
    documentsUsed,
    documentsLimit: FREE_WEEKLY_DOCUMENT_LIMIT,
    weekStartsAt: startOfLocalWeek(date).toISOString(),
    isPaid: false,
    showBranding: true
  };
}

export function normalizeBillingStatus(value: {
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  documents_used?: number | null;
  documents_limit?: number | null;
  week_starts_at?: string | null;
}): BillingStatus {
  const active = isActiveSubscription(value.status);
  const plan: BillingPlan = active && isPaidPlan(value.plan) ? value.plan : "free";
  return {
    plan,
    status: value.status ?? "free",
    currentPeriodEnd: value.current_period_end ?? null,
    documentsUsed: Number(value.documents_used ?? 0),
    documentsLimit: active ? null : Number(value.documents_limit ?? FREE_WEEKLY_DOCUMENT_LIMIT),
    weekStartsAt: value.week_starts_at ?? startOfLocalWeek().toISOString(),
    isPaid: active,
    showBranding: !active
  };
}

export function billingErrorMessage(error: unknown, language: "en" | "zh") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED")) {
    return language === "zh"
      ? "本周 5 份免费单据额度已用完。升级后可继续创建且移除 PaperMint 页脚。"
      : "You have used this week's 5 free documents. Upgrade to keep creating and remove PaperMint branding.";
  }
  return message || (language === "zh" ? "操作失败，请重试。" : "Something went wrong. Please try again.");
}
