"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { pdf } from "@react-pdf/renderer";
import { Check, ChevronDown, Copy, Download, FilePlus2, FileText, Link2, Loader2, LockKeyhole, Mail, Repeat2, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useBilling } from "@/components/app/BillingProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import { PaperMintPdf } from "@/components/pdf/DocumentPdf";
import { deleteDocument, fetchDocuments, saveDocument } from "@/lib/api";
import { formatAud } from "@/lib/calculations";
import { billingErrorMessage, isFreeDocumentLimitReached } from "@/lib/billing";
import { shareDocument } from "@/lib/document-delivery";
import { pickLanguage } from "@/lib/i18n";
import { statusForDueDate } from "@/lib/documents";
import { addDays, documentFromRow, generateDocumentNumber } from "@/lib/documents";
import type { DocumentRow, DocumentStatus, DocumentType } from "@/lib/types";

const documentStatuses: DocumentStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];

export default function DocumentsPage() {
  const { user } = useAuth();
  const { billing, refreshBilling } = useBilling();
  const { t, language } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | DocumentType>("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const limitReached = isFreeDocumentLimitReached(billing);

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
    setBusyAction(`delete:${row.id}`);
    try {
      await deleteDocument(user.id, row.id);
      setDeleteTarget(null);
      const success = pickLanguage(language, { en: "Document deleted.", zh: "单据已删除。", vi: "Đã xóa chứng từ.", ar: "تم حذف المستند." });
      setMessage(success);
      showToast(success);
      await loadDocuments();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to delete document.", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function handleDuplicate(row: DocumentRow) {
    if (!user) return;
    if (limitReached) {
      showToast(billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language), "error");
      return;
    }
    setBusyAction(`duplicate:${row.id}`);
    try {
      const source = documentFromRow(row);
      await saveDocument(user.id, {
        ...source,
        id: undefined,
        status: "draft",
        number: generateDocumentNumber("", source.type, documents, source.issueDate),
        createdAt: undefined,
        updatedAt: undefined
      });
      await Promise.all([loadDocuments(), refreshBilling()]);
      const success = pickLanguage(language, { en: "Copied as a new draft.", zh: "已复制为新草稿。", vi: "Đã sao chép thành bản nháp mới.", ar: "تم النسخ كمسودة جديدة." });
      setMessage(success);
      showToast(success);
    } catch (error) {
      const issue = billingErrorMessage(error, language);
      setMessage(issue);
      showToast(issue, "error");
    } finally {
      setBusyAction("");
    }
  }

  async function handleConvert(row: DocumentRow) {
    if (!user || row.type !== "quote") return;
    if (limitReached) {
      showToast(billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language), "error");
      return;
    }
    setBusyAction(`convert:${row.id}`);
    try {
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
      await Promise.all([loadDocuments(), refreshBilling()]);
      const success = pickLanguage(language, { en: "Quote converted to an invoice draft.", zh: "Quote 已转换为 Invoice 草稿。", vi: "Đã chuyển báo giá thành hóa đơn nháp.", ar: "تم تحويل عرض السعر إلى مسودة فاتورة." });
      setMessage(success);
      showToast(success);
    } catch (error) {
      const issue = billingErrorMessage(error, language);
      setMessage(issue);
      showToast(issue, "error");
    } finally {
      setBusyAction("");
    }
  }

  async function handleStatusChange(row: DocumentRow, status: DocumentStatus) {
    if (!user) return;
    setBusyAction(`status:${row.id}`);
    try {
      const source = documentFromRow(row);
      await saveDocument(user.id, { ...source, status });
      await loadDocuments();
      showToast(pickLanguage(language, { en: `Status changed to ${status}.`, zh: `状态已改为 ${status}。`, vi: `Đã đổi trạng thái thành ${status}.`, ar: `تم تغيير الحالة إلى ${status}.` }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update status.", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function documentPdfBlob(row: DocumentRow) {
    const source = documentFromRow(row);
    return pdf(<PaperMintPdf document={source} showBranding={billing.showBranding} />).toBlob();
  }

  async function handleDownload(row: DocumentRow) {
    setBusyAction(`download:${row.id}`);
    try {
      const blob = await documentPdfBlob(row);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${row.type}-${row.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast(pickLanguage(language, { en: "PDF downloaded.", zh: "PDF 已下载。", vi: "Đã tải PDF.", ar: "تم تنزيل ملف PDF." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to download PDF.", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function handleSend(row: DocumentRow) {
    if (!user) return;
    setBusyAction(`send:${row.id}`);
    try {
      const result = await shareDocument(user.id, row.id, true);
      showToast(result.message || copy({ en: "Email sent.", zh: "邮件已发送。", vi: "Đã gửi email.", ar: "تم إرسال البريد." }));
      await loadDocuments();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to share document.", "error");
    } finally {
      setBusyAction("");
    }
  }

  async function handleCopyShareLink(row: DocumentRow) {
    if (!user) return;
    setBusyAction(`link:${row.id}`);
    try {
      const result = await shareDocument(user.id, row.id);
      setShareUrl(result.url);
      try {
        await navigator.clipboard.writeText(result.url);
        showToast(copy({ en: "Secure document link copied.", zh: "安全文档链接已复制。", vi: "Đã sao chép liên kết chứng từ.", ar: "تم نسخ رابط المستند الآمن." }));
      } catch {
        showToast(copy({ en: "Share link created. Copy it from the window.", zh: "分享链接已生成，请从弹窗中复制。", vi: "Đã tạo liên kết. Hãy sao chép từ cửa sổ.", ar: "تم إنشاء الرابط. انسخه من النافذة." }));
      }
      await loadDocuments();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to copy document link.", "error");
    } finally { setBusyAction(""); }
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <section className="panel p-5">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-black tracking-normal">{t("documents")}</h1>
              <p className="text-sm font-semibold text-[var(--muted)]">
                {copy({ en: "Save, view, edit, copy and delete your own documents.", zh: "保存、查看、编辑、复制和删除自己的单据。", vi: "Lưu, xem, sửa, sao chép và xóa chứng từ của bạn.", ar: "احفظ مستنداتك واعرضها وعدّلها وانسخها واحذفها." })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {limitReached ? <button className="btn-primary" disabled title={billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language)} type="button"><LockKeyhole className="h-4 w-4" />{t("newInvoice")}</button> : <Link className="btn-primary" href="/documents/new?type=invoice">
                <FilePlus2 className="h-4 w-4" />
                {t("newInvoice")}
              </Link>}
              {limitReached ? <button className="btn-secondary" disabled title={billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language)} type="button"><LockKeyhole className="h-4 w-4" />{t("newQuote")}</button> : <Link className="btn-secondary" href="/documents/new?type=quote">
                <FileText className="h-4 w-4" />
                {t("newQuote")}
              </Link>}
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
                    {item === "all" ? copy({ en: "All", zh: "全部", vi: "Tất cả", ar: "الكل" }) : item === "invoice" ? t("invoice") : t("quote")}
                  </button>
                ))}
              </div>
              <select className="field max-w-56" onChange={(event) => setCustomerFilter(event.target.value)} value={customerFilter}>
                <option value="all">{copy({ en: "All customers", zh: "全部客户", vi: "Tất cả khách hàng", ar: "جميع العملاء" })}</option>
                {customerOptions.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
              <select className="field max-w-56" onChange={(event) => setIssuerFilter(event.target.value)} value={issuerFilter}>
                <option value="all">{copy({ en: "All issuers", zh: "全部开票方", vi: "Tất cả bên phát hành", ar: "جميع جهات الإصدار" })}</option>
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
              {copy({ en: "Loading documents", zh: "正在加载单据", vi: "Đang tải chứng từ", ar: "جارٍ تحميل المستندات" })}
            </div>
          ) : visibleDocuments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm font-semibold text-[var(--muted)]">
              {copy({ en: "No documents yet.", zh: "暂无单据。", vi: "Chưa có chứng từ.", ar: "لا توجد مستندات بعد." })}
            </div>
          ) : (
            <div className="overflow-x-auto pb-20">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
                    <th className="py-3 pr-3">{copy({ en: "Number", zh: "编号", vi: "Số", ar: "الرقم" })}</th>
                    <th className="px-3">{copy({ en: "Customer", zh: "客户", vi: "Khách hàng", ar: "العميل" })}</th>
                    <th className="px-3">{copy({ en: "Type", zh: "类型", vi: "Loại", ar: "النوع" })}</th>
                    <th className="px-3">{t("status")}</th>
                    <th className="px-3 text-right">{t("total")}</th>
                    <th className="px-3">{copy({ en: "Updated", zh: "更新时间", vi: "Cập nhật", ar: "آخر تحديث" })}</th>
                    <th className="py-3 pl-3 text-right">{copy({ en: "Actions", zh: "操作", vi: "Thao tác", ar: "الإجراءات" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDocuments.map((row) => (
                    <tr className="border-b border-[#edf1ed]" key={row.id}>
                      <td className="py-4 pr-3">
                        <Link className="hover:text-[var(--mint-dark)]" href={`/documents/${row.id}`}>
                          <span className="font-black">{row.number}</span>
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.sent_at ? <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700">SENT</span> : null}
                          {row.first_viewed_at ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">VIEWED</span> : null}
                          {row.accepted_at ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">ACCEPTED</span> : null}
                        </div>
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
                          <button className="icon-btn" disabled={limitReached || busyAction === `duplicate:${row.id}`} onClick={() => handleDuplicate(row)} title={limitReached ? billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language) : t("duplicate")} type="button">
                            {busyAction === `duplicate:${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                          </button>
                          <button className="icon-btn" disabled={busyAction === `download:${row.id}`} onClick={() => handleDownload(row)} title={t("downloadPdf")} type="button">
                            {busyAction === `download:${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                          <button className="icon-btn" disabled={busyAction === `send:${row.id}`} onClick={() => handleSend(row)} title={copy({ en: "Send email", zh: "发送邮件", vi: "Gửi email", ar: "إرسال بريد" })} type="button">
                            {busyAction === `send:${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          </button>
                          <button className="icon-btn" disabled={busyAction === `link:${row.id}`} onClick={() => handleCopyShareLink(row)} title={copy({ en: "Copy secure link", zh: "复制安全链接", vi: "Sao chép liên kết", ar: "نسخ الرابط الآمن" })} type="button">
                            {busyAction === `link:${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                          </button>
                          {row.type === "quote" ? (
                            <button className="icon-btn" disabled={limitReached || busyAction === `convert:${row.id}`} onClick={() => handleConvert(row)} title={limitReached ? billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language) : t("convertToInvoice")} type="button">
                              {busyAction === `convert:${row.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
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
                    {copy({ en: "Delete document?", zh: "删除单据？", vi: "Xóa chứng từ?", ar: "حذف المستند؟" })}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    {copy({ en: `Delete ${deleteTarget.number}? This cannot be undone.`, zh: `确认删除 ${deleteTarget.number}？此操作无法撤销。`, vi: `Xóa ${deleteTarget.number}? Không thể hoàn tác.`, ar: `حذف ${deleteTarget.number}؟ لا يمكن التراجع عن هذا الإجراء.` })}
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
                  {copy({ en: "Cancel", zh: "取消", vi: "Hủy", ar: "إلغاء" })}
                </button>
                <button className="btn-primary bg-[var(--rose)] hover:bg-[#a6293b]" disabled={busyAction === `delete:${deleteTarget.id}`} onClick={() => handleDelete(deleteTarget)} type="button">
                  {busyAction === `delete:${deleteTarget.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {shareUrl ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#17211b]/45 p-4 backdrop-blur-sm"
            onClick={() => setShareUrl("")}
            role="presentation"
          >
            <div
              aria-modal="true"
              className="w-full max-w-lg rounded-lg border border-[var(--line)] bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-normal">{copy({ en: "Secure document link", zh: "安全文档链接", vi: "Liên kết chứng từ an toàn", ar: "رابط المستند الآمن" })}</h2>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{copy({ en: "Anyone with this link can view the document.", zh: "获得此链接的人可以查看该文档。", vi: "Bất kỳ ai có liên kết đều có thể xem chứng từ.", ar: "يمكن لأي شخص لديه الرابط عرض المستند." })}</p>
                </div>
                <button className="icon-btn" onClick={() => setShareUrl("")} title={copy({ en: "Close", zh: "关闭", vi: "Đóng", ar: "إغلاق" })} type="button"><X className="h-4 w-4" /></button>
              </div>
              <input className="field font-mono text-xs" onFocus={(event) => event.currentTarget.select()} readOnly value={shareUrl} />
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <a className="btn-secondary" href={shareUrl} rel="noreferrer" target="_blank"><Link2 className="h-4 w-4" />{copy({ en: "Open link", zh: "打开链接", vi: "Mở liên kết", ar: "فتح الرابط" })}</a>
                <button className="btn-primary" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    showToast(copy({ en: "Link copied.", zh: "链接已复制。", vi: "Đã sao chép liên kết.", ar: "تم نسخ الرابط." }));
                  } catch {
                    showToast(copy({ en: "Select the link above and copy it manually.", zh: "请选择上方链接并手动复制。", vi: "Hãy chọn liên kết phía trên và sao chép thủ công.", ar: "حدد الرابط أعلاه وانسخه يدوياً." }), "error");
                  }
                }} type="button"><Copy className="h-4 w-4" />{copy({ en: "Copy link", zh: "复制链接", vi: "Sao chép", ar: "نسخ الرابط" })}</button>
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
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const classes: Record<DocumentStatus, { button: string; dot: string }> = {
    draft: { button: "bg-slate-50 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
    sent: { button: "bg-blue-50 text-blue-700 ring-blue-100", dot: "bg-blue-500" },
    paid: { button: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-500" },
    overdue: { button: "bg-rose-50 text-rose-700 ring-rose-100", dot: "bg-rose-500" },
    cancelled: { button: "bg-zinc-50 text-zinc-600 ring-zinc-200", dot: "bg-zinc-400" }
  };

  useEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 160;
      const estimatedMenuHeight = 214;
      const openBelow = window.innerHeight - rect.bottom >= estimatedMenuHeight;
      setMenuPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
        top: openBelow ? rect.bottom + 8 : Math.max(8, rect.top - estimatedMenuHeight - 8)
      });
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      window.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        className={`inline-flex min-w-32 items-center justify-between gap-2 rounded-full px-3 py-1.5 text-xs font-black capitalize shadow-sm ring-1 ${classes[value].button}`}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${classes[value].dot}`} />
          {statusLabel(value, language)}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed z-[100] w-40 overflow-hidden rounded-lg border border-[var(--line)] bg-white p-1 shadow-2xl"
          ref={menuRef}
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
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
              {statusLabel(status, language)}
              </span>
              {status === value ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function statusLabel(status: DocumentStatus, language: ReturnType<typeof useLanguage>["language"]) {
  const labels: Record<DocumentStatus, { en: string; zh: string; vi: string; ar: string }> = {
    draft: { en: "Draft", zh: "草稿", vi: "Bản nháp", ar: "مسودة" },
    sent: { en: "Sent", zh: "已发送", vi: "Đã gửi", ar: "مرسل" },
    paid: { en: "Paid", zh: "已付款", vi: "Đã thanh toán", ar: "مدفوع" },
    overdue: { en: "Overdue", zh: "逾期", vi: "Quá hạn", ar: "متأخر" },
    cancelled: { en: "Cancelled", zh: "已取消", vi: "Đã hủy", ar: "ملغى" }
  };
  return labels[status][language];
}
