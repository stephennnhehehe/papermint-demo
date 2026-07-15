import { describe, expect, it } from "vitest";
import { billingErrorMessage, normalizeBillingStatus, startOfLocalWeek } from "./billing";

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

  it("turns the database quota code into a useful message", () => {
    expect(billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), "en")).toContain(
      "5 free documents"
    );
    expect(billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), "zh")).toContain(
      "5 份免费单据"
    );
  });
});
