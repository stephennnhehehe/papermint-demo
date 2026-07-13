"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pdf } from "@react-pdf/renderer";
import { Check, ChevronDown, Copy, Download, FilePlus2, FileText, Loader2, Mail, Repeat2, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { PaperMintPdf } from "@/components/pdf/DocumentPdf";
import { deleteDocument, fetchDocuments, saveDocument } from "@/lib/api";
import { formatAud } from "@/lib/calculations";
import { statusForDueDate } from "@/lib/documents";
import { addDays, documentFromRow, generateDocumentNumber } from "@/lib/documents";
import type { DocumentRow, DocumentStatus, DocumentType } from "@/lib/types";

const documentStatuses: DocumentStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];

export default function DocumentsPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | DocumentType>("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setDocuments(await fetchDocuments(user.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const customerOptions = useMemo(
    () =>
      Array.from(new Set(documents.map((document) => document.bill_to?.name).filter(Boolean))).sort(),
    [documents]
  );

  const issuerOptions = useMemo(
    () =>
      Array.from(new Set(documents.map((document) => document.company?.name).filter(Boolean))).sort(),
    [documents]
  );

  const visibleDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const matchesType = filter === "all" || document.type === filter;
        const matchesCustomer = customerFilter === "all" || document.bill_to?.name === customerFilter;
        const matchesIssuer = issuerFilter === "all" || document.company?.name === issuerFilter;
        return matchesType && matchesCustomer && matchesIssuer;
      }),
    [customerFilter, documents, filter, issuerFilter]
  );

  function effectiveStatus(row: DocumentRow): DocumentStatus {
    return row.type === "invoice"
      ? statusForDueDate(row.status, row.due_date ?? "")
      : row.status;
  }

  async function handleDelete(row: DocumentRow) {
    if (!user) return;
    await deleteDocument(user.id, row.id);
    setDeleteTarget(null);
    setMessage(language === "zh" ? "单据已删除。" : "Document deleted.");
    await loadDocuments();
  }

  async function handleDuplicate(row: DocumentRow) {
    if (!user) return;
    const source = documentFromRow(row);
    await saveDocument(user.id, {
      ...source,
      id: undefined,
      status: "draft",
      number: generateDocumentNumber("", source.type, documents, source.issueDate),
      createdAt: undefined,
      updatedAt: undefined
    });
    await loadDocuments();
    setMessage(language === "zh" ? "已复制为草稿。" : "Copied as draft.");
  }

  async function handleConvert(row: DocumentRow) {
    if (!user || row.type !== "quote") return;
    const source = documentFromRow(row);
    const issueDate = new Date().toISOString().slice(0, 10);
    await saveDocument(user.id, {
      ...source,
      id: undefined,
      type: "invoice",
      title: "TAX INVOICE",
      status: "draft",
      number: generateDocumentNumber("", "invoice", documents, issueDate),
      issueDate,
      dueDate: addDays(issueDate, 14),
      convertedFromQuoteId: row.id,
      createdAt: undefined,
      updatedAt: undefined
    });
    await loadDocuments();
    setMessage(language === "zh" ? "Quote 已转换为 Invoice 草稿。" : "Quote converted to an invoice draft.");
  }

  async function handleStatusChange(row: DocumentRow, status: DocumentStatus) {
    if (!user) return;
    const source = documentFromRow(row);
    await saveDocument(user.id, {
      ...source,
      status
    });
    await loadDocuments();
  }

  async function documentPdfBlob(row: DocumentRow) {
    const source = documentFromRow(row);
    return pdf(<PaperMintPdf document={source} language={language} />).toBlob();
  }

  async function handleDownload(row: DocumentRow) {
    const blob = await documentPdfBlob(row);
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${row.type}-${row.number}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleSend(row: DocumentRow) {
    const blob = await documentPdfBlob(row);
    const file = new File([blob], `${row.type}-${row.number}.pdf`, {
      type: "application/pdf"
    });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };
    const title = `${row.type.toUpperCase()} ${row.number}`;
    const text =
      language === "zh"
        ? `您好，请查收 ${title}。`
        : `Hi, please find ${title}.`;

    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title, text });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        throw error;
      }
      return;
    }

    const to = row.bill_to?.email ?? "";
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(
      `${text}\n\n${language === "zh" ? "如果需要 PDF 附件，请先点击下载按钮后手动附加。" : "If you need a PDF attachment, use the download button and attach the file."}`
    );
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <section className="panel p-5">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-black tracking-normal">{t("documents")}</h1>
              <p className="text-sm font-semibold text-[var(--muted)]">
                {language === "zh" ? "保存、查看、编辑、复制和删除自己的单据。" : "Save, view, edit, copy and delete your own documents."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="btn-primary" href="/documents/new?type=invoice">
                <FilePlus2 className="h-4 w-4" />
                {t("newInvoice")}
              </Link>
              <Link className="btn-secondary" href="/documents/new?type=quote">
                <FileText className="h-4 w-4" />
                {t("newQuote")}
              </Link>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-grid grid-cols-3 rounded-lg border border-[var(--line)] bg-white/70 p-1">
                {(["all", "invoice", "quote"] as const).map((item) => (
                  <button
                    className={`rounded-md px-3 py-2 text-sm font-black capitalize ${
                      filter === item ? "bg-[var(--foreground)] text-white" : "text-[var(--muted)]"
                    }`}
                    key={item}
                    onClick={() => setFilter(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <select className="field max-w-56" onChange={(event) => setCustomerFilter(event.target.value)} value={customerFilter}>
                <option value="all">{language === "zh" ? "全部客户" : "All customers"}</option>
                {customerOptions.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
              <select className="field max-w-56" onChange={(event) => setIssuerFilter(event.target.value)} value={issuerFilter}>
                <option value="all">{language === "zh" ? "全部开票方" : "All issuers"}</option>
                {issuerOptions.map((issuer) => (
                  <option key={issuer} value={issuer}>
                    {issuer}
                  </option>
                ))}
              </select>
              {message ? <span className="text-sm font-bold text-[var(--muted)]">{message}</span> : null}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading documents
            </div>
          ) : visibleDocuments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm font-semibold text-[var(--muted)]">
              {language === "zh" ? "暂无单据。" : "No documents yet."}
            </div>
          ) : (
            <div className="overflow-x-auto pb-20">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
                    <th className="py-3 pr-3">Number</th>
                    <th className="px-3">Customer</th>
                    <th className="px-3">Type</th>
                    <th className="px-3">Status</th>
                    <th className="px-3 text-right">Total</th>
                    <th className="px-3">Updated</th>
                    <th className="py-3 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDocuments.map((row) => (
                    <tr className="border-b border-[#edf1ed]" key={row.id}>
                      <td className="py-4 pr-3 font-black">
                        <Link className="hover:text-[var(--mint-dark)]" href={`/documents/${row.id}`}>
                          {row.number}
                        </Link>
                      </td>
                      <td className="px-3 font-semibold text-[var(--muted)]">
                        {row.bill_to?.name || "-"}
                      </td>
                      <td className="px-3 capitalize">{row.type}</td>
                      <td className="px-3">
                        <StatusSelect
                          onChange={(status) => handleStatusChange(row, status)}
                          value={effectiveStatus(row)}
                        />
                      </td>
                      <td className="px-3 text-right font-black">{formatAud(row.totals?.total ?? 0)}</td>
                      <td className="px-3 text-[var(--muted)]">{new Date(row.updated_at).toLocaleDateString()}</td>
                      <td className="py-3 pl-3">
                        <div className="flex justify-end gap-2">
                          <button className="icon-btn" onClick={() => handleDuplicate(row)} title={t("duplicate")} type="button">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button className="icon-btn" onClick={() => handleDownload(row)} title={t("downloadPdf")} type="button">
                            <Download className="h-4 w-4" />
                          </button>
                          <button className="icon-btn" onClick={() => handleSend(row)} title={language === "zh" ? "发送邮件" : "Send email"} type="button">
                            <Mail className="h-4 w-4" />
                          </button>
                          {row.type === "quote" ? (
                            <button className="icon-btn" onClick={() => handleConvert(row)} title={t("convertToInvoice")} type="button">
                              <Repeat2 className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button className="icon-btn text-[var(--rose)]" onClick={() => setDeleteTarget(row)} title={t("delete")} type="button">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {deleteTarget ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#17211b]/45 p-4 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-lg border border-[var(--line)] bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-normal">
                    {language === "zh" ? "删除单据？" : "Delete document?"}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    {language === "zh"
                      ? `确认删除 ${deleteTarget.number}？此操作无法撤销。`
                      : `Delete ${deleteTarget.number}? This cannot be undone.`}
                  </p>
                </div>
                <button className="icon-btn" onClick={() => setDeleteTarget(null)} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[#f8faf7] p-3 text-sm">
                <div className="font-black">{deleteTarget.number}</div>
                <div className="mt-1 font-semibold text-[var(--muted)]">
                  {deleteTarget.bill_to?.name || "-"} · {formatAud(deleteTarget.totals?.total ?? 0)}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => setDeleteTarget(null)} type="button">
                  {language === "zh" ? "取消" : "Cancel"}
                </button>
                <button className="btn-primary bg-[var(--rose)] hover:bg-[#a6293b]" onClick={() => handleDelete(deleteTarget)} type="button">
                  <Trash2 className="h-4 w-4" />
                  {language === "zh" ? "删除" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    </ProtectedRoute>
  );
}

function StatusSelect({
  value,
  onChange
}: {
  value: DocumentStatus;
  onChange: (status: DocumentStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const classes: Record<DocumentStatus, { button: string; dot: string }> = {
    draft: { button: "bg-slate-50 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
    sent: { button: "bg-blue-50 text-blue-700 ring-blue-100", dot: "bg-blue-500" },
    paid: { button: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-500" },
    overdue: { button: "bg-rose-50 text-rose-700 ring-rose-100", dot: "bg-rose-500" },
    cancelled: { button: "bg-zinc-50 text-zinc-600 ring-zinc-200", dot: "bg-zinc-400" }
  };

  return (
    <div
      className="relative inline-block"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        className={`inline-flex min-w-32 items-center justify-between gap-2 rounded-full px-3 py-1.5 text-xs font-black capitalize shadow-sm ring-1 ${classes[value].button}`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${classes[value].dot}`} />
          {value}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-lg border border-[var(--line)] bg-white p-1 shadow-xl">
          {documentStatuses.map((status) => (
            <button
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-black capitalize text-[var(--foreground)] hover:bg-[#f4f7f4]"
              key={status}
              onClick={() => {
                onChange(status);
                setOpen(false);
              }}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${classes[status].dot}`} />
                {status}
              </span>
              {status === value ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
