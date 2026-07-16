import type { BasSummary, DocumentRow, Expense } from "./types";

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

  const g1TotalSales = sales.reduce((sum, document) => sum + Number(document.totals?.total ?? 0), 0);
  const gstOnSales1A = sales.reduce((sum, document) => sum + Number(document.totals?.gst ?? 0), 0);
  const gstOnPurchases1B = expenses.reduce((sum, expense) => sum + (expense.gst_claimable ? Number(expense.gst_amount) : 0), 0);
  const g10CapitalPurchases = expenses.filter((expense) => expense.purchase_type === "capital").reduce((sum, expense) => sum + Number(expense.total_amount), 0);
  const g11NonCapitalPurchases = expenses.filter((expense) => expense.purchase_type === "non_capital").reduce((sum, expense) => sum + Number(expense.total_amount), 0);

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    accountingBasis: input.accountingBasis,
    g1TotalSales,
    g10CapitalPurchases,
    g11NonCapitalPurchases,
    gstOnSales1A,
    gstOnPurchases1B,
    netGst: gstOnSales1A - gstOnPurchases1B
  };
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
