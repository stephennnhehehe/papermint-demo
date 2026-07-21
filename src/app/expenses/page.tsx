"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileArchive, Loader2, Paperclip, Plus, ReceiptText, Trash2, Upload } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { strToU8, zipSync } from "fflate";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import { deleteExpense, fetchCompanyProfiles, fetchDocuments, fetchExpenseReceipts, fetchExpenses, upsertExpense } from "@/lib/api";
import { BasReportPdf } from "@/components/pdf/BasReportPdf";
import { formatAud } from "@/lib/calculations";
import { pickLanguage } from "@/lib/i18n";
import { australianFiscalYear, calculateBasSummary, inDateRange, returnLossRecords, rowsToCsv } from "@/lib/financials";
import { deleteExpenseReceipt, uploadExpenseReceipt } from "@/lib/storage";
import type { CompanyRecord, DocumentRow, Expense, ExpenseCategory, ExpenseReceipt } from "@/lib/types";

type ExpenseForm = {
  id?: string;
  company_profile_id: string;
  merchant: string;
  expense_date: string;
  category: ExpenseCategory;
  purchase_type: "capital" | "non_capital";
  total_amount: string;
  gst_amount: string;
  gst_claimable: boolean;
  payment_method: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): ExpenseForm => ({
  company_profile_id: "", merchant: "", expense_date: today(), category: "materials",
  purchase_type: "non_capital", total_amount: "", gst_amount: "0", gst_claimable: true,
  payment_method: "", notes: ""
});

const categories: ExpenseCategory[] = ["inventory", "materials", "fuel", "software", "phone", "marketing", "professional_services", "travel", "office", "other"];

export default function ExpensesPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const categoryLabel = (category: ExpenseCategory) => ({
    inventory: copy({ en: "Inventory / trading stock", zh: "进货成本 / Trading stock", vi: "Hàng tồn kho", ar: "المخزون / بضاعة التجارة" }),
    materials: copy({ en: "Materials", zh: "材料", vi: "Vật liệu", ar: "مواد" }),
    fuel: copy({ en: "Fuel", zh: "燃油", vi: "Nhiên liệu", ar: "وقود" }),
    software: copy({ en: "Software", zh: "软件", vi: "Phần mềm", ar: "برمجيات" }),
    phone: copy({ en: "Phone", zh: "电话", vi: "Điện thoại", ar: "هاتف" }),
    marketing: copy({ en: "Marketing", zh: "营销", vi: "Tiếp thị", ar: "تسويق" }),
    professional_services: copy({ en: "Professional services", zh: "专业服务", vi: "Dịch vụ chuyên môn", ar: "خدمات مهنية" }),
    travel: copy({ en: "Travel", zh: "差旅", vi: "Đi lại", ar: "سفر" }),
    office: copy({ en: "Office", zh: "办公", vi: "Văn phòng", ar: "مكتب" }),
    other: copy({ en: "Other", zh: "其他", vi: "Khác", ar: "أخرى" })
  })[category];
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<ExpenseReceipt[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [expenseRows, receiptRows, companyRows, documentRows] = await Promise.all([
        fetchExpenses(user.id), fetchExpenseReceipts(user.id), fetchCompanyProfiles(user.id), fetchDocuments(user.id)
      ]);
      setExpenses(expenseRows);
      setReceipts(receiptRows);
      setCompanies(companyRows);
      setDocuments(documentRows);
      setForm((current) => current.company_profile_id ? current : { ...current, company_profile_id: companyRows.find((item) => item.is_default)?.id ?? companyRows[0]?.id ?? "" });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load expenses.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, user]);

  useEffect(() => { load(); }, [load]);

  const visibleExpenses = useMemo(() => expenses.filter((expense) => companyFilter === "all" || expense.company_profile_id === companyFilter), [companyFilter, expenses]);
  const totals = useMemo(() => visibleExpenses.reduce((sum, expense) => ({ total: sum.total + Number(expense.total_amount), gst: sum.gst + (expense.gst_claimable ? Number(expense.gst_amount) : 0) }), { total: 0, gst: 0 }), [visibleExpenses]);
  const inventoryTotals = useMemo(() => visibleExpenses.filter((expense) => expense.category === "inventory").reduce((sum, expense) => ({ total: sum.total + Number(expense.total_amount), gst: sum.gst + (expense.gst_claimable ? Number(expense.gst_amount) : 0) }), { total: 0, gst: 0 }), [visibleExpenses]);
  const lossRecords = useMemo(() => returnLossRecords(documents, { companyProfileId: companyFilter === "all" ? null : companyFilter }), [companyFilter, documents]);
  const lossTotals = useMemo(() => lossRecords.reduce((sum, record) => ({ amount: sum.amount + record.amount, gst: sum.gst + record.gstAdjustment }), { amount: 0, gst: 0 }), [lossRecords]);

  function updateTotal(value: string) {
    const clean = value.replace(/^0+(?=\d)/, "");
    const total = Number(clean) || 0;
    setForm((current) => ({ ...current, total_amount: clean, gst_amount: current.gst_claimable ? (total / 11).toFixed(2) : "0" }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !form.merchant.trim() || Number(form.total_amount) <= 0) return;
    setSaving(true);
    try {
      const saved = await upsertExpense(user.id, {
        id: form.id, company_profile_id: form.company_profile_id || null,
        merchant: form.merchant.trim(), expense_date: form.expense_date, category: form.category,
        purchase_type: form.purchase_type, total_amount: Number(form.total_amount),
        gst_amount: form.gst_claimable ? Number(form.gst_amount) || 0 : 0,
        gst_claimable: form.gst_claimable, payment_method: form.payment_method || null,
        notes: form.notes || null
      });
      if (pendingReceipt) await uploadExpenseReceipt(pendingReceipt, user.id, saved.id);
      setForm({ ...emptyForm(), company_profile_id: form.company_profile_id });
      setPendingReceipt(null);
      await load();
      showToast(copy({ en: "Expense saved.", zh: "费用已保存。", vi: "Đã lưu chi phí.", ar: "تم حفظ المصروف." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save expense.", "error");
    } finally { setSaving(false); }
  }

  function editExpense(expense: Expense) {
    setForm({
      id: expense.id, company_profile_id: expense.company_profile_id ?? "", merchant: expense.merchant,
      expense_date: expense.expense_date, category: expense.category, purchase_type: expense.purchase_type,
      total_amount: String(expense.total_amount), gst_amount: String(expense.gst_amount),
      gst_claimable: expense.gst_claimable, payment_method: expense.payment_method ?? "", notes: expense.notes ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmDelete() {
    if (!user || !deleteTarget) return;
    setSaving(true);
    try {
      const linked = receipts.filter((receipt) => receipt.expense_id === deleteTarget.id);
      for (const receipt of linked) await deleteExpenseReceipt(receipt, user.id);
      await deleteExpense(user.id, deleteTarget.id);
      setDeleteTarget(null);
      await load();
      showToast(copy({ en: "Expense deleted.", zh: "费用已删除。", vi: "Đã xóa chi phí.", ar: "تم حذف المصروف." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to delete expense.", "error");
    } finally { setSaving(false); }
  }

  async function downloadAccountantPack() {
    setSaving(true);
    try {
      const fy = australianFiscalYear();
      const selectedCompany = companies.find((company) => company.id === companyFilter);
      const basis = selectedCompany?.gst_accounting_basis ?? "cash";
      const summary = calculateBasSummary({
        documents, expenses, companyProfileId: companyFilter === "all" ? null : companyFilter,
        accountingBasis: basis, periodStart: fy.start, periodEnd: fy.end
      });
      const reportBlob = await pdf(<BasReportPdf companyName={selectedCompany?.business_name ?? "All companies"} summary={summary} />).toBlob();
      const fyDocuments = documents.filter((document) =>
        document.type === "invoice" &&
        (companyFilter === "all" || document.company_profile_id === companyFilter) &&
        inDateRange(document.issue_date, fy.start, fy.end)
      );
      const fyExpenses = visibleExpenses.filter((expense) => inDateRange(expense.expense_date, fy.start, fy.end));
      const fyExpenseIds = new Set(fyExpenses.map((expense) => expense.id));
      const fyReceipts = receipts.filter((receipt) => fyExpenseIds.has(receipt.expense_id));
      const fyLossRecords = returnLossRecords(documents, {
        companyProfileId: companyFilter === "all" ? null : companyFilter,
        periodStart: fy.start,
        periodEnd: fy.end
      });
      const invoiceRows = fyDocuments.map((document) => [document.number, document.status, document.issue_date, document.paid_at ?? "", document.bill_to?.name ?? "", document.totals?.total ?? 0, document.totals?.gst ?? 0]);
      const expenseRows = fyExpenses.map((expense) => [expense.expense_date, expense.merchant, expense.category, expense.purchase_type, expense.total_amount, expense.gst_amount, expense.gst_claimable ? "Yes" : "No", expense.payment_method ?? "", expense.notes ?? ""]);
      const receiptRows = fyReceipts.map((receipt) => [receipt.expense_id, receipt.file_name, receipt.created_at]);
      const returnLossRows = fyLossRecords.map((record) => [record.date, record.documentNumber, record.customer, record.description, record.details, record.quantity, record.unitPrice, record.amount, record.gstAdjustment]);
      const files: Record<string, Uint8Array> = {
        [`${fy.label}-BAS-summary.pdf`]: new Uint8Array(await reportBlob.arrayBuffer()),
        [`${fy.label}-invoice-register.csv`]: strToU8(rowsToCsv([["Number", "Status", "Issue date", "Paid date", "Customer", "Total", "GST"], ...invoiceRows])),
        [`${fy.label}-expense-register.csv`]: strToU8(rowsToCsv([["Date", "Merchant", "Category", "Purchase type", "Total", "GST", "GST claimable", "Payment method", "Notes"], ...expenseRows])),
        [`${fy.label}-receipt-index.csv`]: strToU8(rowsToCsv([["Expense ID", "File name", "Uploaded at"], ...receiptRows])),
        [`${fy.label}-returns-loss-register.csv`]: strToU8(rowsToCsv([["Paid date", "Invoice", "Customer", "Description", "Details", "Quantity", "Unit price", "Return / loss value", "GST adjustment"], ...returnLossRows]))
      };
      for (const [index, receipt] of fyReceipts.entries()) {
        if (!receipt.signed_url) continue;
        const response = await fetch(receipt.signed_url);
        if (!response.ok) continue;
        const safeName = receipt.file_name.replace(/[^a-zA-Z0-9._-]/g, "-");
        files[`receipts/${String(index + 1).padStart(3, "0")}-${safeName}`] = new Uint8Array(await response.arrayBuffer());
      }
      const archive = zipSync(files);
      const blob = new Blob([new Uint8Array(archive)], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `papermint-${fy.label.toLowerCase()}-accountant-pack.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast(copy({ en: "Accountant pack downloaded.", zh: "会计资料包已下载。", vi: "Đã tải gói kế toán.", ar: "تم تنزيل حزمة المحاسب." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to build accountant pack.", "error");
    } finally { setSaving(false); }
  }

  return (
    <ProtectedRoute><AppShell>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="panel min-w-0 p-5">
          <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e8f4ef] text-[var(--mint-dark)]"><ReceiptText className="h-5 w-5" /></span><div><h1 className="text-2xl font-black">{t("expenses")}</h1><p className="text-sm font-semibold text-[var(--muted)]">{copy({ en: "Keep purchases and receipts BAS-ready.", zh: "轻松整理费用和收据，准备 BAS。", vi: "Lưu chi phí và biên lai để chuẩn bị BAS.", ar: "نظّم المصروفات والإيصالات لإعداد BAS." })}</p></div></div>
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <Select label={copy({ en: "Company", zh: "公司", vi: "Công ty", ar: "الشركة" })} value={form.company_profile_id} onChange={(value) => setForm({ ...form, company_profile_id: value })} options={[{ value: "", label: copy({ en: "No company", zh: "未指定公司", vi: "Không có công ty", ar: "بلا شركة" }) }, ...companies.map((company) => ({ value: company.id, label: company.business_name }))]} />
            <Field label={copy({ en: "Merchant", zh: "商家", vi: "Nhà cung cấp", ar: "التاجر" })} required value={form.merchant} onChange={(value) => setForm({ ...form, merchant: value })} />
            <div className="grid grid-cols-2 gap-3"><Field label={copy({ en: "Date", zh: "日期", vi: "Ngày", ar: "التاريخ" })} type="date" value={form.expense_date} onChange={(value) => setForm({ ...form, expense_date: value })} /><Select label={copy({ en: "Category", zh: "类别", vi: "Danh mục", ar: "الفئة" })} value={form.category} onChange={(value) => { const category = value as ExpenseCategory; setForm({ ...form, category, purchase_type: category === "inventory" ? "non_capital" : form.purchase_type }); }} options={categories.map((category) => ({ value: category, label: categoryLabel(category) }))} /></div>
            {form.category === "inventory" ? <div className="rounded-lg border border-[#cfe4d8] bg-[#eef7f2] p-3 text-xs font-semibold leading-5 text-[var(--mint-dark)]">{copy({ en: "Trading stock purchases are included in BAS G11. Claimable GST is included in 1B.", zh: "进货成本会计入 BAS G11；可申报的 GST 会计入 1B。", vi: "Mua hàng tồn kho được tính vào BAS G11; GST hợp lệ được tính vào 1B.", ar: "تدرج مشتريات المخزون في G11 وGST القابل للمطالبة في 1B." })}</div> : null}
            <div className="grid grid-cols-2 gap-3"><Field label={copy({ en: "Total incl. GST", zh: "含 GST 总额", vi: "Tổng gồm GST", ar: "الإجمالي شامل GST" })} inputMode="decimal" value={form.total_amount} onChange={updateTotal} /><Field label="GST" inputMode="decimal" value={form.gst_amount} onChange={(value) => setForm({ ...form, gst_amount: value.replace(/^0+(?=\d)/, "") })} /></div>
            <label className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-white/70 p-3 text-sm font-bold"><span>{copy({ en: "Claim GST credit", zh: "申报 GST credit", vi: "Yêu cầu tín dụng GST", ar: "المطالبة برصيد GST" })}</span><input checked={form.gst_claimable} onChange={(event) => setForm({ ...form, gst_claimable: event.target.checked, gst_amount: event.target.checked ? (Number(form.total_amount) / 11).toFixed(2) : "0" })} type="checkbox" /></label>
            <Select disabled={form.category === "inventory"} label={copy({ en: "Purchase type", zh: "采购类型", vi: "Loại mua hàng", ar: "نوع الشراء" })} value={form.purchase_type} onChange={(value) => setForm({ ...form, purchase_type: value as ExpenseForm["purchase_type"] })} options={[{ value: "non_capital", label: "Non-capital (G11)" }, { value: "capital", label: "Capital (G10)" }]} />
            <Field label={copy({ en: "Payment method", zh: "付款方式", vi: "Phương thức thanh toán", ar: "طريقة الدفع" })} value={form.payment_method} onChange={(value) => setForm({ ...form, payment_method: value })} />
            <label><span className="label">{t("notes")}</span><textarea className="field min-h-20 resize-y" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[var(--line)] bg-white/60 p-3 text-sm font-bold"><Upload className="h-4 w-4" /><span className="min-w-0 truncate">{pendingReceipt?.name ?? copy({ en: "Attach receipt", zh: "上传收据", vi: "Đính kèm biên lai", ar: "إرفاق إيصال" })}</span><input accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(event) => setPendingReceipt(event.target.files?.[0] ?? null)} type="file" /></label>
            <div className="flex gap-2"><button className="btn-primary flex-1" disabled={saving} type="submit">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{form.id ? t("save") : copy({ en: "Add expense", zh: "添加费用", vi: "Thêm chi phí", ar: "إضافة مصروف" })}</button>{form.id ? <button className="btn-secondary" onClick={() => setForm(emptyForm())} type="button">{copy({ en: "Cancel", zh: "取消", vi: "Hủy", ar: "إلغاء" })}</button> : null}</div>
          </form>
        </section>

        <section className="panel min-w-0 p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-xl font-black">{copy({ en: "Expense register", zh: "费用记录", vi: "Sổ chi phí", ar: "سجل المصروفات" })}</h2><p className="text-sm font-semibold text-[var(--muted)]">{visibleExpenses.length} {copy({ en: "entries", zh: "条记录", vi: "mục", ar: "سجلات" })} · {formatAud(totals.total)} · GST {formatAud(totals.gst)}</p><p className="mt-1 text-xs font-black text-[var(--mint-dark)]">{copy({ en: "Inventory purchases", zh: "进货成本", vi: "Mua hàng tồn kho", ar: "مشتريات المخزون" })}: {formatAud(inventoryTotals.total)} · GST {formatAud(inventoryTotals.gst)}</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><Select label={copy({ en: "Company filter", zh: "公司筛选", vi: "Lọc công ty", ar: "تصفية الشركة" })} value={companyFilter} onChange={setCompanyFilter} options={[{ value: "all", label: copy({ en: "All companies", zh: "全部公司", vi: "Tất cả công ty", ar: "كل الشركات" }) }, ...companies.map((company) => ({ value: company.id, label: company.business_name }))]} /><button className="btn-secondary mb-px" disabled={saving} onClick={downloadAccountantPack} type="button"><FileArchive className="h-4 w-4" />{copy({ en: "Download FY pack", zh: "下载财年资料包", vi: "Tải gói năm tài chính", ar: "تنزيل حزمة السنة المالية" })}</button></div></div>
          {loading ? <div className="flex items-center gap-2 p-6 text-sm font-semibold text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" />Loading expenses</div> : visibleExpenses.length === 0 ? <div className="rounded-lg border border-dashed border-[var(--line)] p-10 text-center text-sm font-semibold text-[var(--muted)]">{copy({ en: "No expenses in this view.", zh: "当前没有费用记录。", vi: "Không có chi phí trong chế độ xem này.", ar: "لا توجد مصروفات في هذا العرض." })}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><th className="py-3">{copy({ en: "Date / Merchant", zh: "日期 / 商家", vi: "Ngày / Nhà cung cấp", ar: "التاريخ / التاجر" })}</th><th>{copy({ en: "Category", zh: "类别", vi: "Danh mục", ar: "الفئة" })}</th><th>{copy({ en: "Company", zh: "公司", vi: "Công ty", ar: "الشركة" })}</th><th className="text-right">GST</th><th className="text-right">{t("total")}</th><th className="text-right">{copy({ en: "Receipt", zh: "收据", vi: "Biên lai", ar: "الإيصال" })}</th><th /></tr></thead><tbody>{visibleExpenses.map((expense) => { const receipt = receipts.find((item) => item.expense_id === expense.id); const company = companies.find((item) => item.id === expense.company_profile_id); return <tr className="border-b border-[#eef2ef]" key={expense.id}><td className="py-4"><button className="text-left" onClick={() => editExpense(expense)} type="button"><span className="block font-black">{expense.merchant}</span><span className="text-xs font-semibold text-[var(--muted)]">{expense.expense_date}</span></button></td><td>{categoryLabel(expense.category)}</td><td>{company?.business_name ?? "-"}</td><td className="text-right">{formatAud(expense.gst_claimable ? expense.gst_amount : 0)}</td><td className="text-right font-black">{formatAud(expense.total_amount)}</td><td className="text-right">{receipt?.signed_url ? <a className="icon-btn ml-auto" href={receipt.signed_url} rel="noreferrer" target="_blank" title={receipt.file_name}><ExternalLink className="h-4 w-4" /></a> : <Paperclip className="ml-auto h-4 w-4 text-[var(--muted)]" />}</td><td className="text-right"><button className="icon-btn ml-auto text-[var(--rose)]" onClick={() => setDeleteTarget(expense)} title={t("delete")} type="button"><Trash2 className="h-4 w-4" /></button></td></tr>; })}</tbody></table></div>}
        </section>

        <section className="panel min-w-0 p-5 xl:col-span-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black">{copy({ en: "Returns & loss register", zh: "退货与损耗记录", vi: "Sổ trả hàng & tổn thất", ar: "سجل المرتجعات والخسائر" })}</h2>
              <p className="text-sm font-semibold text-[var(--muted)]">
                {copy({ en: "Negative-price items are recorded automatically after an invoice is marked Paid.", zh: "Invoice 标记为已付款后，负单价项目会自动记录在这里。", vi: "Các mục có giá âm được tự động ghi lại khi hóa đơn đã thanh toán.", ar: "تسجل البنود ذات السعر السالب تلقائياً بعد دفع الفاتورة." })}
              </p>
            </div>
            <p className="text-sm font-black text-[var(--rose)]">{lossRecords.length} {copy({ en: "records", zh: "条", vi: "mục", ar: "سجلات" })} · {formatAud(lossTotals.amount)} · GST {formatAud(lossTotals.gst)}</p>
          </div>
          {lossRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm font-semibold text-[var(--muted)]">
              {copy({ en: "No paid-invoice return or loss adjustments in this view.", zh: "当前没有已付款 Invoice 的退货或损耗记录。", vi: "Không có điều chỉnh trả hàng hoặc tổn thất.", ar: "لا توجد تعديلات مرتجعات أو خسائر." })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead><tr className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><th className="py-3">{copy({ en: "Paid date", zh: "付款日期", vi: "Ngày trả", ar: "تاريخ الدفع" })}</th><th>{copy({ en: "Invoice / Customer", zh: "Invoice / 客户", vi: "Hóa đơn / Khách", ar: "الفاتورة / العميل" })}</th><th>{copy({ en: "Item", zh: "项目", vi: "Hạng mục", ar: "البند" })}</th><th className="text-right">{copy({ en: "Qty", zh: "数量", vi: "SL", ar: "الكمية" })}</th><th className="text-right">{copy({ en: "Unit price", zh: "单价", vi: "Đơn giá", ar: "السعر" })}</th><th className="text-right">GST</th><th className="text-right">{copy({ en: "Adjustment", zh: "损耗金额", vi: "Điều chỉnh", ar: "التعديل" })}</th></tr></thead>
                <tbody>{lossRecords.map((record, index) => <tr className="border-b border-[#eef2ef]" key={`${record.documentId}:${record.description}:${index}`}><td className="py-3">{record.date}</td><td><Link className="font-black hover:text-[var(--mint-dark)]" href={`/documents/${record.documentId}`}>{record.documentNumber}</Link><span className="block text-xs font-semibold text-[var(--muted)]">{record.customer || "-"}</span></td><td><span className="block max-w-sm break-words font-black">{record.description}</span>{record.details ? <span className="block max-w-sm whitespace-pre-wrap break-words text-xs text-[var(--muted)]">{record.details}</span> : null}</td><td className="text-right">{record.quantity}</td><td className="text-right text-[var(--rose)]">{formatAud(record.unitPrice)}</td><td className="text-right">-{formatAud(record.gstAdjustment)}</td><td className="text-right font-black text-[var(--rose)]">-{formatAud(record.amount)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {deleteTarget ? <div className="fixed inset-0 z-[80] grid place-items-center bg-[#17211b]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-[var(--rose)]"><Trash2 className="h-5 w-5" /></span><div><h2 className="text-xl font-black">{copy({ en: "Delete expense?", zh: "删除这笔费用？", vi: "Xóa chi phí?", ar: "حذف المصروف؟" })}</h2><p className="text-sm text-[var(--muted)]">{deleteTarget.merchant} · {formatAud(deleteTarget.total_amount)}</p></div></div><p className="text-sm leading-6 text-[var(--muted)]">{copy({ en: "The receipt attachment will also be removed. This cannot be undone.", zh: "关联收据也会被删除，此操作无法撤销。", vi: "Biên lai đính kèm cũng sẽ bị xóa và không thể hoàn tác.", ar: "سيتم حذف الإيصال المرفق أيضاً ولا يمكن التراجع." })}</p><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setDeleteTarget(null)} type="button">{copy({ en: "Cancel", zh: "取消", vi: "Hủy", ar: "إلغاء" })}</button><button className="btn-primary bg-[var(--rose)]" disabled={saving} onClick={confirmDelete} type="button">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{t("delete")}</button></div></div></div> : null}
    </AppShell></ProtectedRoute>
  );
}

function Field({ label, value, onChange, type = "text", required = false, inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; inputMode?: "decimal" }) {
  return <label><span className="label">{label}</span><input className="field" inputMode={inputMode} required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return <label className="min-w-44"><span className="label">{label}</span><select className="field disabled:cursor-not-allowed disabled:bg-[#edf1ed] disabled:text-[var(--muted)]" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
