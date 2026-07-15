"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useBilling } from "@/components/app/BillingProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { syncStripeCheckout } from "@/lib/billing-client";
import { pickLanguage } from "@/lib/i18n";

export default function BillingSuccessPage() {
  const { billing, refreshBilling } = useBilling();
  const { language } = useLanguage();

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    const confirm = async () => {
      if (sessionId) await syncStripeCheckout(sessionId).catch(() => undefined);
      await refreshBilling();
      window.dispatchEvent(new Event("papermint:billing-changed"));
    };
    void confirm();
    const interval = window.setInterval(() => void refreshBilling(), 1800);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 12000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [refreshBilling]);

  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);

  return (
    <ProtectedRoute>
      <AppShell>
        <section className="mx-auto my-12 max-w-xl rounded-lg border border-[var(--line)] bg-white p-8 text-center shadow-[0_24px_70px_rgba(23,33,27,0.09)]">
          {billing.isPaid ? <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--mint)]" /> : <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--mint)]" />}
          <h1 className="mt-5 text-3xl font-black tracking-normal">{billing.isPaid ? copy({ en: "Subscription active", zh: "订阅已启用", vi: "Gói đăng ký đã hoạt động", ar: "الاشتراك نشط" }) : copy({ en: "Confirming your payment", zh: "正在确认付款", vi: "Đang xác nhận thanh toán", ar: "جارٍ تأكيد الدفع" })}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{billing.isPaid ? copy({ en: "Unlimited invoices and quotes are now enabled, with PaperMint branding removed from exports.", zh: "现在可以无限创建 Invoice 和 Quote，导出文件也不再显示 PaperMint 页脚。", vi: "Bạn có thể tạo hóa đơn và báo giá không giới hạn, không còn chân trang PaperMint.", ar: "يمكنك الآن إنشاء فواتير وعروض أسعار بلا حدود مع إزالة تذييل PaperMint." }) : copy({ en: "Stripe is securely confirming your payment. This usually takes only a few seconds.", zh: "Stripe 正在安全确认付款状态，通常只需要几秒。", vi: "Stripe đang xác nhận thanh toán an toàn. Quá trình thường chỉ mất vài giây.", ar: "يؤكد Stripe عملية الدفع بأمان، وعادة يستغرق ذلك بضع ثوانٍ." })}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2"><Link className="btn-primary" href="/dashboard">{copy({ en: "Open dashboard", zh: "返回工作台", vi: "Mở tổng quan", ar: "فتح لوحة التحكم" })}</Link><Link className="btn-secondary" href="/pricing">{copy({ en: "View plan", zh: "查看方案", vi: "Xem gói", ar: "عرض الخطة" })}</Link></div>
        </section>
      </AppShell>
    </ProtectedRoute>
  );
}
