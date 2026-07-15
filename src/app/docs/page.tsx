"use client";

import Link from "next/link";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";
import { useLanguage } from "@/components/app/LanguageProvider";
import { pickLanguage } from "@/lib/i18n";

export default function DocsPage() {
  const { language } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const steps = copy({
    en: ["Save default company details in Settings, or add multiple issuer profiles.", "Add customers with Bill To and Ship To details.", "Create an Invoice or Quote in Documents, then choose issuer and customer.", "Tick GST per line item and apply percentage or fixed discounts.", "Use Preview for the A4 view and Download PDF to export.", "Use Dashboard to review revenue by week, month or fiscal year and download a fiscal PDF report."],
    zh: ["在 Settings 保存默认公司资料，也可以添加多个开票方资料。", "在 Customers 添加客户，支持 Bill To 和 Ship To。", "在 Documents 新建 Invoice 或 Quote，选择开票方和客户后编辑项目。", "每个项目可勾选 GST，也可设置百分比或固定金额折扣。", "点击 Preview 查看 A4 预览，点击 Download PDF 下载文件。", "Dashboard 可按周、月、本财年查看营收，并下载财年 PDF 报表。"],
    vi: ["Lưu thông tin công ty mặc định trong Cài đặt hoặc thêm nhiều bên phát hành.", "Thêm khách hàng với địa chỉ Bên mua và Nơi giao.", "Tạo hóa đơn hoặc báo giá trong Chứng từ rồi chọn bên phát hành và khách hàng.", "Bật GST cho từng hạng mục và áp dụng giảm giá theo phần trăm hoặc số tiền.", "Dùng Xem trước để xem khổ A4 và Tải PDF để xuất file.", "Dùng Tổng quan để xem doanh thu theo tuần, tháng hoặc năm tài chính và tải báo cáo PDF."],
    ar: ["احفظ بيانات الشركة الافتراضية في الإعدادات أو أضف عدة جهات إصدار.", "أضف العملاء مع بيانات عنوان الفوترة والشحن.", "أنشئ فاتورة أو عرض سعر ثم اختر جهة الإصدار والعميل.", "فعّل GST لكل بند وطبّق خصماً بنسبة مئوية أو مبلغ ثابت.", "استخدم المعاينة لعرض A4 وتنزيل PDF للتصدير.", "راجع الإيرادات أسبوعياً أو شهرياً أو حسب السنة المالية ونزّل تقرير PDF."]
  });

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="panel mx-auto max-w-3xl p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-normal">
              {copy({ en: "PaperMint Documentation", zh: "PaperMint 使用文档", vi: "Tài liệu PaperMint", ar: "دليل PaperMint" })}
            </h1>
            <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
              {copy({ en: "Create customers, issuers, invoices, quotes and PDFs quickly.", zh: "快速完成客户、开票方、发票、报价和 PDF 导出。", vi: "Nhanh chóng tạo khách hàng, bên phát hành, hóa đơn, báo giá và PDF.", ar: "أنشئ العملاء وجهات الإصدار والفواتير وعروض الأسعار وملفات PDF بسرعة." })}
            </p>
          </div>
          <LanguageSwitch />
        </div>

        <div className="grid gap-4 text-sm leading-7 text-[var(--muted)]">
          {steps.map((step, index) => <p key={step}>{index + 1}. {step}</p>)}
        </div>

        <Link className="btn-primary mt-6" href="/dashboard">
          {copy({ en: "Back to dashboard", zh: "返回工作台", vi: "Quay lại tổng quan", ar: "العودة إلى لوحة التحكم" })}
        </Link>
      </section>
    </main>
  );
}
