export type Language = "en" | "zh" | "vi" | "ar";

export const languageOptions: Array<{ code: Language; label: string; shortLabel: string }> = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "zh", label: "中文", shortLabel: "中文" },
  { code: "vi", label: "Tiếng Việt", shortLabel: "VI" },
  { code: "ar", label: "العربية", shortLabel: "AR" }
];

const en = {
  appTagline: "Australian invoicing without the accounting complexity",
  dashboard: "Dashboard",
  documents: "Documents",
  customers: "Customers",
  settings: "Settings",
  pricing: "Pricing",
  signOut: "Sign out",
  signIn: "Sign in",
  register: "Register",
  email: "Email",
  password: "Password",
  invoice: "Invoice",
  quote: "Quote",
  newInvoice: "New invoice",
  newQuote: "New quote",
  totalInvoices: "Invoices",
  paid: "Paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
  revenueTrend: "Monthly revenue",
  createCustomer: "Create customer",
  save: "Save",
  delete: "Delete",
  duplicate: "Duplicate",
  edit: "Edit",
  preview: "Preview",
  print: "Print",
  downloadPdf: "Download PDF",
  convertToInvoice: "Convert to invoice",
  billTo: "Bill to",
  shipTo: "Ship to",
  copyBillTo: "Copy bill to",
  lineItems: "Line items",
  subtotal: "Subtotal",
  discount: "Discount",
  gst: "GST",
  total: "Total",
  status: "Status",
  dueDate: "Due date",
  issueDate: "Issue date",
  paymentMethods: "Payment methods",
  notes: "Notes",
  companyDefaults: "Company defaults",
  language: "Language",
  logo: "Logo",
  saveDraft: "Save draft",
  autoSaved: "Draft autosaved"
};

export type TranslationKey = keyof typeof en;

export const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  en,
  zh: {
    appTagline: "无需复杂会计知识的澳洲发票工具",
    dashboard: "看板", documents: "单据", customers: "客户", settings: "设置", pricing: "定价",
    signOut: "退出", signIn: "登录", register: "注册", email: "邮箱", password: "密码",
    invoice: "发票", quote: "报价单", newInvoice: "新建发票", newQuote: "新建报价",
    totalInvoices: "发票数", paid: "已付款", unpaid: "未付款", overdue: "逾期", revenueTrend: "月度收入",
    createCustomer: "创建客户", save: "保存", delete: "删除", duplicate: "复制", edit: "编辑",
    preview: "预览", print: "打印", downloadPdf: "下载 PDF", convertToInvoice: "转为发票",
    billTo: "Bill To", shipTo: "Ship To", copyBillTo: "复制 Bill To", lineItems: "项目",
    subtotal: "小计", discount: "折扣", gst: "GST", total: "总计", status: "状态",
    dueDate: "付款期限", issueDate: "开票日期", paymentMethods: "付款方式", notes: "备注",
    companyDefaults: "默认公司资料", language: "语言", logo: "Logo", saveDraft: "保存草稿", autoSaved: "草稿已自动保存"
  },
  vi: {
    appTagline: "Lập hóa đơn Úc mà không cần kế toán phức tạp",
    dashboard: "Tổng quan", documents: "Chứng từ", customers: "Khách hàng", settings: "Cài đặt", pricing: "Bảng giá",
    signOut: "Đăng xuất", signIn: "Đăng nhập", register: "Đăng ký", email: "Email", password: "Mật khẩu",
    invoice: "Hóa đơn", quote: "Báo giá", newInvoice: "Tạo hóa đơn", newQuote: "Tạo báo giá",
    totalInvoices: "Hóa đơn", paid: "Đã thanh toán", unpaid: "Chưa thanh toán", overdue: "Quá hạn", revenueTrend: "Doanh thu theo tháng",
    createCustomer: "Tạo khách hàng", save: "Lưu", delete: "Xóa", duplicate: "Nhân bản", edit: "Sửa",
    preview: "Xem trước", print: "In", downloadPdf: "Tải PDF", convertToInvoice: "Chuyển thành hóa đơn",
    billTo: "Bên mua", shipTo: "Nơi giao", copyBillTo: "Sao chép địa chỉ", lineItems: "Hạng mục",
    subtotal: "Tạm tính", discount: "Giảm giá", gst: "GST", total: "Tổng cộng", status: "Trạng thái",
    dueDate: "Hạn thanh toán", issueDate: "Ngày phát hành", paymentMethods: "Phương thức thanh toán", notes: "Ghi chú",
    companyDefaults: "Thông tin công ty", language: "Ngôn ngữ", logo: "Logo", saveDraft: "Lưu nháp", autoSaved: "Đã tự động lưu"
  },
  ar: {
    appTagline: "فواتير أسترالية بلا تعقيدات محاسبية",
    dashboard: "لوحة التحكم", documents: "المستندات", customers: "العملاء", settings: "الإعدادات", pricing: "الأسعار",
    signOut: "تسجيل الخروج", signIn: "تسجيل الدخول", register: "إنشاء حساب", email: "البريد الإلكتروني", password: "كلمة المرور",
    invoice: "فاتورة", quote: "عرض سعر", newInvoice: "فاتورة جديدة", newQuote: "عرض سعر جديد",
    totalInvoices: "الفواتير", paid: "مدفوع", unpaid: "غير مدفوع", overdue: "متأخر", revenueTrend: "الإيرادات الشهرية",
    createCustomer: "إضافة عميل", save: "حفظ", delete: "حذف", duplicate: "نسخ", edit: "تعديل",
    preview: "معاينة", print: "طباعة", downloadPdf: "تنزيل PDF", convertToInvoice: "تحويل إلى فاتورة",
    billTo: "الفوترة إلى", shipTo: "الشحن إلى", copyBillTo: "نسخ عنوان الفوترة", lineItems: "البنود",
    subtotal: "المجموع الفرعي", discount: "الخصم", gst: "GST", total: "الإجمالي", status: "الحالة",
    dueDate: "تاريخ الاستحقاق", issueDate: "تاريخ الإصدار", paymentMethods: "طرق الدفع", notes: "ملاحظات",
    companyDefaults: "بيانات الشركة", language: "اللغة", logo: "الشعار", saveDraft: "حفظ المسودة", autoSaved: "تم الحفظ تلقائياً"
  }
};

export function pickLanguage<T>(
  language: Language,
  values: { en: T; zh?: T; vi?: T; ar?: T }
): T {
  return values[language] ?? values.en;
}
