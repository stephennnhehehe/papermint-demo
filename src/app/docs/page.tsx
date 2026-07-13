"use client";

import Link from "next/link";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";
import { useLanguage } from "@/components/app/LanguageProvider";

export default function DocsPage() {
  const { language } = useLanguage();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="panel mx-auto max-w-3xl p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-normal">
              {language === "zh" ? "PaperMint 使用文档" : "PaperMint Documentation"}
            </h1>
            <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
              {language === "zh"
                ? "快速完成客户、开票方、发票、报价和 PDF 导出。"
                : "Create customers, issuers, invoices, quotes and PDFs quickly."}
            </p>
          </div>
          <LanguageSwitch />
        </div>

        <div className="grid gap-4 text-sm leading-7 text-[var(--muted)]">
          {language === "zh" ? (
            <>
              <p>1. 在 Settings 保存默认公司资料，也可以添加多个开票方资料。</p>
              <p>2. 在 Customers 添加客户，支持 Bill To 和 Ship To。</p>
              <p>3. 在 Documents 新建 Invoice 或 Quote，选择开票方和客户后编辑项目。</p>
              <p>4. 每个项目可勾选 GST，也可设置百分比或固定金额折扣。</p>
              <p>5. 点击 Preview 查看 A4 预览，点击 Download PDF 下载文件。</p>
              <p>6. Dashboard 可按周、月、本财年查看营收，并下载财年 PDF 报表。</p>
            </>
          ) : (
            <>
              <p>1. Save default company details in Settings, or add multiple issuer profiles.</p>
              <p>2. Add customers with Bill To and Ship To details.</p>
              <p>3. Create an Invoice or Quote in Documents, then choose issuer and customer.</p>
              <p>4. Tick GST per line item and apply percentage or fixed discounts.</p>
              <p>5. Use Preview for the A4 view and Download PDF to export.</p>
              <p>6. Use Dashboard to review revenue by week, month or fiscal year and download a fiscal PDF report.</p>
            </>
          )}
        </div>

        <Link className="btn-primary mt-6" href="/dashboard">
          {language === "zh" ? "返回工作台" : "Back to dashboard"}
        </Link>
      </section>
    </main>
  );
}
