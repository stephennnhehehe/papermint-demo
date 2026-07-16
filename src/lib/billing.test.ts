import { describe, expect, it } from "vitest";
import {
  billingErrorMessage,
  freeBillingStatus,
  freeDocumentsRemaining,
  isFreeDocumentLimitReached,
  isCurrentBillingPlan,
  normalizeBillingStatus,
  startOfLocalWeek
} from "./billing";

describe("billing", () => {
  it("starts the PaperMint week on Monday", () => {
    const start = startOfLocalWeek(new Date(2026, 6, 15, 14, 0, 0));
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getDay()]).toEqual([
      2026,
      6,
      13,
      1
    ]);
  });

  it("removes free limits and branding for active subscriptions", () => {
    const billing = normalizeBillingStatus({
      plan: "monthly",
      status: "active",
      documents_used: 5,
      documents_limit: null
    });
    expect(billing).toMatchObject({
      plan: "monthly",
      isPaid: true,
      documentsLimit: null,
      showBranding: false
    });
  });

  it("falls back to free access when a subscription is not active", () => {
    const billing = normalizeBillingStatus({ plan: "weekly", status: "canceled" });
    expect(billing).toMatchObject({
      plan: "free",
      isPaid: false,
      documentsLimit: 5,
      showBranding: true
    });
  });

  it("treats lifetime access as unlimited without branding", () => {
    const billing = normalizeBillingStatus({
      plan: "lifetime",
      status: "lifetime",
      documents_used: 42,
      documents_limit: null
    });
    expect(billing).toMatchObject({
      plan: "lifetime",
      isPaid: true,
      documentsLimit: null,
      showBranding: false
    });
    expect(isFreeDocumentLimitReached(billing)).toBe(false);
  });

  it("turns the database quota code into a useful message", () => {
    expect(billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), "en")).toContain(
      "5 free documents"
    );
    expect(billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), "zh")).toContain(
      "5 份免费单据"
    );
    expect(billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), "vi")).toContain(
      "5 chứng từ"
    );
    expect(billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), "ar")).toContain(
      "الخمسة"
    );
  });

  it("locks free creation after five documents", () => {
    expect(freeDocumentsRemaining(freeBillingStatus(4))).toBe(1);
    expect(isFreeDocumentLimitReached(freeBillingStatus(4))).toBe(false);
    expect(freeDocumentsRemaining(freeBillingStatus(5))).toBe(0);
    expect(isFreeDocumentLimitReached(freeBillingStatus(5))).toBe(true);
  });

  it("never applies the free creation lock to an active plan", () => {
    const billing = normalizeBillingStatus({
      plan: "weekly",
      status: "active",
      documents_used: 99,
      documents_limit: null
    });
    expect(freeDocumentsRemaining(billing)).toBeNull();
    expect(isFreeDocumentLimitReached(billing)).toBe(false);
    expect(isCurrentBillingPlan(billing, "free")).toBe(false);
    expect(isCurrentBillingPlan(billing, "weekly")).toBe(true);
    expect(isCurrentBillingPlan(billing, "monthly")).toBe(false);
  });
});
