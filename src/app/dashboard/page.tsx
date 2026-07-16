"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, Clock3, Copy, FilePlus2, FileText, Loader2, LockKeyhole, Mail, ReceiptText, Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useBilling } from "@/components/app/BillingProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import { fetchCompanyProfiles, fetchDocuments, fetchExpenses, saveDocument } from "@/lib/api";
import { billingErrorMessage, isFreeDocumentLimitReached } from "@/lib/billing";
import { formatAud } from "@/lib/calculations";
import { shareDocument } from "@/lib/document-delivery";
import { documentFromRow, statusForDueDate } from "@/lib/documents";
import { pickLanguage } from "@/lib/i18n";
import type { CompanyRecord, DocumentRow, Expense } from "@/lib/types";

type Period = "week" | "month" | "fiscal";
type Action = { key: string; document: DocumentRow; tone: "rose" | "amber" | "mint"; title: string; detail: string; kind: "remind" | "open" };

const dayMs = 86_400_000;
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

function overdue(document: DocumentRow) {
  return document.type === "invoice" && statusForDueDate(document.status, document.due_date ?? "") === "overdue";
}

function startOfFiscalYear(today = new Date()) {
  return new Date(today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1, 6, 1);
}

function timeline(documents: DocumentRow[], period: Period) {
  const now = new Date();
  const weekly = period === "week";
  const count = weekly ? 12 : 12;
  const start = weekly ? new Date(now.getTime() - 11 * 7 * dayMs) : period === "fiscal" ? startOfFiscalYear(now) : new Date(now.getFullYear(), 0, 1);
  const buckets = Array.from({ length: count }, (_, index) => {
    const bucketStart = weekly ? new Date(start.getTime() + index * 7 * dayMs) : new Date(start.getFullYear(), start.getMonth() + index, 1);
    const bucketEnd = weekly ? new Date(bucketStart.getTime() + 7 * dayMs - 1) : new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 0, 23, 59, 59);
    return { label: weekly ? `${bucketStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : bucketStart.toLocaleDateString("en-AU", { month: "short" }), start: bucketStart, end: bucketEnd, received: 0, expected: 0, overdue: 0, gst: 0 };
  });
  for (const document of documents.filter((item) => item.type === "invoice" && item.status !== "cancelled" && item.status !== "draft")) {
    const paidDate = document.paid_at ?? (document.status === "paid" ? document.updated_at : null);
    const targetDate = paidDate ? new Date(paidDate) : document.due_date ? new Date(`${document.due_date}T12:00:00`) : null;
    if (!targetDate) continue;
    const bucket = buckets.find((item) => targetDate >= item.start && targetDate <= item.end);
    if (!bucket) continue;
    const total = Number(document.totals?.total ?? 0);
    const gst = Number(document.totals?.gst ?? 0);
    if (document.status === "paid") { bucket.received += total; bucket.gst += gst; }
    else if (overdue(document)) bucket.overdue += total;
    else bucket.expected += total;
  }
  return buckets.map(({ label, received, expected, overdue: late, gst }) => ({ label, received, expected, overdue: late, gst }));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { billing } = useBilling();
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const copy = useCallback((values: { en: string; zh?: string; vi?: string; ar?: string }) => pickLanguage(language, values), [language]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [companyId, setCompanyId] = useState("all");
  const [period, setPeriod] = useState<Period>("fiscal");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [now] = useState(() => Date.now());
  const limitReached = isFreeDocumentLimitReached(billing);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [documentRows, expenseRows, companyRows] = await Promise.all([fetchDocuments(user.id), fetchExpenses(user.id), fetchCompanyProfiles(user.id)]);
      setDocuments(documentRows); setExpenses(expenseRows); setCompanies(companyRows);
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to load dashboard.", "error"); }
    finally { setLoading(false); }
  }, [showToast, user]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => documents.filter((document) => companyId === "all" || document.company_profile_id === companyId || (!document.company_profile_id && companies.find((company) => company.id === companyId)?.business_name === document.company?.name)), [companies, companyId, documents]);
  const filteredExpenses = useMemo(() => expenses.filter((expense) => companyId === "all" || expense.company_profile_id === companyId), [companyId, expenses]);
  const invoices = filtered.filter((document) => document.type === "invoice" && document.status !== "cancelled");
  const paid = invoices.filter((document) => document.status === "paid").reduce((sum, document) => sum + Number(document.totals?.total ?? 0), 0);
  const late = invoices.filter(overdue).reduce((sum, document) => sum + Number(document.totals?.total ?? 0), 0);
  const outstanding = invoices.filter((document) => document.status !== "paid" && !overdue(document) && document.status !== "draft").reduce((sum, document) => sum + Number(document.totals?.total ?? 0), 0);
  const gstReserve = invoices.filter((document) => document.status === "paid").reduce((sum, document) => sum + Number(document.totals?.gst ?? 0), 0) - filteredExpenses.reduce((sum, expense) => sum + (expense.gst_claimable ? Number(expense.gst_amount) : 0), 0);
  const chart = useMemo(() => timeline(filtered, period), [filtered, period]);

  const actions = useMemo<Action[]>(() => {
    const convertedIds = new Set(filtered.map((document) => document.converted_from_quote_id).filter(Boolean));
    const next: Action[] = [];
    for (const document of filtered) {
      if (document.type === "quote" && document.accepted_at && !convertedIds.has(document.id)) { next.push({ key: `accepted:${document.id}`, document, tone: "mint", title: copy({ en: "Accepted quote is ready", zh: "已接受的 Quote 可转为 Invoice", vi: "Báo giá đã chấp nhận sẵn sàng", ar: "عرض السعر المقبول جاهز" }), detail: `${document.number} · ${document.bill_to?.name || "Customer"}`, kind: "open" }); continue; }
      if (overdue(document)) { next.push({ key: `overdue:${document.id}`, document, tone: "rose", title: copy({ en: "Payment is overdue", zh: "付款已经逾期", vi: "Thanh toán đã quá hạn", ar: "الدفعة متأخرة" }), detail: `${document.number} · ${formatAud(Number(document.totals?.total ?? 0))}`, kind: "remind" }); continue; }
      if (document.type === "invoice" && document.status !== "paid" && document.status !== "draft" && document.due_date) {
        const days = Math.ceil((new Date(`${document.due_date}T23:59:59`).getTime() - now) / dayMs);
        if (days >= 0 && days <= 3) { next.push({ key: `due:${document.id}`, document, tone: "amber", title: days === 0 ? copy({ en: "Due today", zh: "今天到期", vi: "Đến hạn hôm nay", ar: "مستحق اليوم" }) : copy({ en: `Due in ${days} days`, zh: `${days} 天后到期`, vi: `Đến hạn sau ${days} ngày`, ar: `مستحق خلال ${days} أيام` }), detail: `${document.number} · ${document.bill_to?.name || "Customer"}`, kind: "remind" }); continue; }
      }
      if (document.sent_at && !document.first_viewed_at && now - new Date(document.sent_at).getTime() > 2 * dayMs) next.push({ key: `unread:${document.id}`, document, tone: "amber", title: copy({ en: "Sent but not viewed", zh: "已发送但尚未查看", vi: "Đã gửi nhưng chưa xem", ar: "أُرسل ولم يُعرض" }), detail: `${document.number} · ${document.bill_to?.name || "Customer"}`, kind: "remind" });
    }
    return next.slice(0, 6);
  }, [copy, filtered, now]);

  const funnel = useMemo(() => {
    const quotes = filtered.filter((document) => document.type === "quote");
    const invoiceByQuote = new Map(filtered.filter((document) => document.converted_from_quote_id).map((document) => [document.converted_from_quote_id, document]));
    return [
      { label: "Created", value: quotes.length },
      { label: "Sent", value: quotes.filter((quote) => quote.sent_at).length },
      { label: "Viewed", value: quotes.filter((quote) => quote.first_viewed_at).length },
      { label: "Accepted", value: quotes.filter((quote) => quote.accepted_at).length },
      { label: "Invoiced", value: quotes.filter((quote) => invoiceByQuote.has(quote.id)).length },
      { label: "Paid", value: quotes.filter((quote) => invoiceByQuote.get(quote.id)?.status === "paid").length }
    ];
  }, [filtered]);

  async function handleReminder(action: Action) {
    if (!user) return;
    setBusy(action.key);
    try {
      const result = await shareDocument(user.id, action.document.id, true, true);
      showToast(result.message || "Reminder sent.");
      await load();
    } catch (error) { showToast(error instanceof Error ? error.message : "Unable to send reminder.", "error"); }
    finally { setBusy(""); }
  }

  async function handleCopyLink(document: DocumentRow) {
    if (!user) return;
    setBusy(`copy:${document.id}`);
    try { const result = await shareDocument(user.id, document.id); await navigator.clipboard.writeText(result.url); showToast(copy({ en: "Secure link copied.", zh: "安全链接已复制。", vi: "Đã sao chép liên kết bảo mật.", ar: "تم نسخ الرابط الآمن." })); await load(); }
    catch (error) { showToast(error instanceof Error ? error.message : "Unable to copy link.", "error"); }
    finally { setBusy(""); }
  }

  async function markPaid(document: DocumentRow) {
    if (!user) return;
    setBusy(`paid:${document.id}`);
    try { await saveDocument(user.id, { ...documentFromRow(document), status: "paid", paidAt: new Date().toISOString() }); showToast(copy({ en: "Invoice marked paid.", zh: "Invoice 已标记为付款。", vi: "Đã đánh dấu hóa đơn là đã thanh toán.", ar: "تم تحديد الفاتورة كمدفوعة." })); await load(); }
    catch (error) { showToast(error instanceof Error ? error.message : "Unable to update invoice.", "error"); }
    finally { setBusy(""); }
  }

  return <ProtectedRoute><AppShell><div className="grid gap-5">
    <section className="overflow-hidden rounded-lg bg-[#17211b] p-5 text-white shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase text-[#9ed4bd]">Cashflow command centre</p><h1 className="mt-2 text-3xl font-black">{copy({ en: "Know what is coming in and what needs attention.", zh: "清楚知道钱何时到账，以及今天该处理什么。", vi: "Biết tiền nào sắp về và việc gì cần xử lý.", ar: "اعرف ما سيصل وما يحتاج إلى اهتمام." })}</h1></div><label className="min-w-64"><span className="mb-1 block text-xs font-black uppercase text-[#b9c8c0]">{copy({ en: "Business view", zh: "公司视图", vi: "Chế độ doanh nghiệp", ar: "عرض النشاط" })}</span><select className="w-full rounded-md border border-white/20 bg-white px-3 py-2.5 font-black text-[#17211b]" value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="all">{copy({ en: "All companies", zh: "全部公司", vi: "Tất cả công ty", ar: "كل الشركات" })}</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.business_name}</option>)}</select></label></div>
      <div className="mt-5 flex flex-wrap gap-2">{limitReached ? <button className="btn-primary bg-white text-[#17211b]" disabled title={billingErrorMessage(new Error("FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"), language)}><LockKeyhole className="h-4 w-4" />{t("newInvoice")}</button> : <Link className="btn-primary bg-white text-[#17211b]" href="/documents/new?type=invoice"><FilePlus2 className="h-4 w-4" />{t("newInvoice")}</Link>}<Link className="btn-secondary border-white/20 bg-white/10 text-white" href="/expenses"><ReceiptText className="h-4 w-4" />{copy({ en: "Add expense", zh: "添加费用", vi: "Thêm chi phí", ar: "إضافة مصروف" })}</Link></div>
    </section>

    {loading ? <div className="panel flex items-center gap-3 p-5 text-sm font-semibold text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" />Loading dashboard</div> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={<CheckCircle2 className="h-5 w-5" />} label={copy({ en: "Received", zh: "已收", vi: "Đã nhận", ar: "المستلم" })} value={formatAud(paid)} tone="mint" /><Stat icon={<Clock3 className="h-5 w-5" />} label={copy({ en: "Outstanding", zh: "待收", vi: "Chờ thu", ar: "مستحق" })} value={formatAud(outstanding)} tone="blue" /><Stat icon={<AlertCircle className="h-5 w-5" />} label={t("overdue")} value={formatAud(late)} tone="rose" /><Stat icon={<Sparkles className="h-5 w-5" />} label={copy({ en: "GST reserve", zh: "GST 预留", vi: "Dự phòng GST", ar: "احتياطي GST" })} value={formatAud(gstReserve)} tone="amber" /></section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_.75fr]">
        <div className="panel p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black">Money Timeline</h2><p className="text-sm font-semibold text-[var(--muted)]">{copy({ en: "Received cash, expected receipts, overdue value and GST.", zh: "已收现金、预计到账、逾期金额和 GST。", vi: "Tiền đã nhận, dự kiến thu, quá hạn và GST.", ar: "المبالغ المستلمة والمتوقعة والمتأخرة وGST." })}</p></div><div className="inline-grid grid-cols-3 rounded-lg border border-[var(--line)] bg-[#f7f9f6] p-1">{(["week", "month", "fiscal"] as Period[]).map((item) => <button className={`rounded-md px-3 py-2 text-sm font-black ${period === item ? "bg-white text-[var(--mint-dark)] shadow-sm" : "text-[var(--muted)]"}`} key={item} onClick={() => setPeriod(item)} type="button">{{ week: "12W", month: copy({ en: "Year", zh: "年度", vi: "Năm", ar: "سنة" }), fiscal: "FY" }[item]}</button>)}</div></div><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}><CartesianGrid stroke="#e3e9e2" vertical={false} /><XAxis dataKey="label" stroke="#66736b" tickLine={false} /><YAxis stroke="#66736b" tickFormatter={(value) => `$${value}`} tickLine={false} width={58} /><Tooltip formatter={(value) => formatAud(Number(value))} /><Bar dataKey="received" name="Received" fill="#2f8c67" radius={[4, 4, 0, 0]} /><Bar dataKey="expected" name="Expected" fill="#72a8d9" radius={[4, 4, 0, 0]} /><Bar dataKey="overdue" name="Overdue" fill="#d75b6b" radius={[4, 4, 0, 0]} /><Line dataKey="gst" name="GST reserve" stroke="#d49b31" strokeWidth={2.5} dot={false} type="monotone" /></ComposedChart></ResponsiveContainer></div><div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-[var(--muted)]"><Legend color="#2f8c67" label="Received" /><Legend color="#72a8d9" label="Expected" /><Legend color="#d75b6b" label="Overdue" /><Legend color="#d49b31" label="GST" line /></div></div>

        <div className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-black">Today’s Actions</h2><p className="text-sm font-semibold text-[var(--muted)]">{copy({ en: "A focused follow-up queue.", zh: "集中处理今天的跟进。", vi: "Danh sách theo dõi tập trung.", ar: "قائمة متابعة مركزة." })}</p></div><CalendarClock className="h-5 w-5 text-[var(--mint-dark)]" /></div>{actions.length === 0 ? <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-[var(--mint-dark)]" /><p className="mt-2 font-black">{copy({ en: "Nothing urgent today", zh: "今天没有紧急事项", vi: "Hôm nay không có việc gấp", ar: "لا شيء عاجل اليوم" })}</p></div> : <div className="grid gap-2">{actions.map((action) => <article className="rounded-lg border border-[var(--line)] bg-white/80 p-3" key={action.key}><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${action.tone === "rose" ? "bg-rose-500" : action.tone === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} /><div className="min-w-0 flex-1"><p className="font-black">{action.title}</p><p className="truncate text-xs font-semibold text-[var(--muted)]">{action.detail}</p></div></div><div className="mt-3 flex gap-2"><Link className="btn-secondary flex-1 px-3 py-2 text-xs" href={`/documents/${action.document.id}`}>{copy({ en: "Open", zh: "打开", vi: "Mở", ar: "فتح" })}<ArrowRight className="h-3.5 w-3.5" /></Link>{action.kind === "remind" ? <button className="icon-btn" disabled={busy === action.key} onClick={() => handleReminder(action)} title={copy({ en: "Send reminder", zh: "发送提醒", vi: "Gửi nhắc nhở", ar: "إرسال تذكير" })} type="button">{busy === action.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}</button> : null}<button className="icon-btn" disabled={busy === `copy:${action.document.id}`} onClick={() => handleCopyLink(action.document)} title={copy({ en: "Copy secure link", zh: "复制安全链接", vi: "Sao chép liên kết", ar: "نسخ الرابط" })} type="button"><Copy className="h-4 w-4" /></button>{action.document.type === "invoice" && action.document.status !== "paid" ? <button className="icon-btn text-[var(--mint-dark)]" disabled={busy === `paid:${action.document.id}`} onClick={() => markPaid(action.document)} title={copy({ en: "Mark paid", zh: "标记付款", vi: "Đánh dấu đã thanh toán", ar: "تحديد كمدفوع" })} type="button"><CheckCircle2 className="h-4 w-4" /></button> : null}</div></article>)}</div>}</div>
      </section>

      <section className="panel p-5"><div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">Quote-to-Paid</h2><p className="text-sm font-semibold text-[var(--muted)]">{copy({ en: "See where work slows down before cash is received.", zh: "查看工作在哪个阶段停滞，影响最终收款。", vi: "Xem công việc chậm lại ở đâu trước khi thu tiền.", ar: "اعرف أين يتباطأ العمل قبل تحصيل المال." })}</p></div><Link className="btn-secondary" href="/documents?type=quote"><FileText className="h-4 w-4" />{copy({ en: "Review quotes", zh: "查看 Quotes", vi: "Xem báo giá", ar: "مراجعة عروض الأسعار" })}</Link></div><div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">{funnel.map((step, index) => { const previous = index === 0 ? step.value : funnel[index - 1].value; const rate = previous ? Math.round((step.value / previous) * 100) : 0; return <div className="relative rounded-lg border border-[var(--line)] bg-white/75 p-4" key={step.label}><p className="text-xs font-black uppercase text-[var(--muted)]">{step.label}</p><p className="mt-2 text-3xl font-black">{step.value}</p>{index > 0 ? <p className="mt-1 text-xs font-bold text-[var(--mint-dark)]">{rate}% from previous</p> : <p className="mt-1 text-xs font-bold text-[var(--muted)]">All quotes</p>}</div>; })}</div></section>
    </>}
  </div></AppShell></ProtectedRoute>;
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "mint" | "blue" | "rose" | "amber" }) {
  const color = { mint: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700", rose: "bg-rose-50 text-rose-700", amber: "bg-amber-50 text-amber-700" }[tone];
  return <div className="panel p-5"><span className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}>{icon}</span><p className="mt-4 text-sm font-bold text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

function Legend({ color, label, line = false }: { color: string; label: string; line?: boolean }) { return <span className="inline-flex items-center gap-2"><span className={`${line ? "h-0.5 w-4" : "h-2.5 w-2.5 rounded-sm"}`} style={{ background: color }} />{label}</span>; }
