import { describe, expect, it } from "vitest";
import { australianFiscalYear, calculateBasSummary, inDateRange, returnLossRecords } from "./financials";
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

  it("includes inventory purchases in G11 and reports trading stock separately", () => {
    const inventoryExpense = {
      ...expense,
      id: "inventory-expense",
      category: "inventory",
      total_amount: 220,
      gst_amount: 20
    } as Expense;
    const summary = calculateBasSummary({ documents: [], expenses: [inventoryExpense], accountingBasis: "cash", periodStart: "2026-07-01", periodEnd: "2026-09-30" });

    expect(summary.g11NonCapitalPurchases).toBe(220);
    expect(summary.g11TradingStockPurchases).toBe(220);
    expect(summary.gstOnPurchases1B).toBe(20);
  });

  it("records negative paid-invoice lines as return or loss adjustments", () => {
    const adjustedInvoice = {
      ...invoice,
      number: "INV-RETURN",
      gst_enabled: true,
      gst_rate: 10,
      order_discount: { type: "percent", value: 0 },
      bill_to: { name: "Customer" },
      line_items: [
        { id: "sale", description: "Sale", details: "", quantity: 2, unitPrice: 100, gstEnabled: true, discount: { type: "percent", value: 0 } },
        { id: "return", description: "Damaged return", details: "One unit", quantity: 1, unitPrice: -20, gstEnabled: true, discount: { type: "percent", value: 0 } }
      ]
    } as DocumentRow;

    expect(returnLossRecords([adjustedInvoice])).toMatchObject([
      { documentNumber: "INV-RETURN", description: "Damaged return", amount: 20, gstAdjustment: 2 }
    ]);
    const summary = calculateBasSummary({ documents: [adjustedInvoice], expenses: [], accountingBasis: "cash", periodStart: "2026-07-01", periodEnd: "2026-09-30" });
    expect(summary.g1TotalSales).toBe(198);
    expect(summary.gstOnSales1A).toBe(18);
    expect(summary.returnsLosses).toBe(20);
    expect(summary.returnGstAdjustments).toBe(2);
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
