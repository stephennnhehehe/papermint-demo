"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Download, Eye, EyeOff, ListPlus, Loader2, LockKeyhole, Plus, Printer, Save, Trash2, Upload } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useBilling } from "@/components/app/BillingProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import { calculateTotals, formatAud, lineTotal } from "@/lib/calculations";
import { billingErrorMessage, isFreeDocumentLimitReached } from "@/lib/billing";
import { pickLanguage, type Language } from "@/lib/i18n";
import { cleanDecimalInput, decimalValue, parseQuickLineItems } from "@/lib/line-items";
import {
  createEmptyDocument,
  createLineItem,
  companyRecordToParty,
  customerToParty,
  customerToShipParty,
  defaultCompanyProfile,
  emptyParty,
  generateDocumentNumber,
  sanitizeDocumentNumber
} from "@/lib/documents";
import {
  fetchCompanyProfiles,
  fetchCustomers,
  fetchDocument,
  fetchDocuments,
  fetchProfile,
  saveDocument,
  upsertCompanyProfile,
  upsertCustomer
} from "@/lib/api";
import { uploadLogo } from "@/lib/storage";
import type {
  CompanyProfile,
  CompanyRecord,
  Customer,
  DiscountType,
  DocumentStatus,
  DocumentType,
  LineItem,
  PaperDocument,
  Party
} from "@/lib/types";
import { DocumentPreview } from "./DocumentPreview";
import { StatusBadge } from "./StatusBadge";
import { PaperMintPdf } from "../pdf/DocumentPdf";

const statuses: DocumentStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];

function profileFromRow(row: Awaited<ReturnType<typeof fetchProfile>>): CompanyProfile {
  if (!row) return defaultCompanyProfile;
  return {
    business_name: row.business_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    abn: row.abn ?? "",
    address: row.address ?? "",
    logo_url: row.logo_url ?? "",
    default_payment_methods:
      row.default_payment_methods ?? defaultCompanyProfile.default_payment_methods,
    default_notes: row.default_notes ?? defaultCompanyProfile.default_notes
  };
}

function companyProfileFromRecord(
  company: CompanyRecord,
  defaults: CompanyProfile
): CompanyProfile {
  return {
    business_name: company.business_name,
    email: company.email ?? "",
    phone: company.phone ?? "",
    abn: company.abn ?? "",
    address: company.address ?? "",
    logo_url: company.logo_url ?? "",
    default_payment_methods: defaults.default_payment_methods,
    default_notes: defaults.default_notes
  };
}

function fallbackCompanyRecord(
  userId: string,
  profile: CompanyProfile
): CompanyRecord | null {
  if (!profile.business_name) return null;
  const timestamp = new Date().toISOString();
  return {
    id: "default-profile",
    user_id: userId,
    business_name: profile.business_name,
    email: profile.email,
    phone: profile.phone,
    abn: profile.abn,
    address: profile.address,
    logo_url: profile.logo_url,
    is_default: true,
    gst_registered: true,
    gst_accounting_basis: "cash",
    bas_frequency: "quarterly",
    created_at: timestamp,
    updated_at: timestamp
  };
}

export function DocumentEditor({ documentId }: { documentId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("type") === "quote" ? "quote" : "invoice";
  const draftSession = searchParams.get("session");
  const { user } = useAuth();
  const { billing, loading: billingLoading, refreshBilling } = useBilling();
  const { t, language } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const { showToast } = useToast();
  const [paper, setPaper] = useState<PaperDocument | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [autoSavedAt, setAutoSavedAt] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCompanyProfileId, setSelectedCompanyProfileId] = useState("");
  const [quickItemsText, setQuickItemsText] = useState("");
  const limitReached = isFreeDocumentLimitReached(billing);

  const draftKey = useMemo(() => {
    if (!user) return "";
    if (documentId) return `papermint:draft:${user.id}:edit:${documentId}`;
    if (!draftSession) return "";
    return `papermint:draft:${user.id}:new:${draftSession}`;
  }, [documentId, draftSession, user]);

  useEffect(() => {
    if (!documentId && !draftSession) {
      router.replace(`/documents/new?type=${requestedType}&session=${crypto.randomUUID()}`);
    }
  }, [documentId, draftSession, requestedType, router]);

  useEffect(() => {
    if (!user) return;
    if (!documentId && !draftSession) return;
    const currentUser = user;
    let active = true;

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const [customerRows, profileRow, companyRows, documentRows] = await Promise.all([
          fetchCustomers(currentUser.id),
          fetchProfile(currentUser.id),
          fetchCompanyProfiles(currentUser.id),
          fetchDocuments(currentUser.id)
        ]);
        if (!active) return;
        setCustomers(customerRows);
        const defaultProfile = profileFromRow(profileRow);
        const fallbackCompany = fallbackCompanyRecord(currentUser.id, defaultProfile);
        const mergedCompanyRows =
          companyRows.length > 0 || !fallbackCompany ? companyRows : [fallbackCompany];
        setCompanyProfiles(mergedCompanyRows);

        let nextPaper: PaperDocument | null = null;
        if (documentId) {
          nextPaper = await fetchDocument(currentUser.id, documentId);
          if (!nextPaper) throw new Error("Document not found.");
        } else {
          const defaultCompany =
            mergedCompanyRows.find((company) => company.is_default) ?? mergedCompanyRows[0];
          const initialProfile = defaultCompany
            ? companyProfileFromRecord(defaultCompany, defaultProfile)
            : defaultProfile;
          nextPaper = createEmptyDocument(requestedType, initialProfile);
          nextPaper.number = generateDocumentNumber(
            "",
            requestedType,
            documentRows,
            nextPaper.issueDate
          );
        }

        const savedDraft = draftKey ? window.localStorage.getItem(draftKey) : null;
        if (savedDraft) {
          nextPaper = JSON.parse(savedDraft) as PaperDocument;
        }

        setPaper(nextPaper);
        const matchedCompany = mergedCompanyRows.find(
          (company) =>
            company.business_name === nextPaper?.company.name &&
            (company.abn ?? "") === (nextPaper?.company.abn ?? "")
        );
        setSelectedCompanyProfileId(matchedCompany?.id ?? "");
        if (matchedCompany && !nextPaper.companyProfileId) {
          nextPaper = { ...nextPaper, companyProfileId: matchedCompany.id === "default-profile" ? null : matchedCompany.id };
          setPaper(nextPaper);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load document.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [documentId, draftKey, draftSession, requestedType, user]);

  useEffect(() => {
    if (!paper || !draftKey || loading) return;
    const handle = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify(paper));
      setAutoSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 700);

    return () => window.clearTimeout(handle);
  }, [draftKey, loading, paper]);

  const totals = useMemo(() => {
    if (!paper) return null;
    return calculateTotals(paper.lineItems, paper.orderDiscount, paper.gstEnabled, paper.gstRate);
  }, [paper]);

  function updatePaper(patch: Partial<PaperDocument>) {
    setPaper((current) => (current ? { ...current, ...patch } : current));
  }

  function updateParty(kind: "company" | "billTo" | "shipTo", patch: Partial<Party>) {
    setPaper((current) => {
      if (!current) return current;
      const existing = kind === "shipTo" ? current.shipTo ?? { ...emptyParty } : current[kind];
      return {
        ...current,
        [kind]: {
          ...existing,
          ...patch
        }
      };
    });
  }

  function updateLineItem(id: string, patch: Partial<LineItem>) {
    setPaper((current) => {
      if (!current) return current;
      return {
        ...current,
        lineItems: current.lineItems.map((item) => (item.id === id ? { ...item, ...patch } : item))
      };
    });
  }

  function setAllItemGst(gstEnabled: boolean) {
    setPaper((current) => current ? {
      ...current,
      lineItems: current.lineItems.map((item) => ({ ...item, gstEnabled }))
    } : current);
  }

  function handleQuickFill() {
    const parsed = parseQuickLineItems(quickItemsText);
    if (!parsed.length) {
      showToast(copy({ en: "Enter at least one valid item row.", zh: "请至少输入一行有效项目。", vi: "Nhập ít nhất một dòng hợp lệ.", ar: "أدخل بنداً صالحاً واحداً على الأقل." }), "error");
      return;
    }
    const imported = parsed.map((item) => ({ ...item, id: crypto.randomUUID() }));
    setPaper((current) => {
      if (!current) return current;
      const onlyBlankItem = current.lineItems.length === 1 &&
        !current.lineItems[0].description &&
        !current.lineItems[0].details &&
        current.lineItems[0].unitPrice === 0;
      return { ...current, lineItems: onlyBlankItem ? imported : [...current.lineItems, ...imported] };
    });
    setQuickItemsText("");
    showToast(copy({ en: `${imported.length} items added.`, zh: `已添加 ${imported.length} 个项目。`, vi: `Đã thêm ${imported.length} hạng mục.`, ar: `تمت إضافة ${imported.length} بنداً.` }));
  }

  function handleCustomerSelect(customerId: string) {
    if (!customerId) {
      updatePaper({
        customerId: null,
        billTo: { ...emptyParty },
        shipTo: null
      });
      return;
    }
    const customer = customers.find((candidate) => candidate.id === customerId);
    if (!customer || !paper) return;
    updatePaper({
      customerId: customer.id,
      billTo: customerToParty(customer),
      shipTo: customerToShipParty(customer)
    });
  }

  function handleCompanySelect(companyId: string) {
    setSelectedCompanyProfileId(companyId);
    const company = companyProfiles.find((candidate) => candidate.id === companyId);
    if (!companyId) {
      updatePaper({
        companyProfileId: null,
        company: { ...emptyParty },
        logoUrl: ""
      });
      return;
    }
    if (!company) return;
    updatePaper({
      companyProfileId: company.id === "default-profile" ? null : company.id,
      company: companyRecordToParty(company),
      logoUrl: company.logo_url ?? "",
      gstEnabled: company.gst_registered ? paper?.gstEnabled ?? true : false,
      title: paper?.type === "invoice" ? (company.gst_registered ? "TAX INVOICE" : "INVOICE") : "QUOTE"
    });
  }

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    if (!user || !paper) return;
    if (!documentId && limitReached) {
      const issue = billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language);
      setMessage(issue);
      showToast(issue, "error");
      return;
    }
    setSaving(true);
    setSaveConfirmed(false);
    setMessage("");
    try {
      const saved = await saveDocument(user.id, {
        ...paper,
        number: sanitizeDocumentNumber(paper.number)
      });
      setPaper(saved);
      if (draftKey) window.localStorage.removeItem(draftKey);
      const savedMessage = pickLanguage(language, { en: "Document saved.", zh: "单据已保存。", vi: "Đã lưu chứng từ.", ar: "تم حفظ المستند." });
      setMessage(savedMessage);
      setSaveConfirmed(true);
      showToast(savedMessage);
      window.setTimeout(() => setSaveConfirmed(false), 2200);
      await refreshBilling();
      if (!documentId) router.replace(`/documents/${saved.id}`);
    } catch (error) {
      const issue = billingErrorMessage(error, language);
      setMessage(issue);
      showToast(issue, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRememberCustomer() {
    if (!user || !paper || !paper.billTo.name) return;
    try {
      const customer = await upsertCustomer(user.id, {
        name: paper.billTo.name,
        email: paper.billTo.email,
        phone: paper.billTo.phone,
        abn: paper.billTo.abn,
        billing_address: paper.billTo.address,
        shipping_address: paper.shipTo?.address ?? ""
      });
      setCustomers((current) => [customer, ...current.filter((item) => item.id !== customer.id)]);
      updatePaper({ customerId: customer.id });
      const savedMessage = pickLanguage(language, { en: "Customer saved and selected.", zh: "客户已保存并选中。", vi: "Đã lưu và chọn khách hàng.", ar: "تم حفظ العميل واختياره." });
      setMessage(savedMessage);
      showToast(savedMessage);
    } catch (error) {
      const issue = error instanceof Error ? error.message : "Unable to save customer.";
      setMessage(issue);
      showToast(issue, "error");
    }
  }

  async function handleRememberCompany() {
    if (!user || !paper || !paper.company.name) return;
    try {
      const company = await upsertCompanyProfile(user.id, {
        business_name: paper.company.name,
        email: paper.company.email,
        phone: paper.company.phone,
        abn: paper.company.abn,
        address: paper.company.address,
        logo_url: paper.logoUrl,
        is_default: companyProfiles.length === 0
      });
      setCompanyProfiles((current) => [
        company,
        ...current.filter((item) => item.id !== company.id)
      ]);
      const savedMessage = pickLanguage(language, { en: "Issuer profile saved.", zh: "开票方资料已保存。", vi: "Đã lưu hồ sơ bên phát hành.", ar: "تم حفظ ملف جهة الإصدار." });
      setMessage(savedMessage);
      showToast(savedMessage);
    } catch (error) {
      const issue = error instanceof Error ? error.message : "Unable to save issuer profile.";
      setMessage(issue);
      showToast(issue, "error");
    }
  }

  async function handleLogo(file: File | undefined) {
    if (!file || !user || !paper) return;
    setSaving(true);
    try {
      const logoUrl = await uploadLogo(file, user.id);
      updatePaper({ logoUrl });
      const uploaded = pickLanguage(language, { en: "Logo uploaded.", zh: "Logo 已上传。", vi: "Đã tải logo lên.", ar: "تم رفع الشعار." });
      setMessage(uploaded);
      showToast(uploaded);
    } catch (error) {
      const issue = error instanceof Error ? error.message : "Unable to upload logo.";
      setMessage(issue);
      showToast(issue, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!paper) return;
    setDownloading(true);
    try {
      const blob = await pdf(<PaperMintPdf document={paper} showBranding={billing.showBranding} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${paper.type}-${paper.number || "draft"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast(pickLanguage(language, { en: "PDF downloaded.", zh: "PDF 已下载。", vi: "Đã tải PDF.", ar: "تم تنزيل ملف PDF." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to download PDF.", "error");
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    setShowPreview(true);
    window.setTimeout(() => window.print(), 120);
  }

  return (
    <ProtectedRoute>
      <AppShell>
        {billingLoading || loading || !paper || !totals ? (
          <div className="panel flex items-center gap-3 p-5 text-sm font-semibold text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy({ en: "Loading document", zh: "正在加载单据", vi: "Đang tải chứng từ", ar: "جارٍ تحميل المستند" })}
          </div>
        ) : !documentId && limitReached ? (
          <section className="mx-auto max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-7 text-center shadow-sm">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-amber-100 text-amber-800"><LockKeyhole className="h-6 w-6" /></span>
            <h1 className="mt-4 text-2xl font-black">{pickLanguage(language, { en: "Weekly limit reached", zh: "本周额度已用完", vi: "Đã hết hạn mức tuần", ar: "تم بلوغ الحد الأسبوعي" })}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language)}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2"><Link className="btn-primary" href="/pricing">{pickLanguage(language, { en: "View unlimited plans", zh: "查看不限量方案", vi: "Xem gói không giới hạn", ar: "عرض الخطط غير المحدودة" })}</Link><Link className="btn-secondary" href="/documents">{t("documents")}</Link></div>
          </section>
        ) : (
          <form className="grid gap-5 pb-24" onSubmit={handleSave}>
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
              <div className="panel p-5 xl:sticky xl:top-5 xl:col-start-2 xl:row-span-5">
                <div className="mb-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <StatusBadge status={paper.status} />
                      {autoSavedAt ? (
                        <span className="text-xs font-bold text-[var(--muted)]">
                          {t("autoSaved")} {autoSavedAt}
                        </span>
                      ) : null}
                    </div>
                    <h1 className="text-2xl font-black tracking-normal">
                      {paper.type === "invoice" ? t("invoice") : t("quote")}
                    </h1>
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      {copy({ en: "Edit, preview and save your document.", zh: "编辑、预览并保存你的单据。", vi: "Chỉnh sửa, xem trước và lưu chứng từ.", ar: "عدّل المستند وعاينه واحفظه." })}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <SegmentedType value={paper.type} onChange={(type) => updatePaper({ type, title: type === "invoice" ? "TAX INVOICE" : "QUOTE" })} />
                  <Select label={t("status")} value={paper.status} onChange={(value) => updatePaper({ status: value as DocumentStatus })} options={statuses.map((status) => ({ label: status, value: status }))} />
                  <Field label={copy({ en: "Number", zh: "单据编号", vi: "Số chứng từ", ar: "رقم المستند" })} value={paper.number} onChange={(value) => updatePaper({ number: sanitizeDocumentNumber(value) })} />
                  <Field label={copy({ en: "Title", zh: "标题", vi: "Tiêu đề", ar: "العنوان" })} value={paper.title} onChange={(value) => updatePaper({ title: value })} />
                </div>

                <div className="mt-3 grid gap-3">
                  <Field label={t("issueDate")} type="date" value={paper.issueDate} onChange={(value) => updatePaper({ issueDate: value })} />
                  {paper.type === "invoice" ? (
                    <Field label={t("dueDate")} type="date" value={paper.dueDate} onChange={(value) => updatePaper({ dueDate: value })} />
                  ) : (
                    <Field label={copy({ en: "Valid until", zh: "有效期至", vi: "Có hiệu lực đến", ar: "صالح حتى" })} type="date" value={paper.validUntil} onChange={(value) => updatePaper({ validUntil: value })} />
                  )}
                  <Select label="Currency" value="AUD" onChange={() => undefined} options={[{ label: "AUD · Australian Dollar", value: "AUD" }]} />
                </div>

                {message && (
                  <div className="mt-4 rounded-lg border border-[var(--line)] bg-white/75 p-3 text-sm font-semibold text-[var(--muted)]">
                    {message}
                  </div>
                )}
                {!billing.isPaid ? (
                  <div className={`mt-4 rounded-lg border p-3 text-sm ${billing.documentsUsed >= (billing.documentsLimit ?? 5) && !documentId ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[var(--line)] bg-[#f8faf7] text-[var(--muted)]"}`}>
                    <p className="font-black">{copy({ en: `${billing.documentsUsed}/${billing.documentsLimit ?? 5} free documents used this week`, zh: `${billing.documentsUsed}/${billing.documentsLimit ?? 5} 份本周免费单据`, vi: `Đã dùng ${billing.documentsUsed}/${billing.documentsLimit ?? 5} chứng từ miễn phí tuần này`, ar: `تم استخدام ${billing.documentsUsed}/${billing.documentsLimit ?? 5} مستندات مجانية هذا الأسبوع` })}</p>
                    {billing.documentsUsed >= (billing.documentsLimit ?? 5) && !documentId ? <Link className="mt-1 inline-block font-black text-[var(--mint-dark)] underline" href="/pricing">{copy({ en: "View unlimited plans", zh: "查看不限量方案", vi: "Xem gói không giới hạn", ar: "عرض الخطط غير المحدودة" })}</Link> : null}
                  </div>
                ) : null}
              </div>

              <section className="grid gap-5 lg:grid-cols-2 xl:col-start-1 xl:row-start-1">
                <div className="panel p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black tracking-normal">{copy({ en: "From", zh: "开票方", vi: "Bên phát hành", ar: "جهة الإصدار" })}</h2>
                    <button className="btn-secondary px-3 py-2 text-sm" onClick={handleRememberCompany} type="button">
                      <Plus className="h-4 w-4" />
                      {copy({ en: "Remember", zh: "保存开票方", vi: "Lưu bên phát hành", ar: "حفظ جهة الإصدار" })}
                    </button>
                  </div>
                  <div className="mb-3">
                    <Select
                      label={copy({ en: "Issuer profile", zh: "选择开票方", vi: "Hồ sơ bên phát hành", ar: "ملف جهة الإصدار" })}
                      onChange={handleCompanySelect}
                      options={[
                        { label: copy({ en: "Manual entry", zh: "手动填写", vi: "Nhập thủ công", ar: "إدخال يدوي" }), value: "" },
                        ...companyProfiles.map((company) => ({
                          label: company.is_default
                            ? `${company.business_name} · Default`
                            : company.business_name,
                          value: company.id
                        }))
                      ]}
                      value={selectedCompanyProfileId}
                    />
                  </div>
                  <PartyFields party={paper.company} onChange={(patch) => updateParty("company", patch)} />
                </div>
                <div className="panel p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black tracking-normal">{t("billTo")}</h2>
                    <button className="btn-secondary px-3 py-2 text-sm" onClick={handleRememberCustomer} type="button">
                      <Plus className="h-4 w-4" />
                      {copy({ en: "Remember", zh: "保存为客户", vi: "Lưu khách hàng", ar: "حفظ العميل" })}
                    </button>
                  </div>
                  <div className="mb-3">
                    <Select
                      label={t("customers")}
                      value={paper.customerId ?? ""}
                      onChange={handleCustomerSelect}
                      options={[
                        { label: copy({ en: "Manual entry", zh: "手动填写", vi: "Nhập thủ công", ar: "إدخال يدوي" }), value: "" },
                        ...customers.map((customer) => ({ label: customer.name, value: customer.id }))
                      ]}
                    />
                  </div>
                  <PartyFields party={paper.billTo} onChange={(patch) => updateParty("billTo", patch)} />
                </div>
              </section>

              <section className="panel p-5 xl:col-start-1">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-black tracking-normal">{t("shipTo")}</h2>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary px-3 py-2 text-sm" onClick={() => updatePaper({ shipTo: { ...paper.billTo } })} type="button">
                      <Copy className="h-4 w-4" />
                      {t("copyBillTo")}
                    </button>
                    <button className="btn-secondary px-3 py-2 text-sm" onClick={() => updatePaper({ shipTo: paper.shipTo ? null : { ...emptyParty } })} type="button">
                      {paper.shipTo ? copy({ en: "Remove", zh: "移除", vi: "Xóa", ar: "إزالة" }) : copy({ en: "Add", zh: "添加", vi: "Thêm", ar: "إضافة" })}
                    </button>
                  </div>
                </div>
                {paper.shipTo ? (
                  <PartyFields party={paper.shipTo} onChange={(patch) => updateParty("shipTo", patch)} />
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--line)] p-6 text-sm font-semibold text-[var(--muted)]">
                    {copy({ en: "Optional shipping address.", zh: "可选收货地址。", vi: "Địa chỉ giao hàng không bắt buộc.", ar: "عنوان الشحن اختياري." })}
                  </div>
                )}
              </section>

              <section className="panel p-5 xl:col-start-1">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-black tracking-normal">{t("lineItems")}</h2>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary px-3 py-2 text-xs" onClick={() => setAllItemGst(true)} type="button">
                      <Check className="h-3.5 w-3.5" />
                      {copy({ en: "Select all GST", zh: "全选 GST", vi: "Chọn tất cả GST", ar: "تحديد GST للكل" })}
                    </button>
                    <button className="btn-secondary px-3 py-2 text-xs" onClick={() => setAllItemGst(false)} type="button">
                      {copy({ en: "Clear all GST", zh: "取消全部 GST", vi: "Bỏ tất cả GST", ar: "إلغاء GST للكل" })}
                    </button>
                    <button className="btn-secondary px-3 py-2 text-xs" onClick={() => updatePaper({ lineItems: [...paper.lineItems, createLineItem()] })} type="button">
                      <Plus className="h-3.5 w-3.5" />
                      {copy({ en: "Add item", zh: "添加项目", vi: "Thêm hạng mục", ar: "إضافة بند" })}
                    </button>
                  </div>
                </div>

                <div className="mb-3 rounded-lg border border-dashed border-[var(--line)] bg-[#f8faf7] p-3">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black">{copy({ en: "Quick fill items", zh: "文本快速填入项目", vi: "Điền nhanh hạng mục", ar: "إدخال البنود سريعاً" })}</p>
                      <p className="text-xs font-semibold text-[var(--muted)]">{copy({ en: "One row per item: Description | Details | Qty | Unit price | GST", zh: "每行一个项目：描述 | 明细 | 数量 | 单价 | GST", vi: "Mỗi dòng: Mô tả | Chi tiết | SL | Đơn giá | GST", ar: "كل سطر: الوصف | التفاصيل | الكمية | السعر | GST" })}</p>
                    </div>
                    <button className="btn-secondary px-3 py-2 text-xs" disabled={!quickItemsText.trim()} onClick={handleQuickFill} type="button">
                      <ListPlus className="h-3.5 w-3.5" />
                      {copy({ en: "Fill items", zh: "自动填入", vi: "Điền hạng mục", ar: "تعبئة البنود" })}
                    </button>
                  </div>
                  <textarea
                    className="field min-h-16 resize-y py-2 text-sm"
                    onChange={(event) => setQuickItemsText(event.target.value)}
                    placeholder={copy({ en: "Apples | Red carton | 2.5 | 12.345 | GST\nReturned crate | Damaged | 1 | -8.50 | GST", zh: "苹果 | 红色纸箱 | 2.5 | 12.345 | GST\n退货纸箱 | 破损 | 1 | -8.50 | GST", vi: "Táo | Thùng đỏ | 2.5 | 12.345 | GST", ar: "تفاح | صندوق أحمر | 2.5 | 12.345 | GST" })}
                    value={quickItemsText}
                  />
                </div>

                <div className="grid gap-2">
                  {paper.lineItems.map((item, index) => (
                    <LineItemEditor
                      canDelete={paper.lineItems.length > 1}
                      index={index}
                      item={item}
                      key={item.id}
                      language={language}
                      onChange={(patch) => updateLineItem(item.id, patch)}
                      onDelete={() => updatePaper({ lineItems: paper.lineItems.filter((candidate) => candidate.id !== item.id) })}
                    />
                  ))}
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-[1fr_0.72fr] xl:col-start-1">
                <div className="panel grid gap-4 p-5">
                  <TextArea label={t("paymentMethods")} value={paper.paymentMethods} onChange={(value) => updatePaper({ paymentMethods: value })} />
                  <TextArea label={t("notes")} value={paper.notes} onChange={(value) => updatePaper({ notes: value })} />
                  <div className="rounded-lg border border-[var(--line)] bg-white/70 p-4">
                    <span className="label">{t("logo")}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      {paper.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="Company logo" className="h-14 w-24 rounded-lg border border-[var(--line)] object-contain p-2" src={paper.logoUrl} />
                      ) : null}
                      <label className="btn-secondary cursor-pointer">
                        <Upload className="h-4 w-4" />
                        {copy({ en: "Upload", zh: "上传", vi: "Tải lên", ar: "رفع" })}
                        <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleLogo(event.target.files?.[0])} type="file" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="panel grid gap-3 p-5">
                  <h2 className="text-xl font-black tracking-normal">{copy({ en: "Totals", zh: "金额", vi: "Tổng tiền", ar: "الإجماليات" })}</h2>
                  <DiscountEditor
                    discount={paper.orderDiscount}
                    label={t("discount")}
                    onChange={(discount) => updatePaper({ orderDiscount: discount })}
                  />
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white/70 p-3 text-sm font-bold">
                    <span>{t("gst")}</span>
                    <input checked={paper.gstEnabled} onChange={(event) => updatePaper({ gstEnabled: event.target.checked })} type="checkbox" />
                  </label>
                  <Field label="GST %" step="1" type="number" value={String(paper.gstRate)} onChange={(value) => updatePaper({ gstRate: Number(value) || 0 })} />
                  <div className="mt-2 grid gap-2 border-t border-[var(--line)] pt-3 text-sm">
                    <Amount label={t("subtotal")} value={formatAud(totals.subtotal)} />
                    <Amount label={t("discount")} value={`-${formatAud(totals.orderDiscountTotal)}`} />
                    <Amount label={t("gst")} value={formatAud(totals.gst)} />
                    <Amount label={t("total")} strong value={formatAud(totals.total)} />
                  </div>
                </div>
              </section>
            </section>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/90 px-4 py-3 shadow-[0_-16px_40px_rgba(23,33,27,0.12)] backdrop-blur">
              <div className="mx-auto flex max-w-7xl flex-wrap justify-end gap-2">
                <button className="btn-secondary" onClick={() => setShowPreview(true)} type="button">
                  <Eye className="h-4 w-4" />
                  {t("preview")}
                </button>
                <button className="btn-secondary" onClick={handlePrint} type="button">
                  <Printer className="h-4 w-4" />
                  {t("print")}
                </button>
                <button className="btn-secondary" disabled={downloading} onClick={handleDownloadPdf} type="button">
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {t("downloadPdf")}
                </button>
                <button className="btn-primary min-w-28" disabled={saving || (!documentId && limitReached)} type="submit">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveConfirmed ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saving ? pickLanguage(language, { en: "Saving...", zh: "保存中...", vi: "Đang lưu...", ar: "جارٍ الحفظ..." }) : saveConfirmed ? pickLanguage(language, { en: "Saved", zh: "已保存", vi: "Đã lưu", ar: "تم الحفظ" }) : t("save")}
                </button>
              </div>
            </div>
          </form>
        )}
        {paper && showPreview ? (
          <div
            className="fixed inset-0 z-40 overflow-y-auto bg-[#17211b]/55 p-4 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
            role="presentation"
          >
            <div
              className="mx-auto max-w-[860px]"
              onClick={(event) => event.stopPropagation()}
              role="presentation"
            >
              <div className="mb-3 flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                <h2 className="text-xl font-black tracking-normal">{t("preview")}</h2>
                <button className="btn-secondary px-3 py-2" onClick={() => setShowPreview(false)} type="button">
                  <EyeOff className="h-4 w-4" />
                  {copy({ en: "Close", zh: "关闭", vi: "Đóng", ar: "إغلاق" })}
                </button>
              </div>
              <DocumentPreview document={paper} showBranding={billing.showBranding} />
            </div>
          </div>
        ) : null}
      </AppShell>
    </ProtectedRoute>
  );
}

function SegmentedType({
  value,
  onChange
}: {
  value: DocumentType;
  onChange: (value: DocumentType) => void;
}) {
  const { t } = useLanguage();
  return (
    <label>
      <span className="label">Type</span>
      <div className="grid grid-cols-2 rounded-lg border border-[var(--line)] bg-white/70 p-1">
        {(["invoice", "quote"] as DocumentType[]).map((type) => (
          <button
            className={`rounded-md px-3 py-2 text-sm font-black capitalize ${
              value === type ? "bg-[var(--foreground)] text-white" : "text-[var(--muted)]"
            }`}
            key={type}
            onClick={() => onChange(type)}
            type="button"
          >
            {type === "invoice" ? t("invoice") : t("quote")}
          </button>
        ))}
      </div>
    </label>
  );
}

function PartyEditor({
  title,
  party,
  onChange
}: {
  title: string;
  party: Party;
  onChange: (patch: Partial<Party>) => void;
}) {
  return (
    <div className="panel p-5">
      <h2 className="mb-4 text-xl font-black tracking-normal">{title}</h2>
      <PartyFields party={party} onChange={onChange} />
    </div>
  );
}

function PartyFields({
  party,
  onChange
}: {
  party: Party;
  onChange: (patch: Partial<Party>) => void;
}) {
  const { language } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  return (
    <div className="grid gap-3">
      <Field label={copy({ en: "Name", zh: "名称", vi: "Tên", ar: "الاسم" })} value={party.name} onChange={(value) => onChange({ name: value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" type="email" value={party.email} onChange={(value) => onChange({ email: value })} />
        <Field label={copy({ en: "Phone", zh: "电话", vi: "Điện thoại", ar: "الهاتف" })} value={party.phone} onChange={(value) => onChange({ phone: value })} />
      </div>
      <Field label="ABN" value={party.abn} onChange={(value) => onChange({ abn: value })} />
      <TextArea label={copy({ en: "Address", zh: "地址", vi: "Địa chỉ", ar: "العنوان" })} value={party.address} onChange={(value) => onChange({ address: value })} />
    </div>
  );
}

function LineItemEditor({
  item,
  index,
  canDelete,
  language,
  onChange,
  onDelete
}: {
  item: LineItem;
  index: number;
  canDelete: boolean;
  language: Language;
  onChange: (patch: Partial<LineItem>) => void;
  onDelete: () => void;
}) {
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white/75 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0 rounded-md bg-[#eef4ef] px-2 py-1 text-[11px] font-black text-[var(--muted)]">
          #{index + 1}
        </span>
        <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <AutoGrowTextArea
            label={copy({ en: "Description", zh: "描述", vi: "Mô tả", ar: "الوصف" })}
            maxHeight={112}
            onChange={(value) => onChange({ description: value })}
            value={item.description}
          />
          <AutoGrowTextArea
            label={copy({ en: "Details", zh: "明细", vi: "Chi tiết", ar: "التفاصيل" })}
            maxHeight={144}
            onChange={(value) => onChange({ details: value })}
            value={item.details}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-3 lg:grid-cols-[86px_120px_105px_minmax(170px,1fr)_120px_38px]">
        <DecimalInput
          label={copy({ en: "Qty", zh: "数量", vi: "Số lượng", ar: "الكمية" })}
          onChange={(quantity) => onChange({ quantity })}
          value={item.quantity}
        />
        <DecimalInput
          allowNegative
          label={copy({ en: "Unit price", zh: "单价", vi: "Đơn giá", ar: "سعر الوحدة" })}
          onChange={(unitPrice) => onChange({ unitPrice })}
          value={item.unitPrice}
        />
        <label>
          <span className="label">GST</span>
          <span className="field flex items-center justify-between gap-2 px-2 py-2">
            <span>{item.gstEnabled === false ? copy({ en: "No GST", zh: "无 GST", vi: "Không GST", ar: "بدون GST" }) : "GST"}</span>
            <input
              className="h-4 w-4 accent-[var(--mint-dark)]"
              checked={item.gstEnabled !== false}
              onChange={(event) => onChange({ gstEnabled: event.target.checked })}
              type="checkbox"
            />
          </span>
        </label>
        <DiscountEditor compactSelect discount={item.discount} label={copy({ en: "Item discount", zh: "项目折扣", vi: "Giảm giá hạng mục", ar: "خصم البند" })} onChange={(discount) => onChange({ discount })} />
        <div>
          <span className="label">{copy({ en: "Amount", zh: "金额", vi: "Thành tiền", ar: "المبلغ" })}</span>
          <div className={`rounded-lg border border-[var(--line)] bg-[#f8faf7] px-3 py-2 text-right font-black ${lineTotal(item) < 0 ? "text-[var(--rose)]" : ""}`}>
            {formatAud(lineTotal(item))}
          </div>
        </div>
        <button className="icon-btn h-[39px] w-[38px] text-[var(--rose)]" disabled={!canDelete} onClick={onDelete} title="Delete item" type="button">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {item.unitPrice < 0 ? (
        <p className="mt-2 text-xs font-bold text-[var(--rose)]">
          {copy({ en: "Recorded as a return / loss adjustment when this invoice is marked Paid.", zh: "Invoice 标记为已付款后，此项目会记入退货／损耗记录。", vi: "Được ghi là điều chỉnh trả hàng / tổn thất khi hóa đơn đã thanh toán.", ar: "يسجل كتعديل مرتجع / خسارة عند تعليم الفاتورة كمدفوعة." })}
        </p>
      ) : null}
    </article>
  );
}

function AutoGrowTextArea({
  label,
  value,
  onChange,
  maxHeight
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxHeight: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight, value]);

  return (
    <label className="min-w-0">
      <span className="label mb-1">{label}</span>
      <textarea
        className="field min-h-[39px] resize-none overflow-hidden py-2 text-sm leading-5"
        onChange={(event) => onChange(event.target.value)}
        ref={ref}
        rows={1}
        value={value}
      />
    </label>
  );
}

function DecimalInput({
  label,
  value,
  onChange,
  allowNegative = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  allowNegative?: boolean;
}) {
  const [inputValue, setInputValue] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setInputValue(String(value));
  }, [focused, value]);

  function commit() {
    const numeric = decimalValue(inputValue, allowNegative);
    setFocused(false);
    setInputValue(String(numeric));
    onChange(numeric);
  }

  return (
    <label>
      <span className="label mb-1">{label}</span>
      <input
        aria-label={label}
        className="field py-2 text-sm"
        inputMode="decimal"
        onBlur={commit}
        onChange={(event) => {
          const cleaned = cleanDecimalInput(event.target.value, allowNegative);
          setInputValue(cleaned);
          onChange(decimalValue(cleaned, allowNegative));
        }}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.select();
        }}
        pattern={allowNegative ? "-?[0-9]*[.]?[0-9]{0,3}" : "[0-9]*[.]?[0-9]{0,3}"}
        title={allowNegative ? "Up to three decimal places; negative values allowed" : "Zero or more, up to three decimal places"}
        type="text"
        value={inputValue}
      />
    </label>
  );
}

function DiscountEditor({
  label,
  discount,
  onChange,
  compactSelect = false
}: {
  label: string;
  discount: { type: DiscountType; value: number };
  onChange: (discount: { type: DiscountType; value: number }) => void;
  compactSelect?: boolean;
}) {
  const [inputValue, setInputValue] = useState(String(discount.value));

  useEffect(() => {
    setInputValue(String(discount.value));
  }, [discount.value]);

  function cleanDiscountInput(value: string) {
    const numeric = value.replace(/[^\d.]/g, "");
    const [whole, ...rest] = numeric.split(".");
    const withoutLeadingZeros = whole.replace(/^0+(?=\d)/, "");
    return rest.length > 0 ? `${withoutLeadingZeros || "0"}.${rest.join("")}` : withoutLeadingZeros;
  }

  function commit(value: string) {
    const nextValue = value === "" ? 0 : Number(value) || 0;
    setInputValue(String(nextValue));
    onChange({ ...discount, value: nextValue });
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className={`grid gap-2 ${compactSelect ? "grid-cols-[72px_90px]" : "grid-cols-[1fr_90px]"}`}>
        <select
          className="field"
          onChange={(event) => onChange({ ...discount, type: event.target.value as DiscountType })}
          value={discount.type}
        >
          <option value="percent">%</option>
          <option value="fixed">$</option>
        </select>
        <input
          className="field"
          inputMode="decimal"
          min="0"
          onBlur={() => commit(inputValue)}
          onChange={(event) => {
            const cleaned = cleanDiscountInput(event.target.value);
            setInputValue(cleaned);
            onChange({ ...discount, value: cleaned === "" ? 0 : Number(cleaned) || 0 });
          }}
          onFocus={() => {
            if (inputValue === "0") setInputValue("");
          }}
          type="text"
          value={inputValue}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="field"
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          if (type === "number") event.currentTarget.select();
        }}
        step={step ?? (type === "number" ? "1" : undefined)}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="field min-h-24 resize-y" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Amount({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "text-lg font-black" : "font-semibold"}`}>
      <span className={strong ? "" : "text-[var(--muted)]"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
