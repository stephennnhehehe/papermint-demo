import { calculateTotals, lineGstAmount, lineTotal } from "./calculations";
import type { BasSummary, DocumentRow, Expense, ReturnLossRecord } from "./types";

export function australianFiscalYear(today = new Date()) {
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    label: `FY${String(startYear + 1).slice(-2)}`,
    start: `${startYear}-07-01`,
    end: `${startYear + 1}-06-30`
  };
}

export function inDateRange(date: string | null | undefined, start: string, end: string) {
  return Boolean(date && date.slice(0, 10) >= start && date.slice(0, 10) <= end);
}

function documentTotals(document: DocumentRow) {
  if (!document.line_items?.length) return document.totals;
  return calculateTotals(
    document.line_items,
    document.order_discount ?? { type: "percent", value: 0 },
    document.gst_enabled,
    document.gst_rate
  );
}

export function returnLossRecords(
  documents: DocumentRow[],
  options: { companyProfileId?: string | null; periodStart?: string; periodEnd?: string } = {}
): ReturnLossRecord[] {
  return documents
    .filter((document) => {
      if (document.type !== "invoice" || document.status !== "paid") return false;
      if (options.companyProfileId && document.company_profile_id !== options.companyProfileId) return false;
      const date = document.paid_at ?? document.updated_at;
      if (options.periodStart && options.periodEnd && !inDateRange(date, options.periodStart, options.periodEnd)) return false;
      return true;
    })
    .flatMap((document) => {
      const date = (document.paid_at ?? document.updated_at).slice(0, 10);
      return (document.line_items ?? [])
        .filter((item) => lineTotal(item) < 0)
        .map((item) => ({
          documentId: document.id,
          documentNumber: document.number,
          date,
          customer: document.bill_to?.name ?? "",
          companyProfileId: document.company_profile_id,
          description: item.description || "Returned item",
          details: item.details,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: Math.abs(lineTotal(item)),
          gstAdjustment: Math.abs(lineGstAmount(
            item,
            document.line_items,
            document.order_discount ?? { type: "percent", value: 0 },
            document.gst_enabled,
            document.gst_rate
          ))
        }));
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function calculateBasSummary(input: {
  documents: DocumentRow[];
  expenses: Expense[];
  companyProfileId?: string | null;
  accountingBasis: "cash" | "accrual";
  periodStart: string;
  periodEnd: string;
}): BasSummary {
  const companyMatches = (companyProfileId: string | null | undefined) =>
    !input.companyProfileId || companyProfileId === input.companyProfileId;

  const sales = input.documents.filter((document) => {
    if (document.type !== "invoice" || document.status === "draft" || document.status === "cancelled") return false;
    if (!companyMatches(document.company_profile_id)) return false;
    const date = input.accountingBasis === "cash"
      ? document.paid_at ?? (document.status === "paid" ? document.updated_at : null)
      : document.issue_date;
    return inDateRange(date, input.periodStart, input.periodEnd);
  });

  const expenses = input.expenses.filter((expense) =>
    companyMatches(expense.company_profile_id) && inDateRange(expense.expense_date, input.periodStart, input.periodEnd)
  );
  const businessAmount = (expense: Expense) =>
    Number(expense.total_amount) * Math.min(100, Math.max(0, Number(expense.business_use_percent ?? 100))) / 100;

  const g1TotalSales = sales.reduce((sum, document) => sum + Number(documentTotals(document)?.total ?? 0), 0);
  const gstOnSales1A = sales.reduce((sum, document) => sum + Number(documentTotals(document)?.gst ?? 0), 0);
  const gstOnPurchases1B = expenses.reduce((sum, expense) => sum + (expense.gst_claimable ? Number(expense.gst_amount) : 0), 0);
  const g10CapitalPurchases = expenses.filter((expense) => expense.purchase_type === "capital").reduce((sum, expense) => sum + businessAmount(expense), 0);
  const g11NonCapitalPurchases = expenses.filter((expense) => expense.purchase_type === "non_capital").reduce((sum, expense) => sum + businessAmount(expense), 0);
  const g11TradingStockPurchases = expenses.filter((expense) => expense.category === "inventory").reduce((sum, expense) => sum + businessAmount(expense), 0);
  const adjustments = returnLossRecords(sales);
  const returnsLosses = adjustments.reduce((sum, item) => sum + item.amount, 0);
  const returnGstAdjustments = adjustments.reduce((sum, item) => sum + item.gstAdjustment, 0);

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    accountingBasis: input.accountingBasis,
    g1TotalSales,
    g10CapitalPurchases,
    g11NonCapitalPurchases,
    g11TradingStockPurchases,
    gstOnSales1A,
    gstOnPurchases1B,
    netGst: gstOnSales1A - gstOnPurchases1B,
    returnsLosses,
    returnGstAdjustments
  };
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
