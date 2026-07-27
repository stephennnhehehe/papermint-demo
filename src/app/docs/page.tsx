"use client";

import Link from "next/link";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";
import { useLanguage } from "@/components/app/LanguageProvider";
import { pickLanguage } from "@/lib/i18n";

export default function DocsPage() {
  const { language } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const sections = copy({
    en: [
      ["1. Set up your business", "In Settings, save your default business, ABN, contact details, payment instructions and logo. Add separate issuer profiles when you invoice through more than one business. Set each issuer's GST registration, accounting basis and BAS frequency."],
      ["2. Add customers", "Create reusable customer records with billing and shipping details. Selecting a customer on a document fills those details automatically."],
      ["3. Create invoices and quotes", "Create an Invoice or Quote in Documents. Add compact line items, GST, line or order discounts, decimal quantities and negative-price return or loss lines. Preview the A4 layout before downloading the PDF."],
      ["4. Send and track documents", "Save first, then email or copy the secure customer link. PaperMint records sent, viewed and accepted milestones. Convert accepted quotes to invoices and mark invoices Paid from either the Documents list or editor."],
      ["5. Record expenses", "In Expenses, record supplier details, category, capital or non-capital treatment, GST treatment, business-use percentage and Paid from / Payment account. Upload supporting PDF or image receipts. Trading stock purchases are separated for BAS reconciliation."],
      ["6. Keep a vehicle logbook", "Add a vehicle and its representative logbook period, then record each journey's odometer readings, purpose and business-use percentage. PaperMint calculates business kilometres and can include the register in the accountant pack."],
      ["7. Review and export", "Dashboard shows cash received, expected and overdue amounts. Expenses can generate a BAS preparation PDF and an FY accountant ZIP containing CSV registers and attachments. These are preparation records only—not BAS lodgement or accounting, tax or legal advice."],
      ["8. Plans and data", "The free plan allows 5 new invoices or quotes per Australian week and adds PaperMint branding to output. Paid plans remove the limit and footer. Your account data is isolated by user; receipt attachments are stored privately."]
    ],
    zh: [
      ["1. 设置企业资料", "在 Settings 保存默认企业名称、ABN、联系方式、付款说明及 Logo。若通过多个主体开票，可分别建立 Issuer；同时设置各主体的 GST 注册状态、记账基础和 BAS 周期。"],
      ["2. 添加客户", "建立可重复使用的客户资料，包括 Bill To 和 Ship To。创建单据时选择客户即可自动填入相关信息。"],
      ["3. 创建 Invoice 与 Quote", "在 Documents 新建 Invoice 或 Quote。Line item 支持 GST、单项及整单折扣、小数数量，以及用负数价格记录退货或损耗。下载 PDF 前可先预览 A4 排版。"],
      ["4. 发送并跟踪单据", "先保存单据，再发送邮件或复制安全客户链接。PaperMint 会记录已发送、已查看和已接受等节点；Quote 可转为 Invoice，Invoice 可直接在 Documents 列表或编辑器中标记为 Paid。"],
      ["5. 记录 Expense", "在 Expenses 记录供应商、费用类别、资本或非资本采购、GST 处理、业务使用比例及 Paid from / Payment account。可上传 PDF 或图片凭证；进货成本会单独汇总，便于 BAS 对账。"],
      ["6. 维护车辆 Logbook", "添加车辆和代表性 Logbook 周期，再记录每次行程的起止里程、用途和业务使用百分比。PaperMint 会计算业务公里，并可将记录导入 accountant pack。"],
      ["7. 查看与导出", "Dashboard 展示已收、预计及逾期金额。Expenses 可生成 BAS preparation PDF，以及包含 CSV 台账和附件的财年 accountant ZIP。这些文件仅用于准备和核对，不代表自动申报，也不构成会计、税务或法律建议。"],
      ["8. 套餐与数据", "免费方案每个澳洲自然周可新建 5 份 Invoice 或 Quote，输出中带 PaperMint 标识；付费方案移除限制和页脚。账户数据按用户隔离，收据附件为私有存储。"]
    ],
    vi: [
      ["1. Thiết lập doanh nghiệp", "Lưu doanh nghiệp mặc định, ABN, thông tin liên hệ, hướng dẫn thanh toán và logo trong Cài đặt. Có thể thêm nhiều hồ sơ bên phát hành và thiết lập GST, cơ sở kế toán cùng chu kỳ BAS cho từng hồ sơ."],
      ["2. Thêm khách hàng", "Tạo hồ sơ khách hàng dùng lại với địa chỉ thanh toán và giao hàng. Khi chọn khách hàng, chứng từ sẽ tự động điền thông tin."],
      ["3. Tạo hóa đơn và báo giá", "Tạo Invoice hoặc Quote trong Documents; thêm GST, giảm giá, số lượng thập phân và dòng giá âm cho hàng trả lại hoặc tổn thất. Xem trước A4 trước khi tải PDF."],
      ["4. Gửi và theo dõi", "Lưu rồi gửi email hoặc sao chép liên kết bảo mật. Theo dõi các mốc đã gửi, đã xem và đã chấp nhận; chuyển báo giá thành hóa đơn và đánh dấu Paid."],
      ["5. Ghi chi phí", "Ghi nhà cung cấp, loại chi phí, GST, tỷ lệ sử dụng kinh doanh và tài khoản thanh toán. Có thể đính kèm hóa đơn hoặc biên lai PDF/hình ảnh."],
      ["6. Sổ hành trình xe", "Thêm xe và kỳ logbook, sau đó ghi công-tơ-mét, mục đích và tỷ lệ sử dụng kinh doanh cho mỗi chuyến. PaperMint tự tính số km kinh doanh."],
      ["7. Xem và xuất", "Dashboard hiển thị tiền đã nhận, dự kiến và quá hạn. Xuất PDF chuẩn bị BAS và gói ZIP năm tài chính. Đây không phải dịch vụ nộp BAS hay tư vấn chuyên môn."],
      ["8. Gói và dữ liệu", "Gói miễn phí cho phép 5 chứng từ mới mỗi tuần tại Úc và có nhãn PaperMint. Dữ liệu tài khoản được tách biệt và tệp biên lai được lưu riêng tư."]
    ],
    ar: [
      ["1. إعداد النشاط", "احفظ بيانات النشاط وABN وبيانات الاتصال وتعليمات الدفع والشعار، وأضف جهات إصدار متعددة مع إعدادات GST وBAS لكل جهة."],
      ["2. إضافة العملاء", "أنشئ سجلات عملاء قابلة لإعادة الاستخدام مع عنواني الفوترة والشحن ليتم تعبئتها تلقائياً في المستند."],
      ["3. إنشاء الفواتير والعروض", "أنشئ Invoice أو Quote وأضف GST والخصومات والكميات العشرية وبنود السعر السالب للمرتجعات أو الخسائر، ثم عاين A4 ونزّل PDF."],
      ["4. الإرسال والتتبع", "احفظ المستند ثم أرسل بريداً أو انسخ الرابط الآمن. تتبع الإرسال والعرض والقبول، وحوّل العرض إلى فاتورة وحدد الفاتورة كمدفوعة."],
      ["5. تسجيل المصروفات", "سجل المورد والفئة ومعالجة GST ونسبة الاستخدام التجاري وحساب الدفع، وأرفق إيصالاً أو فاتورة بصيغة PDF أو صورة."],
      ["6. سجل المركبة", "أضف المركبة وفترة السجل ثم دوّن العداد والغرض ونسبة الاستخدام التجاري لكل رحلة. يحسب PaperMint كيلومترات العمل."],
      ["7. المراجعة والتصدير", "راجع المبالغ المستلمة والمتوقعة والمتأخرة، وصدّر PDF لإعداد BAS وحزمة السنة المالية. هذه أدوات إعداد وليست إيداعاً أو نصيحة مهنية."],
      ["8. الخطط والبيانات", "تتيح الخطة المجانية 5 مستندات جديدة أسبوعياً في أستراليا مع علامة PaperMint. بيانات الحساب معزولة والمرفقات خاصة."]
    ]
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
              {copy({ en: "A practical guide to invoicing, expenses, BAS preparation and vehicle records.", zh: "Invoice、Expense、BAS 准备及车辆记录的实用指南。", vi: "Hướng dẫn về hóa đơn, chi phí, chuẩn bị BAS và hồ sơ xe.", ar: "دليل عملي للفواتير والمصروفات وإعداد BAS وسجلات المركبات." })}
            </p>
          </div>
          <LanguageSwitch />
        </div>

        <div className="grid gap-6 text-sm leading-7 text-[var(--muted)]">
          {sections.map(([title, body]) => <section key={title}><h2 className="text-lg font-black text-[var(--foreground)]">{title}</h2><p className="mt-1">{body}</p></section>)}
        </div>

        <Link className="btn-primary mt-6" href="/dashboard">
          {copy({ en: "Back to dashboard", zh: "返回工作台", vi: "Quay lại tổng quan", ar: "العودة إلى لوحة التحكم" })}
        </Link>
      </section>
    </main>
  );
}
