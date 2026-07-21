"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Car, ExternalLink, FileArchive, Landmark, Loader2, Paperclip, Pencil,
  Plus, ReceiptText, Route, Trash2, Upload, WalletCards, X
} from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { strToU8, zipSync } from "fflate";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import { BasReportPdf } from "@/components/pdf/BasReportPdf";
import {
  deleteExpense, deletePaymentAccount, deleteVehicle, deleteVehicleTrip,
  fetchCompanyProfiles, fetchDocuments, fetchExpenseReceipts, fetchExpenses,
  fetchPaymentAccounts, fetchVehicles, fetchVehicleTrips, upsertExpense,
  upsertPaymentAccount, upsertVehicle, upsertVehicleTrip
} from "@/lib/api";
import { formatAud } from "@/lib/calculations";
import { australianFiscalYear, calculateBasSummary, inDateRange, returnLossRecords, rowsToCsv } from "@/lib/financials";
import { pickLanguage } from "@/lib/i18n";
import { deleteExpenseReceipt, uploadExpenseReceipt } from "@/lib/storage";
import type {
  CompanyRecord, DocumentRow, Expense, ExpenseCategory, ExpenseReceipt, GstTreatment,
  PaymentAccount, PaymentAccountType, Vehicle, VehicleTrip
} from "@/lib/types";
import { tripBusinessKilometres, tripKilometres, vehicleLogbookSummary } from "@/lib/vehicle-logbook";

type Tab = "expenses" | "accounts" | "logbook";

type ExpenseForm = {
  id?: string; company_profile_id: string; merchant: string; supplier_abn: string;
  reference: string; expense_date: string; category: ExpenseCategory;
  purchase_type: "capital" | "non_capital"; total_amount: string; gst_amount: string;
  gst_claimable: boolean; gst_treatment: GstTreatment; business_use_percent: string;
  payment_account_id: string; vehicle_id: string; notes: string;
};

type AccountForm = {
  id?: string; company_profile_id: string; name: string; account_type: PaymentAccountType;
  last_four: string; is_default: boolean; is_active: boolean; notes: string;
};

type VehicleForm = {
  id?: string; company_profile_id: string; name: string; registration: string;
  make: string; model: string; year: string; ownership_type: Vehicle["ownership_type"];
  logbook_start_date: string; logbook_end_date: string; opening_odometer: string;
  closing_odometer: string; is_active: boolean; notes: string;
};

type TripForm = {
  id?: string; vehicle_id: string; start_date: string; end_date: string; origin: string;
  destination: string; purpose: string; start_odometer: string; end_odometer: string;
  business_use_percent: string; driver: string; notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const expenseForm = (): ExpenseForm => ({
  company_profile_id: "", merchant: "", supplier_abn: "", reference: "", expense_date: today(),
  category: "materials", purchase_type: "non_capital", total_amount: "", gst_amount: "0",
  gst_claimable: true, gst_treatment: "gst", business_use_percent: "100",
  payment_account_id: "", vehicle_id: "", notes: ""
});
const accountForm = (): AccountForm => ({
  company_profile_id: "", name: "", account_type: "bank", last_four: "",
  is_default: false, is_active: true, notes: ""
});
const vehicleForm = (): VehicleForm => ({
  company_profile_id: "", name: "", registration: "", make: "", model: "", year: "",
  ownership_type: "business", logbook_start_date: "", logbook_end_date: "",
  opening_odometer: "", closing_odometer: "", is_active: true, notes: ""
});
const tripForm = (): TripForm => ({
  vehicle_id: "", start_date: today(), end_date: today(), origin: "", destination: "",
  purpose: "", start_odometer: "", end_odometer: "", business_use_percent: "100", driver: "", notes: ""
});

const categories: ExpenseCategory[] = [
  "inventory", "materials", "fuel", "software", "phone", "marketing",
  "professional_services", "travel", "office", "other"
];

export default function ExpensesPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const [tab, setTab] = useState<Tab>("expenses");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<ExpenseReceipt[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [form, setForm] = useState<ExpenseForm>(expenseForm);
  const [account, setAccount] = useState<AccountForm>(accountForm);
  const [vehicle, setVehicle] = useState<VehicleForm>(vehicleForm);
  const [trip, setTrip] = useState<TripForm>(tripForm);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingReceipts, setPendingReceipts] = useState<File[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [expenseRows, receiptRows, companyRows, documentRows, accountRows, vehicleRows, tripRows] = await Promise.all([
        fetchExpenses(user.id), fetchExpenseReceipts(user.id), fetchCompanyProfiles(user.id), fetchDocuments(user.id),
        fetchPaymentAccounts(user.id), fetchVehicles(user.id), fetchVehicleTrips(user.id)
      ]);
      setExpenses(expenseRows); setReceipts(receiptRows); setCompanies(companyRows); setDocuments(documentRows);
      setAccounts(accountRows); setVehicles(vehicleRows); setTrips(tripRows);
      const defaultCompany = companyRows.find((item) => item.is_default)?.id ?? companyRows[0]?.id ?? "";
      const defaultAccount = accountRows.find((item) => item.is_default && item.is_active)?.id ?? accountRows.find((item) => item.is_active)?.id ?? "";
      setForm((current) => ({
        ...current,
        company_profile_id: current.company_profile_id || defaultCompany,
        payment_account_id: current.payment_account_id || defaultAccount
      }));
      setAccount((current) => ({ ...current, company_profile_id: current.company_profile_id || defaultCompany }));
      setVehicle((current) => ({ ...current, company_profile_id: current.company_profile_id || defaultCompany }));
      setTrip((current) => ({ ...current, vehicle_id: current.vehicle_id || vehicleRows.find((item) => item.is_active)?.id || "" }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load bookkeeping records.", "error");
    } finally { setLoading(false); }
  }, [showToast, user]);

  useEffect(() => { load(); }, [load]);

  const categoryLabel = (category: ExpenseCategory) => ({
    inventory: copy({ en: "Inventory / trading stock", zh: "进货成本 / Trading stock" }),
    materials: copy({ en: "Materials", zh: "材料" }), fuel: copy({ en: "Fuel & vehicle", zh: "燃油与车辆" }),
    software: copy({ en: "Software", zh: "软件" }), phone: copy({ en: "Phone & internet", zh: "电话与网络" }),
    marketing: copy({ en: "Marketing", zh: "营销" }), professional_services: copy({ en: "Professional services", zh: "专业服务" }),
    travel: copy({ en: "Travel", zh: "差旅" }), office: copy({ en: "Office", zh: "办公" }), other: copy({ en: "Other", zh: "其他" })
  })[category];
  const accountTypeLabel = (type: PaymentAccountType) => ({
    bank: copy({ en: "Business bank account", zh: "公司银行账户" }), credit_card: copy({ en: "Business credit card", zh: "公司信用卡" }),
    cash: copy({ en: "Cash / petty cash", zh: "现金 / 备用金" }), director_loan: copy({ en: "Director loan", zh: "Director Loan / 董事借款" }),
    owner_contribution: copy({ en: "Owner contribution", zh: "业主垫付" }), reimbursement_clearing: copy({ en: "Reimbursement clearing", zh: "报销过渡账户" }),
    other: copy({ en: "Other", zh: "其他" })
  })[type];

  const visibleExpenses = useMemo(() => expenses.filter((item) => companyFilter === "all" || item.company_profile_id === companyFilter), [companyFilter, expenses]);
  const visibleAccounts = useMemo(() => accounts.filter((item) => companyFilter === "all" || item.company_profile_id === companyFilter), [accounts, companyFilter]);
  const visibleVehicles = useMemo(() => vehicles.filter((item) => companyFilter === "all" || item.company_profile_id === companyFilter), [companyFilter, vehicles]);
  const visibleTrips = useMemo(() => trips.filter((item) =>
    (companyFilter === "all" || item.company_profile_id === companyFilter) &&
    (vehicleFilter === "all" || item.vehicle_id === vehicleFilter)
  ), [companyFilter, trips, vehicleFilter]);
  const totals = useMemo(() => visibleExpenses.reduce((sum, item) => ({
    total: sum.total + Number(item.total_amount), gst: sum.gst + (item.gst_claimable ? Number(item.gst_amount) : 0)
  }), { total: 0, gst: 0 }), [visibleExpenses]);
  const inventoryTotals = useMemo(() => visibleExpenses.filter((item) => item.category === "inventory").reduce((sum, item) => ({
    total: sum.total + Number(item.total_amount), gst: sum.gst + (item.gst_claimable ? Number(item.gst_amount) : 0)
  }), { total: 0, gst: 0 }), [visibleExpenses]);
  const lossRecords = useMemo(() => returnLossRecords(documents, { companyProfileId: companyFilter === "all" ? null : companyFilter }), [companyFilter, documents]);
  const lossTotals = useMemo(() => lossRecords.reduce((sum, item) => ({ amount: sum.amount + item.amount, gst: sum.gst + item.gstAdjustment }), { amount: 0, gst: 0 }), [lossRecords]);

  function calculateClaimableGst(total: number, treatment = form.gst_treatment, businessPercent = Number(form.business_use_percent)) {
    if (treatment !== "gst") return "0";
    return ((total / 11) * Math.min(100, Math.max(0, businessPercent || 0)) / 100).toFixed(2);
  }

  function updateTotal(value: string) {
    const clean = value.replace(/^0+(?=\d)/, "");
    setForm((current) => ({ ...current, total_amount: clean, gst_amount: calculateClaimableGst(Number(clean), current.gst_treatment, Number(current.business_use_percent)) }));
  }

  async function handleExpenseSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !form.merchant.trim() || Number(form.total_amount) <= 0) return;
    setSaving(true);
    try {
      const saved = await upsertExpense(user.id, {
        id: form.id, company_profile_id: form.company_profile_id || null, merchant: form.merchant.trim(),
        supplier_abn: form.supplier_abn.trim() || null, reference: form.reference.trim() || null,
        expense_date: form.expense_date, category: form.category, purchase_type: form.purchase_type,
        total_amount: Number(form.total_amount), gst_amount: form.gst_claimable ? Number(form.gst_amount) || 0 : 0,
        gst_claimable: form.gst_claimable, gst_treatment: form.gst_treatment,
        business_use_percent: Number(form.business_use_percent) || 0,
        payment_account_id: form.payment_account_id || null, payment_method: null,
        vehicle_id: form.vehicle_id || null, notes: form.notes.trim() || null
      });
      for (const file of pendingReceipts) await uploadExpenseReceipt(file, user.id, saved.id);
      const companyId = form.company_profile_id;
      const accountId = form.payment_account_id;
      setForm({ ...expenseForm(), company_profile_id: companyId, payment_account_id: accountId });
      setPendingReceipts([]);
      await load();
      showToast(copy({ en: "Expense saved.", zh: "费用已保存。" }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to save expense.", "error"); }
    finally { setSaving(false); }
  }

  function editExpense(item: Expense) {
    setTab("expenses");
    setForm({
      id: item.id, company_profile_id: item.company_profile_id ?? "", merchant: item.merchant,
      supplier_abn: item.supplier_abn ?? "", reference: item.reference ?? "", expense_date: item.expense_date,
      category: item.category, purchase_type: item.purchase_type, total_amount: String(item.total_amount),
      gst_amount: String(item.gst_amount), gst_claimable: item.gst_claimable,
      gst_treatment: item.gst_treatment ?? "gst", business_use_percent: String(item.business_use_percent ?? 100),
      payment_account_id: item.payment_account_id ?? "", vehicle_id: item.vehicle_id ?? "", notes: item.notes ?? ""
    });
    setPendingReceipts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmDeleteExpense() {
    if (!user || !deleteTarget) return;
    setSaving(true);
    try {
      for (const receipt of receipts.filter((item) => item.expense_id === deleteTarget.id)) await deleteExpenseReceipt(receipt, user.id);
      await deleteExpense(user.id, deleteTarget.id); setDeleteTarget(null); await load();
      showToast(copy({ en: "Expense deleted.", zh: "费用已删除。" }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to delete expense.", "error"); }
    finally { setSaving(false); }
  }

  async function removeReceipt(receipt: ExpenseReceipt) {
    if (!user || !window.confirm(copy({ en: "Delete this attachment?", zh: "删除这个附件？" }))) return;
    setSaving(true);
    try { await deleteExpenseReceipt(receipt, user.id); await load(); }
    catch (error) { showToast(error instanceof Error ? error.message : "Unable to delete attachment.", "error"); }
    finally { setSaving(false); }
  }

  async function handleAccountSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !account.name.trim()) return;
    setSaving(true);
    try {
      await upsertPaymentAccount(user.id, {
        id: account.id, company_profile_id: account.company_profile_id || null, name: account.name.trim(),
        account_type: account.account_type, last_four: account.last_four.trim().slice(-4) || null,
        is_default: account.is_default, is_active: account.is_active, notes: account.notes.trim() || null
      });
      const companyId = account.company_profile_id; setAccount({ ...accountForm(), company_profile_id: companyId });
      await load(); showToast(copy({ en: "Payment account saved.", zh: "付款账户已保存。" }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to save payment account.", "error"); }
    finally { setSaving(false); }
  }

  async function setupCommonAccounts() {
    if (!user) return;
    setSaving(true);
    try {
      const presets: Array<[string, PaymentAccountType]> = [
        ["Business bank account", "bank"], ["Business credit card", "credit_card"],
        ["Cash / petty cash", "cash"], ["Director loan", "director_loan"]
      ];
      for (const [name, accountType] of presets) {
        if (!accounts.some((item) => item.name === name && item.company_profile_id === (account.company_profile_id || null))) {
          await upsertPaymentAccount(user.id, { company_profile_id: account.company_profile_id || null, name, account_type: accountType, is_default: accountType === "bank" });
        }
      }
      await load(); showToast(copy({ en: "Common payment accounts added.", zh: "常用付款账户已添加。" }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to add accounts.", "error"); }
    finally { setSaving(false); }
  }

  async function removeAccount(item: PaymentAccount) {
    if (!user || !window.confirm(copy({ en: `Delete ${item.name}? Existing expenses will remain.`, zh: `删除 ${item.name}？已有费用记录会保留。` }))) return;
    setSaving(true);
    try { await deletePaymentAccount(user.id, item.id); await load(); }
    catch (error) { showToast(error instanceof Error ? error.message : "Unable to delete account.", "error"); }
    finally { setSaving(false); }
  }

  async function handleVehicleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !vehicle.name.trim() || !vehicle.registration.trim()) return;
    setSaving(true);
    try {
      await upsertVehicle(user.id, {
        id: vehicle.id, company_profile_id: vehicle.company_profile_id || null, name: vehicle.name.trim(),
        registration: vehicle.registration.trim().toUpperCase(), make: vehicle.make.trim() || null,
        model: vehicle.model.trim() || null, year: vehicle.year ? Number(vehicle.year) : null,
        ownership_type: vehicle.ownership_type, logbook_start_date: vehicle.logbook_start_date || null,
        logbook_end_date: vehicle.logbook_end_date || null,
        opening_odometer: vehicle.opening_odometer ? Number(vehicle.opening_odometer) : null,
        closing_odometer: vehicle.closing_odometer ? Number(vehicle.closing_odometer) : null,
        is_active: vehicle.is_active, notes: vehicle.notes.trim() || null
      });
      const companyId = vehicle.company_profile_id; setVehicle({ ...vehicleForm(), company_profile_id: companyId });
      await load(); showToast(copy({ en: "Vehicle saved.", zh: "车辆已保存。" }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to save vehicle.", "error"); }
    finally { setSaving(false); }
  }

  async function handleTripSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !trip.vehicle_id || !trip.origin.trim() || !trip.destination.trim() || !trip.purpose.trim()) return;
    if (Number(trip.end_odometer) < Number(trip.start_odometer)) {
      showToast(copy({ en: "End odometer must be at least the start odometer.", zh: "结束里程不能小于开始里程。" }), "error"); return;
    }
    const linkedVehicle = vehicles.find((item) => item.id === trip.vehicle_id);
    setSaving(true);
    try {
      await upsertVehicleTrip(user.id, {
        id: trip.id, vehicle_id: trip.vehicle_id, company_profile_id: linkedVehicle?.company_profile_id ?? null,
        start_date: trip.start_date, end_date: trip.end_date, origin: trip.origin.trim(),
        destination: trip.destination.trim(), purpose: trip.purpose.trim(),
        start_odometer: Number(trip.start_odometer), end_odometer: Number(trip.end_odometer),
        is_business: Number(trip.business_use_percent) > 0,
        business_use_percent: Number(trip.business_use_percent),
        driver: trip.driver.trim() || null, notes: trip.notes.trim() || null
      });
      const vehicleId = trip.vehicle_id; setTrip({ ...tripForm(), vehicle_id: vehicleId });
      await load(); showToast(copy({ en: "Logbook trip saved.", zh: "行程日志已保存。" }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to save trip.", "error"); }
    finally { setSaving(false); }
  }

  async function removeVehicle(item: Vehicle) {
    if (!user || !window.confirm(copy({ en: `Delete ${item.name} and all its trips?`, zh: `删除 ${item.name} 及其全部行程？` }))) return;
    setSaving(true);
    try { await deleteVehicle(user.id, item.id); await load(); }
    catch (error) { showToast(error instanceof Error ? error.message : "Unable to delete vehicle.", "error"); }
    finally { setSaving(false); }
  }

  async function removeTrip(item: VehicleTrip) {
    if (!user || !window.confirm(copy({ en: "Delete this trip?", zh: "删除这条行程？" }))) return;
    setSaving(true);
    try { await deleteVehicleTrip(user.id, item.id); await load(); }
    catch (error) { showToast(error instanceof Error ? error.message : "Unable to delete trip.", "error"); }
    finally { setSaving(false); }
  }

  async function downloadAccountantPack() {
    setSaving(true);
    try {
      const fy = australianFiscalYear(); const selectedCompany = companies.find((item) => item.id === companyFilter);
      const summary = calculateBasSummary({ documents, expenses, companyProfileId: companyFilter === "all" ? null : companyFilter, accountingBasis: selectedCompany?.gst_accounting_basis ?? "cash", periodStart: fy.start, periodEnd: fy.end });
      const reportBlob = await pdf(<BasReportPdf companyName={selectedCompany?.business_name ?? "All companies"} summary={summary} />).toBlob();
      const fyDocuments = documents.filter((item) => item.type === "invoice" && (companyFilter === "all" || item.company_profile_id === companyFilter) && inDateRange(item.issue_date, fy.start, fy.end));
      const fyExpenses = visibleExpenses.filter((item) => inDateRange(item.expense_date, fy.start, fy.end));
      const fyExpenseIds = new Set(fyExpenses.map((item) => item.id));
      const fyReceipts = receipts.filter((item) => fyExpenseIds.has(item.expense_id));
      const fyTrips = visibleTrips.filter((item) => inDateRange(item.start_date, fy.start, fy.end));
      const fyLossRecords = returnLossRecords(documents, { companyProfileId: companyFilter === "all" ? null : companyFilter, periodStart: fy.start, periodEnd: fy.end });
      const files: Record<string, Uint8Array> = {
        [`${fy.label}-BAS-summary.pdf`]: new Uint8Array(await reportBlob.arrayBuffer()),
        [`${fy.label}-invoice-register.csv`]: strToU8(rowsToCsv([["Number", "Status", "Issue date", "Paid date", "Customer", "Total", "GST"], ...fyDocuments.map((item) => [item.number, item.status, item.issue_date, item.paid_at ?? "", item.bill_to?.name ?? "", item.totals?.total ?? 0, item.totals?.gst ?? 0])])),
        [`${fy.label}-expense-register.csv`]: strToU8(rowsToCsv([["Date", "Supplier", "Supplier ABN", "Reference", "Category", "Purchase type", "Total", "Claimable GST", "GST treatment", "Business use %", "Paid from", "Vehicle", "Notes"], ...fyExpenses.map((item) => [item.expense_date, item.merchant, item.supplier_abn ?? "", item.reference ?? "", item.category, item.purchase_type, item.total_amount, item.gst_amount, item.gst_treatment, item.business_use_percent, accounts.find((a) => a.id === item.payment_account_id)?.name ?? item.payment_method ?? "", vehicles.find((v) => v.id === item.vehicle_id)?.name ?? "", item.notes ?? ""])])),
        [`${fy.label}-payment-accounts.csv`]: strToU8(rowsToCsv([["Name", "Type", "Last four", "Company", "Default", "Active", "Notes"], ...visibleAccounts.map((item) => [item.name, item.account_type, item.last_four ?? "", companies.find((c) => c.id === item.company_profile_id)?.business_name ?? "", item.is_default ? "Yes" : "No", item.is_active ? "Yes" : "No", item.notes ?? ""])])),
        [`${fy.label}-vehicle-logbook.csv`]: strToU8(rowsToCsv([["Start date", "End date", "Vehicle", "Registration", "Driver", "Origin", "Destination", "Purpose", "Start odometer", "End odometer", "Total kilometres", "Business use %", "Business kilometres", "Notes"], ...fyTrips.map((item) => { const v = vehicles.find((candidate) => candidate.id === item.vehicle_id); return [item.start_date, item.end_date, v?.name ?? "", v?.registration ?? "", item.driver ?? "", item.origin, item.destination, item.purpose, item.start_odometer, item.end_odometer, tripKilometres(item), item.business_use_percent, tripBusinessKilometres(item), item.notes ?? ""]; })])),
        [`${fy.label}-vehicle-summary.csv`]: strToU8(rowsToCsv([["Vehicle", "Registration", "Logbook start", "Logbook end", "Opening odometer", "Closing odometer", "Trip km", "Business km", "Business use %", "12-week period"], ...visibleVehicles.map((item) => { const result = vehicleLogbookSummary(item, trips); return [item.name, item.registration, item.logbook_start_date ?? "", item.logbook_end_date ?? "", item.opening_odometer ?? "", item.closing_odometer ?? "", result.totalKilometres, result.businessKilometres, result.businessUsePercent, result.hasRepresentativePeriod ? "Yes" : "No"]; })])),
        [`${fy.label}-receipt-index.csv`]: strToU8(rowsToCsv([["Expense ID", "File name", "MIME type", "Uploaded at"], ...fyReceipts.map((item) => [item.expense_id, item.file_name, item.mime_type ?? "", item.created_at])])),
        [`${fy.label}-returns-loss-register.csv`]: strToU8(rowsToCsv([["Paid date", "Invoice", "Customer", "Description", "Details", "Quantity", "Unit price", "Return / loss value", "GST adjustment"], ...fyLossRecords.map((item) => [item.date, item.documentNumber, item.customer, item.description, item.details, item.quantity, item.unitPrice, item.amount, item.gstAdjustment])]))
      };
      for (const [index, receipt] of fyReceipts.entries()) {
        if (!receipt.signed_url) continue; const response = await fetch(receipt.signed_url); if (!response.ok) continue;
        files[`receipts/${String(index + 1).padStart(3, "0")}-${receipt.file_name.replace(/[^a-zA-Z0-9._-]/g, "-")}`] = new Uint8Array(await response.arrayBuffer());
      }
      const blob = new Blob([new Uint8Array(zipSync(files))], { type: "application/zip" });
      const url = URL.createObjectURL(blob); const anchor = window.document.createElement("a"); anchor.href = url;
      anchor.download = `papermint-${fy.label.toLowerCase()}-accountant-pack.zip`; anchor.click(); URL.revokeObjectURL(url);
      showToast(copy({ en: "Accountant pack downloaded.", zh: "会计资料包已下载。" }));
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to build accountant pack.", "error"); }
    finally { setSaving(false); }
  }

  const companyOptions = [{ value: "", label: copy({ en: "No company", zh: "未指定公司" }) }, ...companies.map((item) => ({ value: item.id, label: item.business_name }))];
  const filterCompanyOptions = [{ value: "all", label: copy({ en: "All companies", zh: "全部公司" }) }, ...companies.map((item) => ({ value: item.id, label: item.business_name }))];
  const accountOptions = [{ value: "", label: copy({ en: "Select payment account", zh: "选择付款账户" }) }, ...accounts.filter((item) => item.is_active && (!form.company_profile_id || !item.company_profile_id || item.company_profile_id === form.company_profile_id)).map((item) => ({ value: item.id, label: `${item.name}${item.last_four ? ` •••• ${item.last_four}` : ""}` }))];
  const vehicleOptions = [{ value: "", label: copy({ en: "No linked vehicle", zh: "不关联车辆" }) }, ...vehicles.filter((item) => item.is_active).map((item) => ({ value: item.id, label: `${item.name} · ${item.registration}` }))];

  return (
    <ProtectedRoute><AppShell>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h1 className="text-3xl font-black">{copy({ en: "Bookkeeping", zh: "记账" })}</h1><p className="mt-1 text-sm font-semibold text-[var(--muted)]">{copy({ en: "Expenses, payment sources, evidence and vehicle records in one lightweight workspace.", zh: "在一个轻量工作区管理费用、付款来源、凭证和车辆日志。" })}</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><Select label={copy({ en: "Company view", zh: "公司视图" })} value={companyFilter} onChange={setCompanyFilter} options={filterCompanyOptions} /><button className="btn-secondary mb-px" disabled={saving} onClick={downloadAccountantPack} type="button"><FileArchive className="h-4 w-4" />{copy({ en: "Download FY pack", zh: "下载财年资料包" })}</button></div>
      </div>

      <div className="mb-5 grid gap-2 rounded-lg border border-[var(--line)] bg-white p-2 sm:grid-cols-3">
        <TabButton active={tab === "expenses"} icon={<ReceiptText className="h-4 w-4" />} label={copy({ en: "Expenses", zh: "费用" })} onClick={() => setTab("expenses")} />
        <TabButton active={tab === "accounts"} icon={<WalletCards className="h-4 w-4" />} label={copy({ en: "Payment accounts", zh: "付款账户" })} onClick={() => setTab("accounts")} />
        <TabButton active={tab === "logbook"} icon={<Car className="h-4 w-4" />} label={copy({ en: "Vehicle logbook", zh: "车辆 Logbook" })} onClick={() => setTab("logbook")} />
      </div>

      {tab === "expenses" ? <div className="grid min-w-0 gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className="panel min-w-0 p-5">
          <SectionTitle icon={<ReceiptText className="h-5 w-5" />} title={form.id ? copy({ en: "Edit expense", zh: "编辑费用" }) : copy({ en: "Record expense", zh: "记录费用" })} subtitle={copy({ en: "Record the purchase, tax treatment and where it was paid from.", zh: "记录采购、税务处理和实际付款来源。" })} />
          <form className="mt-5 grid gap-3" onSubmit={handleExpenseSubmit}>
            <Select label={copy({ en: "Company", zh: "公司" })} value={form.company_profile_id} onChange={(value) => setForm({ ...form, company_profile_id: value })} options={companyOptions} />
            <div className="grid grid-cols-2 gap-3"><Field label={copy({ en: "Supplier / Merchant", zh: "供应商 / 商家" })} required value={form.merchant} onChange={(value) => setForm({ ...form, merchant: value })} /><Field label={copy({ en: "Supplier ABN", zh: "供应商 ABN" })} value={form.supplier_abn} onChange={(value) => setForm({ ...form, supplier_abn: value })} /></div>
            <div className="grid grid-cols-2 gap-3"><Field label={copy({ en: "Date", zh: "日期" })} type="date" value={form.expense_date} onChange={(value) => setForm({ ...form, expense_date: value })} /><Field label={copy({ en: "Invoice / receipt ref", zh: "发票 / 收据编号" })} value={form.reference} onChange={(value) => setForm({ ...form, reference: value })} /></div>
            <div className="grid grid-cols-2 gap-3"><Select label={copy({ en: "Category", zh: "类别" })} value={form.category} onChange={(value) => { const category = value as ExpenseCategory; setForm({ ...form, category, purchase_type: category === "inventory" ? "non_capital" : form.purchase_type }); }} options={categories.map((item) => ({ value: item, label: categoryLabel(item) }))} /><Select disabled={form.category === "inventory"} label={copy({ en: "Purchase type", zh: "采购类型" })} value={form.purchase_type} onChange={(value) => setForm({ ...form, purchase_type: value as ExpenseForm["purchase_type"] })} options={[{ value: "non_capital", label: "Non-capital (G11)" }, { value: "capital", label: "Capital (G10)" }]} /></div>
            {form.category === "inventory" ? <Info>{copy({ en: "Trading stock is included in BAS G11; eligible GST is included in 1B.", zh: "进货成本计入 BAS G11；符合条件的 GST 计入 1B。" })}</Info> : null}
            <div className="grid grid-cols-2 gap-3"><Field inputMode="decimal" label={copy({ en: "Total incl. GST", zh: "含 GST 总额" })} required value={form.total_amount} onChange={updateTotal} /><Field inputMode="decimal" label={copy({ en: "Business use %", zh: "业务用途 %" })} max="100" min="0" step="0.01" type="number" value={form.business_use_percent} onChange={(value) => setForm({ ...form, business_use_percent: value, gst_amount: calculateClaimableGst(Number(form.total_amount), form.gst_treatment, Number(value)) })} /></div>
            <div className="grid grid-cols-2 gap-3"><Select label={copy({ en: "GST treatment", zh: "GST 税务处理" })} value={form.gst_treatment} onChange={(value) => { const treatment = value as GstTreatment; const claimable = treatment === "gst"; setForm({ ...form, gst_treatment: treatment, gst_claimable: claimable, gst_amount: calculateClaimableGst(Number(form.total_amount), treatment, Number(form.business_use_percent)) }); }} options={[{ value: "gst", label: copy({ en: "Taxable purchase (GST)", zh: "应税采购（含 GST）" }) }, { value: "gst_free", label: copy({ en: "GST-free", zh: "GST-free" }) }, { value: "input_taxed", label: copy({ en: "Input taxed / no credit", zh: "Input taxed / 不申报抵扣" }) }, { value: "not_registered", label: copy({ en: "Supplier not GST registered", zh: "供应商未注册 GST" }) }]} /><Field inputMode="decimal" label={copy({ en: "Claimable GST", zh: "可申报 GST" })} value={form.gst_amount} onChange={(value) => setForm({ ...form, gst_amount: value })} /></div>
            <Select label={copy({ en: "Paid from / Payment account", zh: "Paid from / 付款账户" })} value={form.payment_account_id} onChange={(value) => setForm({ ...form, payment_account_id: value })} options={accountOptions} />
            {accounts.length === 0 ? <button className="rounded-lg border border-dashed border-[var(--line)] p-3 text-left text-xs font-bold text-[var(--mint-dark)]" onClick={() => setTab("accounts")} type="button">{copy({ en: "+ Set up a bank, card, cash or Director loan account", zh: "+ 设置银行、信用卡、现金或 Director Loan 账户" })}</button> : null}
            <Select label={copy({ en: "Linked vehicle (optional)", zh: "关联车辆（可选）" })} value={form.vehicle_id} onChange={(value) => setForm({ ...form, vehicle_id: value })} options={vehicleOptions} />
            <label><span className="label">{t("notes")}</span><textarea className="field min-h-20 resize-y" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[var(--line)] bg-white/60 p-3 text-sm font-bold"><Upload className="h-4 w-4" /><span className="min-w-0 flex-1">{pendingReceipts.length ? copy({ en: `${pendingReceipts.length} attachment(s) selected`, zh: `已选择 ${pendingReceipts.length} 个附件` }) : copy({ en: "Attach receipts or invoices (PDF/images)", zh: "上传收据或发票（PDF/图片）" })}</span><input accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" multiple onChange={(event) => setPendingReceipts(Array.from(event.target.files ?? []))} type="file" /></label>
            {pendingReceipts.map((file, index) => <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--muted)]" key={`${file.name}:${index}`}><span className="truncate">{file.name}</span><button onClick={() => setPendingReceipts((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><X className="h-4 w-4" /></button></div>)}
            {form.id && receipts.some((item) => item.expense_id === form.id) ? <div className="grid gap-2 rounded-lg bg-[#f7f9f6] p-3">{receipts.filter((item) => item.expense_id === form.id).map((item) => <div className="flex items-center gap-2 text-xs" key={item.id}><Paperclip className="h-4 w-4" /><a className="min-w-0 flex-1 truncate font-bold hover:text-[var(--mint-dark)]" href={item.signed_url ?? "#"} target="_blank" rel="noreferrer">{item.file_name}</a><button className="text-[var(--rose)]" onClick={() => removeReceipt(item)} type="button"><Trash2 className="h-4 w-4" /></button></div>)}</div> : null}
            <div className="flex gap-2"><button className="btn-primary flex-1" disabled={saving} type="submit">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{form.id ? t("save") : copy({ en: "Add expense", zh: "添加费用" })}</button>{form.id ? <button className="btn-secondary" onClick={() => { setForm(expenseForm()); setPendingReceipts([]); }} type="button">{copy({ en: "Cancel", zh: "取消" })}</button> : null}</div>
          </form>
        </section>

        <div className="grid min-w-0 gap-5 content-start">
          <section className="panel min-w-0 p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">{copy({ en: "Expense register", zh: "费用记录" })}</h2><p className="text-sm font-semibold text-[var(--muted)]">{visibleExpenses.length} {copy({ en: "entries", zh: "条记录" })} · {formatAud(totals.total)} · GST {formatAud(totals.gst)}</p><p className="mt-1 text-xs font-black text-[var(--mint-dark)]">{copy({ en: "Inventory purchases", zh: "进货成本" })}: {formatAud(inventoryTotals.total)} · GST {formatAud(inventoryTotals.gst)}</p></div></div>
            {loading ? <Loading /> : visibleExpenses.length === 0 ? <Empty>{copy({ en: "No expenses in this view.", zh: "当前没有费用记录。" })}</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><th className="py-3">{copy({ en: "Date / Supplier", zh: "日期 / 供应商" })}</th><th>{copy({ en: "Category", zh: "类别" })}</th><th>{copy({ en: "Paid from", zh: "付款账户" })}</th><th className="text-right">GST</th><th className="text-right">{t("total")}</th><th className="text-right">{copy({ en: "Evidence", zh: "凭证" })}</th><th /></tr></thead><tbody>{visibleExpenses.map((item) => { const linkedReceipts = receipts.filter((receipt) => receipt.expense_id === item.id); return <tr className="border-b border-[#eef2ef]" key={item.id}><td className="py-4"><button className="text-left" onClick={() => editExpense(item)} type="button"><span className="block font-black">{item.merchant}</span><span className="text-xs font-semibold text-[var(--muted)]">{item.expense_date}{item.reference ? ` · ${item.reference}` : ""}</span></button></td><td>{categoryLabel(item.category)}<span className="block text-xs text-[var(--muted)]">{item.business_use_percent ?? 100}% business</span></td><td>{accounts.find((a) => a.id === item.payment_account_id)?.name ?? item.payment_method ?? "-"}</td><td className="text-right">{formatAud(item.gst_claimable ? item.gst_amount : 0)}</td><td className="text-right font-black">{formatAud(item.total_amount)}</td><td className="text-right"><div className="flex justify-end gap-1">{linkedReceipts.slice(0, 3).map((receipt) => receipt.signed_url ? <a className="icon-btn" href={receipt.signed_url} key={receipt.id} rel="noreferrer" target="_blank" title={receipt.file_name}><ExternalLink className="h-4 w-4" /></a> : null)}{linkedReceipts.length === 0 ? <Paperclip className="h-4 w-4 text-[var(--muted)]" /> : null}</div></td><td className="text-right"><button className="icon-btn ml-auto text-[var(--rose)]" onClick={() => setDeleteTarget(item)} type="button"><Trash2 className="h-4 w-4" /></button></td></tr>; })}</tbody></table></div>}
          </section>
          <section className="panel min-w-0 p-5"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">{copy({ en: "Returns & loss register", zh: "退货与损耗记录" })}</h2><p className="text-sm font-semibold text-[var(--muted)]">{copy({ en: "Negative-price items from paid invoices appear automatically.", zh: "已付款 Invoice 的负单价项目会自动显示。" })}</p></div><p className="text-sm font-black text-[var(--rose)]">{lossRecords.length} · {formatAud(lossTotals.amount)} · GST {formatAud(lossTotals.gst)}</p></div>{lossRecords.length === 0 ? <Empty>{copy({ en: "No return or loss adjustments.", zh: "当前没有退货或损耗记录。" })}</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><th className="py-3">{copy({ en: "Paid date", zh: "付款日期" })}</th><th>{copy({ en: "Invoice / Customer", zh: "Invoice / 客户" })}</th><th>{copy({ en: "Item", zh: "项目" })}</th><th className="text-right">GST</th><th className="text-right">{copy({ en: "Adjustment", zh: "调整金额" })}</th></tr></thead><tbody>{lossRecords.map((item, index) => <tr className="border-b border-[#eef2ef]" key={`${item.documentId}:${index}`}><td className="py-3">{item.date}</td><td><Link className="font-black" href={`/documents/${item.documentId}`}>{item.documentNumber}</Link><span className="block text-xs text-[var(--muted)]">{item.customer}</span></td><td>{item.description}</td><td className="text-right">-{formatAud(item.gstAdjustment)}</td><td className="text-right font-black text-[var(--rose)]">-{formatAud(item.amount)}</td></tr>)}</tbody></table></div>}</section>
        </div>
      </div> : null}

      {tab === "accounts" ? <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="panel p-5"><SectionTitle icon={<Landmark className="h-5 w-5" />} title={account.id ? copy({ en: "Edit payment account", zh: "编辑付款账户" }) : copy({ en: "Add payment account", zh: "添加付款账户" })} subtitle={copy({ en: "Use these accounts to explain how each purchase was funded.", zh: "用付款账户说明每笔采购的资金来源。" })} /><form className="mt-5 grid gap-3" onSubmit={handleAccountSubmit}><Select label={copy({ en: "Company", zh: "公司" })} value={account.company_profile_id} onChange={(value) => setAccount({ ...account, company_profile_id: value })} options={companyOptions} /><Field label={copy({ en: "Account name", zh: "账户名称" })} required value={account.name} onChange={(value) => setAccount({ ...account, name: value })} /><Select label={copy({ en: "Account type", zh: "账户类型" })} value={account.account_type} onChange={(value) => setAccount({ ...account, account_type: value as PaymentAccountType })} options={(Object.keys({ bank: 1, credit_card: 1, cash: 1, director_loan: 1, owner_contribution: 1, reimbursement_clearing: 1, other: 1 }) as PaymentAccountType[]).map((item) => ({ value: item, label: accountTypeLabel(item) }))} /><Field label={copy({ en: "Last four digits (optional)", zh: "末四位（可选）" })} maxLength={4} value={account.last_four} onChange={(value) => setAccount({ ...account, last_four: value.replace(/\D/g, "").slice(0, 4) })} /><Check label={copy({ en: "Default payment account", zh: "默认付款账户" })} checked={account.is_default} onChange={(checked) => setAccount({ ...account, is_default: checked })} /><Check label={copy({ en: "Active", zh: "启用" })} checked={account.is_active} onChange={(checked) => setAccount({ ...account, is_active: checked })} /><label><span className="label">{t("notes")}</span><textarea className="field min-h-20" value={account.notes} onChange={(event) => setAccount({ ...account, notes: event.target.value })} /></label><div className="flex gap-2"><button className="btn-primary flex-1" disabled={saving} type="submit"><Plus className="h-4 w-4" />{t("save")}</button>{account.id ? <button className="btn-secondary" onClick={() => setAccount(accountForm())} type="button">{copy({ en: "Cancel", zh: "取消" })}</button> : null}</div></form><button className="mt-3 w-full rounded-lg border border-dashed border-[var(--line)] p-3 text-sm font-black text-[var(--mint-dark)]" disabled={saving} onClick={setupCommonAccounts} type="button">{copy({ en: "Quick setup common accounts", zh: "一键添加常用账户" })}</button></section>
        <section className="panel p-5"><h2 className="text-xl font-black">{copy({ en: "Payment accounts", zh: "付款账户" })}</h2><p className="mt-1 text-sm font-semibold text-[var(--muted)]">{copy({ en: "Bank, card, cash and funding accounts. This is a source-of-funds register, not bank reconciliation.", zh: "管理银行、信用卡、现金和垫资账户。本功能记录资金来源，不代替银行对账。" })}</p><Info className="mt-4">{copy({ en: "Director loan and owner funding entries must reflect the real transaction. Private company payments can raise Division 7A or FBT issues; have your accountant review them.", zh: "Director Loan 和业主垫资必须反映真实交易。私人公司付款可能涉及 Division 7A 或 FBT，请让会计师复核。" })}</Info>{visibleAccounts.length === 0 ? <div className="mt-4"><Empty>{copy({ en: "No payment accounts yet. Use quick setup or add one manually.", zh: "尚未设置付款账户，可一键添加或手动创建。" })}</Empty></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{visibleAccounts.map((item) => <div className="rounded-lg border border-[var(--line)] bg-white p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{item.name}{item.last_four ? ` •••• ${item.last_four}` : ""}</p><p className="text-xs font-semibold text-[var(--muted)]">{accountTypeLabel(item.account_type)}{item.is_default ? ` · ${copy({ en: "Default", zh: "默认" })}` : ""}{!item.is_active ? ` · ${copy({ en: "Inactive", zh: "停用" })}` : ""}</p></div><div className="flex gap-1"><button className="icon-btn" onClick={() => setAccount({ id: item.id, company_profile_id: item.company_profile_id ?? "", name: item.name, account_type: item.account_type, last_four: item.last_four ?? "", is_default: item.is_default, is_active: item.is_active, notes: item.notes ?? "" })} type="button"><Pencil className="h-4 w-4" /></button><button className="icon-btn text-[var(--rose)]" onClick={() => removeAccount(item)} type="button"><Trash2 className="h-4 w-4" /></button></div></div>{item.notes ? <p className="mt-2 text-xs text-[var(--muted)]">{item.notes}</p> : null}</div>)}</div>}</section>
      </div> : null}

      {tab === "logbook" ? <div className="grid gap-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="panel p-5"><SectionTitle icon={<Car className="h-5 w-5" />} title={vehicle.id ? copy({ en: "Edit vehicle", zh: "编辑车辆" }) : copy({ en: "Vehicle profile", zh: "车辆档案" })} subtitle={copy({ en: "Keep vehicle identity, ownership and the representative logbook period.", zh: "保存车辆身份、所有权和代表性 logbook 周期。" })} /><form className="mt-5 grid gap-3" onSubmit={handleVehicleSubmit}><Select label={copy({ en: "Company", zh: "公司" })} value={vehicle.company_profile_id} onChange={(value) => setVehicle({ ...vehicle, company_profile_id: value })} options={companyOptions} /><div className="grid grid-cols-2 gap-3"><Field label={copy({ en: "Vehicle name", zh: "车辆名称" })} required value={vehicle.name} onChange={(value) => setVehicle({ ...vehicle, name: value })} /><Field label={copy({ en: "Registration", zh: "车牌号" })} required value={vehicle.registration} onChange={(value) => setVehicle({ ...vehicle, registration: value })} /></div><div className="grid grid-cols-3 gap-3"><Field label={copy({ en: "Make", zh: "品牌" })} value={vehicle.make} onChange={(value) => setVehicle({ ...vehicle, make: value })} /><Field label={copy({ en: "Model", zh: "型号" })} value={vehicle.model} onChange={(value) => setVehicle({ ...vehicle, model: value })} /><Field label={copy({ en: "Year", zh: "年份" })} min="1900" max="2200" type="number" value={vehicle.year} onChange={(value) => setVehicle({ ...vehicle, year: value })} /></div><Select label={copy({ en: "Ownership / use", zh: "所有权 / 使用方式" })} value={vehicle.ownership_type} onChange={(value) => setVehicle({ ...vehicle, ownership_type: value as Vehicle["ownership_type"] })} options={[{ value: "business", label: copy({ en: "Business owned", zh: "公司所有" }) }, { value: "leased", label: copy({ en: "Business leased", zh: "公司租赁" }) }, { value: "personal", label: copy({ en: "Personally owned", zh: "个人所有" }) }, { value: "director", label: copy({ en: "Director / shareholder vehicle", zh: "董事 / 股东车辆" }) }]} /><div className="grid grid-cols-2 gap-3"><Field label={copy({ en: "Logbook start", zh: "Logbook 开始" })} type="date" value={vehicle.logbook_start_date} onChange={(value) => setVehicle({ ...vehicle, logbook_start_date: value })} /><Field label={copy({ en: "Logbook end", zh: "Logbook 结束" })} type="date" value={vehicle.logbook_end_date} onChange={(value) => setVehicle({ ...vehicle, logbook_end_date: value })} /></div><div className="grid grid-cols-2 gap-3"><Field inputMode="decimal" label={copy({ en: "Opening odometer", zh: "期初里程" })} value={vehicle.opening_odometer} onChange={(value) => setVehicle({ ...vehicle, opening_odometer: value })} /><Field inputMode="decimal" label={copy({ en: "Closing odometer", zh: "期末里程" })} value={vehicle.closing_odometer} onChange={(value) => setVehicle({ ...vehicle, closing_odometer: value })} /></div><Check label={copy({ en: "Active vehicle", zh: "启用车辆" })} checked={vehicle.is_active} onChange={(checked) => setVehicle({ ...vehicle, is_active: checked })} /><div className="flex gap-2"><button className="btn-primary flex-1" disabled={saving} type="submit"><Plus className="h-4 w-4" />{t("save")}</button>{vehicle.id ? <button className="btn-secondary" onClick={() => setVehicle(vehicleForm())} type="button">{copy({ en: "Cancel", zh: "取消" })}</button> : null}</div></form></section>
          <section className="panel p-5">
            <SectionTitle
              icon={<Route className="h-5 w-5" />}
              title={trip.id ? copy({ en: "Edit journey", zh: "编辑行程" }) : copy({ en: "Add logbook journey", zh: "添加 Logbook 行程" })}
              subtitle={copy({ en: "Journeys default to 100% business use. Adjust the slider for mixed-use travel.", zh: "行程默认按 100% 业务用途记录；混合用途可拖动滑杆调整。" })}
            />
            <form className="mt-5 grid gap-3" onSubmit={handleTripSubmit}>
              <Select label={copy({ en: "Vehicle", zh: "车辆" })} value={trip.vehicle_id} onChange={(value) => setTrip({ ...trip, vehicle_id: value })} options={vehicleOptions.slice(1)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={copy({ en: "Start date", zh: "开始日期" })} type="date" value={trip.start_date} onChange={(value) => setTrip({ ...trip, start_date: value, end_date: trip.end_date < value ? value : trip.end_date })} />
                <Field label={copy({ en: "End date", zh: "结束日期" })} type="date" value={trip.end_date} onChange={(value) => setTrip({ ...trip, end_date: value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={copy({ en: "From", zh: "出发地" })} required value={trip.origin} onChange={(value) => setTrip({ ...trip, origin: value })} />
                <Field label={copy({ en: "To", zh: "目的地" })} required value={trip.destination} onChange={(value) => setTrip({ ...trip, destination: value })} />
              </div>
              <Field label={copy({ en: "Purpose of journey", zh: "行程目的" })} required value={trip.purpose} onChange={(value) => setTrip({ ...trip, purpose: value })} />
              <div className="grid grid-cols-2 gap-3">
                <Field inputMode="decimal" label={copy({ en: "Start odometer", zh: "开始里程" })} required value={trip.start_odometer} onChange={(value) => setTrip({ ...trip, start_odometer: value })} />
                <Field inputMode="decimal" label={copy({ en: "End odometer", zh: "结束里程" })} required value={trip.end_odometer} onChange={(value) => setTrip({ ...trip, end_odometer: value })} />
              </div>
              <BusinessUseSlider
                label={copy({ en: "Business use", zh: "业务用途" })}
                value={Number(trip.business_use_percent)}
                onChange={(value) => setTrip({ ...trip, business_use_percent: String(value) })}
              />
              <div className="grid grid-cols-2 gap-2 text-center">
                <Metric label={copy({ en: "Total distance", zh: "总里程" })} value={`${Math.max(0, Number(trip.end_odometer) - Number(trip.start_odometer)).toFixed(1)} km`} />
                <Metric label={copy({ en: "Business kilometres", zh: "计入业务公里" })} value={`${(Math.max(0, Number(trip.end_odometer) - Number(trip.start_odometer)) * Number(trip.business_use_percent || 0) / 100).toFixed(1)} km`} />
              </div>
              <Field label={copy({ en: "Driver (optional)", zh: "司机（可选）" })} value={trip.driver} onChange={(value) => setTrip({ ...trip, driver: value })} />
              <div className="flex gap-2"><button className="btn-primary flex-1" disabled={saving || vehicles.length === 0} type="submit"><Plus className="h-4 w-4" />{t("save")}</button>{trip.id ? <button className="btn-secondary" onClick={() => setTrip(tripForm())} type="button">{copy({ en: "Cancel", zh: "取消" })}</button> : null}</div>
            </form>
          </section>
        </div>
        <Info>{copy({ en: "ATO logbook records generally need a representative continuous 12-week period, journey dates, start/end odometer readings, kilometres and purpose. Keep yearly opening/closing odometer records and source receipts. A logbook may generally be relied on for up to 5 years if usage remains representative.", zh: "ATO logbook 通常需要连续且有代表性的 12 周记录，包括行程日期、起止里程、公里数和用途；还应保留每财年的期初/期末里程及费用凭证。若使用情况仍具代表性，一份 logbook 通常可使用最多 5 年。" })}</Info>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleVehicles.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><Empty>{copy({ en: "Add a vehicle to start the logbook.", zh: "添加车辆后即可开始记录 Logbook。" })}</Empty></div> : visibleVehicles.map((item) => { const result = vehicleLogbookSummary(item, trips); return <div className="panel p-5" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">{item.name}</h3><p className="text-xs font-bold text-[var(--muted)]">{item.registration} · {[item.make, item.model, item.year].filter(Boolean).join(" ")}</p></div><div className="flex gap-1"><button className="icon-btn" onClick={() => setVehicle({ id: item.id, company_profile_id: item.company_profile_id ?? "", name: item.name, registration: item.registration, make: item.make ?? "", model: item.model ?? "", year: item.year ? String(item.year) : "", ownership_type: item.ownership_type, logbook_start_date: item.logbook_start_date ?? "", logbook_end_date: item.logbook_end_date ?? "", opening_odometer: item.opening_odometer === null ? "" : String(item.opening_odometer), closing_odometer: item.closing_odometer === null ? "" : String(item.closing_odometer), is_active: item.is_active, notes: item.notes ?? "" })} type="button"><Pencil className="h-4 w-4" /></button><button className="icon-btn text-[var(--rose)]" onClick={() => removeVehicle(item)} type="button"><Trash2 className="h-4 w-4" /></button></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric label={copy({ en: "Trips", zh: "行程" })} value={String(result.tripCount)} /><Metric label={copy({ en: "Business km", zh: "业务公里" })} value={`${result.businessKilometres}`} /><Metric label={copy({ en: "Business use", zh: "业务比例" })} value={`${result.businessUsePercent}%`} /></div><div className={`mt-3 rounded-lg p-3 text-xs font-bold ${result.hasRepresentativePeriod && result.hasOdometerPeriod ? "bg-[#e8f4ef] text-[var(--mint-dark)]" : "bg-amber-50 text-amber-800"}`}>{result.hasRepresentativePeriod ? copy({ en: `${result.periodDays}-day period recorded`, zh: `已记录 ${result.periodDays} 天周期` }) : copy({ en: `${result.periodDays}/84 days recorded`, zh: `已记录 ${result.periodDays}/84 天` })}{!result.hasOdometerPeriod ? copy({ en: " · Add opening/closing odometer", zh: " · 请补充期初/期末里程" }) : ""}</div></div>; })}</section>
        <section className="panel min-w-0 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-xl font-black">{copy({ en: "Journey register", zh: "行程记录" })}</h2><p className="text-sm font-semibold text-[var(--muted)]">{visibleTrips.length} {copy({ en: "journeys", zh: "条行程" })} · {visibleTrips.reduce((sum, item) => sum + tripBusinessKilometres(item), 0).toFixed(1)} {copy({ en: "business km", zh: "业务公里" })}</p></div>
            <Select label={copy({ en: "Vehicle filter", zh: "车辆筛选" })} value={vehicleFilter} onChange={setVehicleFilter} options={[{ value: "all", label: copy({ en: "All vehicles", zh: "全部车辆" }) }, ...vehicles.map((item) => ({ value: item.id, label: item.name }))]} />
          </div>
          {visibleTrips.length === 0 ? <Empty>{copy({ en: "No journeys in this view.", zh: "当前没有行程记录。" })}</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead><tr className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><th className="py-3">{copy({ en: "Date / Vehicle", zh: "日期 / 车辆" })}</th><th>{copy({ en: "Route", zh: "路线" })}</th><th>{copy({ en: "Purpose", zh: "目的" })}</th><th className="text-right">{copy({ en: "Business %", zh: "业务 %" })}</th><th className="text-right">{copy({ en: "Business km", zh: "业务公里" })}</th><th /></tr></thead><tbody>{visibleTrips.map((item) => <tr className="border-b border-[#eef2ef]" key={item.id}><td className="py-3"><span className="font-black">{item.start_date}{item.end_date !== item.start_date ? ` – ${item.end_date}` : ""}</span><span className="block text-xs text-[var(--muted)]">{vehicles.find((v) => v.id === item.vehicle_id)?.name ?? "-"}</span></td><td>{item.origin} → {item.destination}<span className="block text-xs text-[var(--muted)]">{item.start_odometer} → {item.end_odometer} · {tripKilometres(item)} km</span></td><td>{item.purpose}</td><td className="text-right font-black">{item.business_use_percent}%</td><td className="text-right font-black text-[var(--mint-dark)]">{tripBusinessKilometres(item)}</td><td><div className="flex justify-end gap-1"><button className="icon-btn" onClick={() => setTrip({ id: item.id, vehicle_id: item.vehicle_id, start_date: item.start_date, end_date: item.end_date, origin: item.origin, destination: item.destination, purpose: item.purpose, start_odometer: String(item.start_odometer), end_odometer: String(item.end_odometer), business_use_percent: String(item.business_use_percent ?? (item.is_business ? 100 : 0)), driver: item.driver ?? "", notes: item.notes ?? "" })} type="button"><Pencil className="h-4 w-4" /></button><button className="icon-btn text-[var(--rose)]" onClick={() => removeTrip(item)} type="button"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}
        </section>
      </div> : null}

      {deleteTarget ? <div className="fixed inset-0 z-[80] grid place-items-center bg-[#17211b]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">{copy({ en: "Delete expense?", zh: "删除这笔费用？" })}</h2><p className="mt-2 text-sm text-[var(--muted)]">{deleteTarget.merchant} · {formatAud(deleteTarget.total_amount)}</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy({ en: "All linked attachments will also be deleted. This cannot be undone.", zh: "所有关联附件也会被删除，此操作无法撤销。" })}</p><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setDeleteTarget(null)} type="button">{copy({ en: "Cancel", zh: "取消" })}</button><button className="btn-primary bg-[var(--rose)]" disabled={saving} onClick={confirmDeleteExpense} type="button"><Trash2 className="h-4 w-4" />{t("delete")}</button></div></div></div> : null}
    </AppShell></ProtectedRoute>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black ${active ? "bg-[#17211b] text-white" : "text-[var(--muted)] hover:bg-[#f3f6f3]"}`} onClick={onClick} type="button">{icon}{label}</button>;
}
function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e8f4ef] text-[var(--mint-dark)]">{icon}</span><div><h2 className="text-xl font-black">{title}</h2><p className="text-sm font-semibold leading-5 text-[var(--muted)]">{subtitle}</p></div></div>;
}
function Info({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-[#cfe4d8] bg-[#eef7f2] p-3 text-xs font-semibold leading-5 text-[var(--mint-dark)] ${className}`}>{children}</div>;
}
function Field({ label, value, onChange, type = "text", required = false, inputMode, min, max, step, maxLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; inputMode?: "decimal"; min?: string; max?: string; step?: string; maxLength?: number }) {
  return <label className="min-w-0"><span className="label">{label}</span><input className="field" inputMode={inputMode} max={max} maxLength={maxLength} min={min} required={required} step={step} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function Select({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return <label className="min-w-0"><span className="label">{label}</span><select className="field disabled:cursor-not-allowed disabled:bg-[#edf1ed] disabled:text-[var(--muted)]" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white/70 p-3 text-sm font-bold"><span>{label}</span><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>;
}
function BusinessUseSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const safeValue = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 100));
  return <label className="rounded-lg border border-[var(--line)] bg-white/70 p-3"><span className="mb-2 flex items-center justify-between text-sm font-black"><span>{label}</span><span className="rounded-md bg-[#e8f4ef] px-2 py-1 text-[var(--mint-dark)]">{safeValue}%</span></span><input aria-label={label} className="w-full cursor-pointer accent-[var(--mint-dark)]" max="100" min="0" onChange={(event) => onChange(Number(event.target.value))} step="1" type="range" value={safeValue} /><span className="mt-1 flex justify-between text-[10px] font-bold text-[var(--muted)]"><span>0%</span><span>100%</span></span></label>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#f5f7f4] p-2"><span className="block text-[10px] font-bold text-[var(--muted)]">{label}</span><strong className="text-base">{value}</strong></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm font-semibold text-[var(--muted)]">{children}</div>; }
function Loading() { return <div className="flex items-center gap-2 p-6 text-sm font-semibold text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>; }
