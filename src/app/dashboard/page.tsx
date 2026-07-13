"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pdf } from "@react-pdf/renderer";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, CheckCircle2, Download, FilePlus2, FileText, Loader2, Timer } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { FiscalReportPdf, type FiscalReportRow } from "@/components/pdf/FiscalReportPdf";
import { fetchDocuments } from "@/lib/api";
import { formatAud } from "@/lib/calculations";
import type { DocumentRow } from "@/lib/types";

type ChartPeriod = "week" | "month" | "fiscal";

function isInvoiceOverdue(document: DocumentRow) {
  if (document.type !== "invoice") return false;
  if (document.status === "paid" || document.status === "cancelled") return false;
  if (document.status === "overdue") return true;
  if (!document.due_date) return false;
  return new Date(`${document.due_date}T23:59:59`) < new Date();
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function paidInvoices(documents: DocumentRow[]) {
  return documents.filter((document) => document.type === "invoice" && document.status === "paid");
}

function fiscalYearStart(today = new Date()) {
  const year = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return new Date(year, 6, 1);
}

function buildChart(documents: DocumentRow[], period: ChartPeriod) {
  const now = new Date();
  if (period === "week") {
    const weeks = Array.from({ length: 12 }).map((_, index) => {
      const end = new Date(now);
      end.setDate(now.getDate() - (11 - index) * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return {
        month: `${start.toISOString().slice(5, 10)}-${end.toISOString().slice(5, 10)}`,
        start,
        end,
        revenue: 0
      };
    });
    paidInvoices(documents).forEach((document) => {
      const date = new Date(`${document.issue_date}T00:00:00`);
      const entry = weeks.find((week) => date >= week.start && date <= week.end);
      if (entry) entry.revenue += document.totals?.total ?? 0;
    });
    return weeks.map(({ month, revenue }) => ({ month, revenue }));
  }

  const startMonth = period === "fiscal" ? fiscalYearStart(now).getMonth() : 0;
  const startYear = period === "fiscal" ? fiscalYearStart(now).getFullYear() : now.getFullYear();
  const months = Array.from({ length: 12 }).map((_, index) => {
    const date = new Date(startYear, startMonth + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      month: key,
      revenue: 0
    };
  });

  const byMonth = new Map(months.map((entry) => [entry.month, entry]));
  paidInvoices(documents).forEach((document) => {
    const key = monthKey(document.issue_date);
    const entry = byMonth.get(key);
    if (entry) entry.revenue += document.totals?.total ?? 0;
  });
  return months;
}

function fiscalReportRows(documents: DocumentRow[]): FiscalReportRow[] {
  const start = fiscalYearStart();
  return Array.from({ length: 12 }).map((_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const invoices = paidInvoices(documents).filter((document) => monthKey(document.issue_date) === key);
    return {
      period: key,
      invoiceCount: invoices.length,
      revenue: invoices.reduce((sum, document) => sum + (document.totals?.total ?? 0), 0)
    };
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<ChartPeriod>("month");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [downloadingReport, setDownloadingReport] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchDocuments(user.id)
      .then(setDocuments)
      .catch((issue) => setError(issue instanceof Error ? issue.message : "Unable to load dashboard."))
      .finally(() => setLoading(false));
  }, [user]);

  const companyOptions = useMemo(
    () =>
      Array.from(new Set(documents.map((document) => document.company?.name).filter(Boolean))).sort(),
    [documents]
  );

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => companyFilter === "all" || document.company?.name === companyFilter),
    [companyFilter, documents]
  );

  const stats = useMemo(() => {
    const invoices = filteredDocuments.filter((document) => document.type === "invoice");
    const paid = invoices
      .filter((document) => document.status === "paid")
      .reduce((sum, document) => sum + (document.totals?.total ?? 0), 0);
    const overdue = invoices
      .filter(isInvoiceOverdue)
      .reduce((sum, document) => sum + (document.totals?.total ?? 0), 0);
    const unpaid = invoices
      .filter(
        (document) =>
          document.status !== "paid" &&
          document.status !== "cancelled" &&
          !isInvoiceOverdue(document)
      )
      .reduce((sum, document) => sum + (document.totals?.total ?? 0), 0);

    return {
      invoices: invoices.length,
      paid,
      unpaid,
      overdue,
      quotes: filteredDocuments.filter((document) => document.type === "quote").length,
      chart: buildChart(filteredDocuments, period),
      fiscalRows: fiscalReportRows(filteredDocuments)
    };
  }, [filteredDocuments, period]);

  async function handleDownloadFiscalReport() {
    setDownloadingReport(true);
    try {
      const fyStart = fiscalYearStart();
      const fyEnd = new Date(fyStart.getFullYear() + 1, 5, 30);
      const title = language === "zh" ? "财年营收报表" : "Fiscal year revenue report";
      const subtitle = `${fyStart.toISOString().slice(0, 10)} to ${fyEnd.toISOString().slice(0, 10)}`;
      const blob = await pdf(
        <FiscalReportPdf rows={stats.fiscalRows} subtitle={subtitle} title={title} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `papermint-fiscal-report-${fyStart.getFullYear()}-${fyStart.getFullYear() + 1}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingReport(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-5">
          <section className="flex flex-col justify-between gap-5 rounded-lg bg-[var(--foreground)] p-6 text-white lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-bold text-white/65">PaperMint</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal">
                {language === "zh" ? "今天的业务概览" : "Your business at a glance"}
              </h1>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
              <label className="w-full rounded-lg border border-white/15 bg-white/10 p-3 shadow-sm lg:min-w-80">
                <span className="mb-1 block text-xs font-black uppercase tracking-normal text-white/65">
                  {language === "zh" ? "公司筛选" : "Company filter"}
                </span>
                <select
                  className="w-full rounded-md border border-white/20 bg-white px-3 py-2 text-sm font-black text-[var(--foreground)] outline-none"
                  onChange={(event) => setCompanyFilter(event.target.value)}
                  value={companyFilter}
                >
                  <option value="all">{language === "zh" ? "全部公司" : "All companies"}</option>
                  {companyOptions.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Link className="btn-primary bg-white text-[var(--foreground)] hover:bg-[#f1f5f2]" href="/documents/new?type=invoice">
                  <FilePlus2 className="h-4 w-4" />
                  {t("newInvoice")}
                </Link>
                <Link className="btn-secondary border-white/20 bg-white/10 text-white hover:text-white" href="/documents/new?type=quote">
                  <FileText className="h-4 w-4" />
                  {t("newQuote")}
                </Link>
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
              {error}
            </div>
          )}

          {loading ? (
            <div className="panel flex items-center gap-3 p-5 text-sm font-semibold text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading dashboard
            </div>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label={t("totalInvoices")} value={String(stats.invoices)} icon={<FileText className="h-5 w-5" />} />
                <Stat label={t("paid")} value={formatAud(stats.paid)} tone="green" icon={<CheckCircle2 className="h-5 w-5" />} />
                <Stat label={t("unpaid")} value={formatAud(stats.unpaid)} tone="amber" icon={<Timer className="h-5 w-5" />} />
                <Stat label={t("overdue")} value={formatAud(stats.overdue)} tone="rose" icon={<AlertCircle className="h-5 w-5" />} />
              </section>

              <section className="panel p-5">
                <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                  <div>
                    <h2 className="text-xl font-black tracking-normal">{t("revenueTrend")}</h2>
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      {language === "zh" ? "按已付款发票统计" : "Paid invoices by selected period"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-grid grid-cols-3 rounded-lg border border-[var(--line)] bg-white/70 p-1">
                      {[
                        { label: language === "zh" ? "周" : "Week", value: "week" },
                        { label: language === "zh" ? "月" : "Month", value: "month" },
                        { label: language === "zh" ? "本财年" : "FY", value: "fiscal" }
                      ].map((item) => (
                        <button
                          className={`rounded-md px-3 py-2 text-sm font-black ${
                            period === item.value ? "bg-[var(--foreground)] text-white" : "text-[var(--muted)]"
                          }`}
                          key={item.value}
                          onClick={() => setPeriod(item.value as ChartPeriod)}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <button className="btn-secondary" disabled={downloadingReport} onClick={handleDownloadFiscalReport} type="button">
                      {downloadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {language === "zh" ? "下载财年报表" : "Download FY report"}
                    </button>
                    <div className="rounded-lg bg-[#edf6f1] px-3 py-2 text-sm font-black text-[var(--mint-dark)]">
                      {stats.quotes} {t("quote")}
                    </div>
                  </div>
                </div>
                <div className="h-[320px]">
                  <ResponsiveContainer height="100%" width="100%">
                    <AreaChart data={stats.chart} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenue" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#2f8c67" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2f8c67" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e3e9e2" vertical={false} />
                      <XAxis dataKey="month" stroke="#66736b" tickLine={false} />
                      <YAxis stroke="#66736b" tickFormatter={(value) => `$${value}`} tickLine={false} width={64} />
                      <Tooltip formatter={(value) => formatAud(Number(value))} />
                      <Area dataKey="revenue" fill="url(#revenue)" stroke="#2f8c67" strokeWidth={3} type="monotone" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "blue"
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "rose";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-[var(--blue)]",
    green: "bg-emerald-50 text-[var(--mint-dark)]",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-[var(--rose)]"
  }[tone];

  return (
    <div className="panel p-5">
      <div className={`mb-5 grid h-11 w-11 place-items-center rounded-lg ${toneClass}`}>{icon}</div>
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-normal">{value}</p>
    </div>
  );
}
