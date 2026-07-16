import type { BillingPlan, BillingStatus } from "./types";
import { pickLanguage, type Language } from "./i18n";

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
  return status === "active" || status === "trialing" || status === "lifetime";
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
  const lifetime = value.status === "lifetime" || value.plan === "lifetime";
  const active = lifetime || isActiveSubscription(value.status);
  const plan: BillingPlan = lifetime ? "lifetime" : active && isPaidPlan(value.plan) ? value.plan : "free";
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

export function freeDocumentsRemaining(billing: BillingStatus) {
  if (billing.isPaid || billing.documentsLimit === null) return null;
  return Math.max(0, billing.documentsLimit - billing.documentsUsed);
}

export function isFreeDocumentLimitReached(billing: BillingStatus) {
  const remaining = freeDocumentsRemaining(billing);
  return remaining !== null && remaining <= 0;
}

export function isCurrentBillingPlan(billing: BillingStatus, plan: BillingPlan) {
  return billing.isPaid ? billing.plan === plan : plan === "free";
}

export function billingErrorMessage(error: unknown, language: Language) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED")) {
    return pickLanguage(language, {
      en: "You have used this week's 5 free documents. Upgrade to keep creating and remove PaperMint branding.",
      zh: "本周 5 份免费单据额度已用完。升级后可继续创建且移除 PaperMint 页脚。",
      vi: "Bạn đã dùng hết 5 chứng từ miễn phí trong tuần. Hãy nâng cấp để tiếp tục tạo chứng từ.",
      ar: "لقد استخدمت المستندات المجانية الخمسة لهذا الأسبوع. قم بالترقية لمواصلة الإنشاء."
    });
  }
  return message || pickLanguage(language, {
    en: "Something went wrong. Please try again.",
    zh: "操作失败，请重试。",
    vi: "Đã xảy ra lỗi. Vui lòng thử lại.",
    ar: "حدث خطأ. يرجى المحاولة مرة أخرى."
  });
}
