import { describe, expect, it } from "vitest";
import { australianFiscalYear, calculateBasSummary, inDateRange } from "./financials";
import type { DocumentRow, Expense } from "./types";

const invoice = {
  id: "invoice", user_id: "user", type: "invoice", status: "paid", company_profile_id: "company",
  issue_date: "2026-07-05", paid_at: "2026-07-12T00:00:00Z", updated_at: "2026-07-12T00:00:00Z",
  totals: { total: 110, gst: 10 }
} as DocumentRow;

const expense = {
  id: "expense", user_id: "user", company_profile_id: "company", merchant: "Supplier",
  expense_date: "2026-07-08", category: "materials", purchase_type: "non_capital",
  total_amount: 55, gst_amount: 5, gst_claimable: true
} as Expense;

describe("calculateBasSummary", () => {
  it("calculates the core BAS labels", () => {
    const summary = calculateBasSummary({ documents: [invoice], expenses: [expense], companyProfileId: "company", accountingBasis: "cash", periodStart: "2026-07-01", periodEnd: "2026-09-30" });
    expect(summary.g1TotalSales).toBe(110);
    expect(summary.g11NonCapitalPurchases).toBe(55);
    expect(summary.gstOnSales1A).toBe(10);
    expect(summary.gstOnPurchases1B).toBe(5);
    expect(summary.netGst).toBe(5);
  });

  it("excludes unpaid invoices on a cash basis", () => {
    const summary = calculateBasSummary({ documents: [{ ...invoice, status: "sent", paid_at: null }], expenses: [], accountingBasis: "cash", periodStart: "2026-07-01", periodEnd: "2026-09-30" });
    expect(summary.g1TotalSales).toBe(0);
  });
});

describe("Australian financial-year dates", () => {
  it("starts a new financial year on 1 July", () => {
    expect(australianFiscalYear(new Date("2026-06-30T12:00:00+10:00"))).toEqual({ label: "FY26", start: "2025-07-01", end: "2026-06-30" });
    expect(australianFiscalYear(new Date("2026-07-01T12:00:00+10:00"))).toEqual({ label: "FY27", start: "2026-07-01", end: "2027-06-30" });
  });

  it("includes both ends of a reporting period", () => {
    expect(inDateRange("2026-07-01", "2026-07-01", "2027-06-30")).toBe(true);
    expect(inDateRange("2027-06-30T23:59:59Z", "2026-07-01", "2027-06-30")).toBe(true);
    expect(inDateRange("2027-07-01", "2026-07-01", "2027-06-30")).toBe(false);
  });
});
