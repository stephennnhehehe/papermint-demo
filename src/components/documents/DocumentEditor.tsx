"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Download, Eye, EyeOff, Loader2, Plus, Printer, Save, Trash2, Upload } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useBilling } from "@/components/app/BillingProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { calculateTotals, formatAud, lineTotal } from "@/lib/calculations";
import { billingErrorMessage } from "@/lib/billing";
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
  const { billing, refreshBilling } = useBilling();
  const { t, language } = useLanguage();
  const [paper, setPaper] = useState<PaperDocument | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [autoSavedAt, setAutoSavedAt] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCompanyProfileId, setSelectedCompanyProfileId] = useState("");

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
        company: { ...emptyParty },
        logoUrl: ""
      });
      return;
    }
    if (!company) return;
    updatePaper({
      company: companyRecordToParty(company),
      logoUrl: company.logo_url ?? ""
    });
  }

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    if (!user || !paper) return;
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveDocument(user.id, {
        ...paper,
        number: sanitizeDocumentNumber(paper.number)
      });
      setPaper(saved);
      if (draftKey) window.localStorage.removeItem(draftKey);
      setMessage(language === "zh" ? "已保存。" : "Saved.");
      await refreshBilling();
      if (!documentId) router.replace(`/documents/${saved.id}`);
    } catch (error) {
      setMessage(billingErrorMessage(error, language));
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
      setMessage(language === "zh" ? "客户已保存。" : "Customer saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save customer.");
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
      setMessage(language === "zh" ? "开票方资料已保存。" : "Issuer profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save issuer profile.");
    }
  }

  async function handleLogo(file: File | undefined) {
    if (!file || !user || !paper) return;
    setSaving(true);
    try {
      const logoUrl = await uploadLogo(file, user.id);
      updatePaper({ logoUrl });
      setMessage(language === "zh" ? "Logo 已上传。" : "Logo uploaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload logo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!paper) return;
    setDownloading(true);
    try {
      const blob = await pdf(<PaperMintPdf document={paper} language={language} showBranding={billing.showBranding} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${paper.type}-${paper.number || "draft"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
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
        {loading || !paper || !totals ? (
          <div className="panel flex items-center gap-3 p-5 text-sm font-semibold text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading document
          </div>
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
                      {language === "zh" ? "编辑、预览并保存你的单据。" : "Edit, preview and save your document."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <SegmentedType value={paper.type} onChange={(type) => updatePaper({ type, title: type === "invoice" ? "TAX INVOICE" : "QUOTE" })} />
                  <Select label={t("status")} value={paper.status} onChange={(value) => updatePaper({ status: value as DocumentStatus })} options={statuses.map((status) => ({ label: status, value: status }))} />
                  <Field label={language === "zh" ? "单据编号" : "Number"} value={paper.number} onChange={(value) => updatePaper({ number: sanitizeDocumentNumber(value) })} />
                  <Field label={language === "zh" ? "标题" : "Title"} value={paper.title} onChange={(value) => updatePaper({ title: value })} />
                </div>

                <div className="mt-3 grid gap-3">
                  <Field label={t("issueDate")} type="date" value={paper.issueDate} onChange={(value) => updatePaper({ issueDate: value })} />
                  {paper.type === "invoice" ? (
                    <Field label={t("dueDate")} type="date" value={paper.dueDate} onChange={(value) => updatePaper({ dueDate: value })} />
                  ) : (
                    <Field label={language === "zh" ? "有效期至" : "Valid until"} type="date" value={paper.validUntil} onChange={(value) => updatePaper({ validUntil: value })} />
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
                    <p className="font-black">{billing.documentsUsed}/{billing.documentsLimit ?? 5} {language === "zh" ? "份本周免费单据" : "free documents used this week"}</p>
                    {billing.documentsUsed >= (billing.documentsLimit ?? 5) && !documentId ? <Link className="mt-1 inline-block font-black text-[var(--mint-dark)] underline" href="/pricing">{language === "zh" ? "查看不限量方案" : "View unlimited plans"}</Link> : null}
                  </div>
                ) : null}
              </div>

              <section className="grid gap-5 lg:grid-cols-2 xl:col-start-1 xl:row-start-1">
                <div className="panel p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black tracking-normal">{language === "zh" ? "开票方" : "From"}</h2>
                    <button className="btn-secondary px-3 py-2 text-sm" onClick={handleRememberCompany} type="button">
                      <Plus className="h-4 w-4" />
                      {language === "zh" ? "保存开票方" : "Remember"}
                    </button>
                  </div>
                  <div className="mb-3">
                    <Select
                      label={language === "zh" ? "选择开票方" : "Issuer profile"}
                      onChange={handleCompanySelect}
                      options={[
                        { label: language === "zh" ? "手动填写" : "Manual entry", value: "" },
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
                      {language === "zh" ? "保存为客户" : "Remember"}
                    </button>
                  </div>
                  <div className="mb-3">
                    <Select
                      label={language === "zh" ? "选择客户" : "Customer"}
                      value={paper.customerId ?? ""}
                      onChange={handleCustomerSelect}
                      options={[
                        { label: language === "zh" ? "手动填写" : "Manual entry", value: "" },
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
                      {paper.shipTo ? (language === "zh" ? "移除" : "Remove") : (language === "zh" ? "添加" : "Add")}
                    </button>
                  </div>
                </div>
                {paper.shipTo ? (
                  <PartyFields party={paper.shipTo} onChange={(patch) => updateParty("shipTo", patch)} />
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--line)] p-6 text-sm font-semibold text-[var(--muted)]">
                    {language === "zh" ? "可选收货地址。" : "Optional shipping address."}
                  </div>
                )}
              </section>

              <section className="panel p-5 xl:col-start-1">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black tracking-normal">{t("lineItems")}</h2>
                  <button className="btn-secondary px-3 py-2 text-sm" onClick={() => updatePaper({ lineItems: [...paper.lineItems, createLineItem()] })} type="button">
                    <Plus className="h-4 w-4" />
                    {language === "zh" ? "添加项目" : "Add item"}
                  </button>
                </div>

                <div className="grid gap-3">
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
                        {language === "zh" ? "上传" : "Upload"}
                        <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleLogo(event.target.files?.[0])} type="file" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="panel grid gap-3 p-5">
                  <h2 className="text-xl font-black tracking-normal">{language === "zh" ? "金额" : "Totals"}</h2>
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
                <button className="btn-primary" disabled={saving} type="submit">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("save")}
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
                  {language === "zh" ? "关闭" : "Close"}
                </button>
              </div>
              <DocumentPreview document={paper} language={language} showBranding={billing.showBranding} />
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
            {type}
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
  return (
    <div className="grid gap-3">
      <Field label="Name" value={party.name} onChange={(value) => onChange({ name: value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" type="email" value={party.email} onChange={(value) => onChange({ email: value })} />
        <Field label="Phone" value={party.phone} onChange={(value) => onChange({ phone: value })} />
      </div>
      <Field label="ABN" value={party.abn} onChange={(value) => onChange({ abn: value })} />
      <TextArea label="Address" value={party.address} onChange={(value) => onChange({ address: value })} />
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
  language: "en" | "zh";
  onChange: (patch: Partial<LineItem>) => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white/75 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-[var(--muted)]">
          {language === "zh" ? "项目" : "Item"} #{index + 1}
        </h3>
        <button className="icon-btn text-[var(--rose)]" disabled={!canDelete} onClick={onDelete} title="Delete item" type="button">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_82px_120px_105px_170px_120px]">
        <div className="grid gap-3">
          <Field label={language === "zh" ? "描述" : "Description"} value={item.description} onChange={(value) => onChange({ description: value })} />
          <TextArea label={language === "zh" ? "明细" : "Details"} value={item.details} onChange={(value) => onChange({ details: value })} />
        </div>
        <Field label={language === "zh" ? "数量" : "Qty"} step="1" type="number" value={String(item.quantity)} onChange={(value) => onChange({ quantity: Number(value) || 0 })} />
        <Field label={language === "zh" ? "单价" : "Unit price"} step="1" type="number" value={String(item.unitPrice)} onChange={(value) => onChange({ unitPrice: Number(value) || 0 })} />
        <label>
          <span className="label">GST</span>
          <span className="field flex items-center justify-between gap-3">
            <span>{item.gstEnabled === false ? "No GST" : "GST"}</span>
            <input
              className="h-4 w-4 accent-[var(--mint-dark)]"
              checked={item.gstEnabled !== false}
              onChange={(event) => onChange({ gstEnabled: event.target.checked })}
              type="checkbox"
            />
          </span>
        </label>
        <DiscountEditor discount={item.discount} label={language === "zh" ? "项目折扣" : "Item discount"} onChange={(discount) => onChange({ discount })} />
        <div>
          <span className="label">{language === "zh" ? "金额" : "Amount"}</span>
          <div className="rounded-lg border border-[var(--line)] bg-[#f8faf7] px-3 py-3 text-right font-black">
            {formatAud(lineTotal(item))}
          </div>
        </div>
      </div>
    </article>
  );
}

function DiscountEditor({
  label,
  discount,
  onChange
}: {
  label: string;
  discount: { type: DiscountType; value: number };
  onChange: (discount: { type: DiscountType; value: number }) => void;
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
      <div className="grid grid-cols-[1fr_90px] gap-2">
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
