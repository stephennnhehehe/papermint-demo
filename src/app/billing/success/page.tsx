"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useBilling } from "@/components/app/BillingProvider";
import { useLanguage } from "@/components/app/LanguageProvider";

export default function BillingSuccessPage() {
  const { billing, refreshBilling } = useBilling();
  const { language } = useLanguage();

  useEffect(() => {
    void refreshBilling();
    const interval = window.setInterval(() => void refreshBilling(), 1800);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 12000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [refreshBilling]);

  return (
    <ProtectedRoute>
      <AppShell>
        <section className="mx-auto my-12 max-w-xl rounded-lg border border-[var(--line)] bg-white p-8 text-center shadow-[0_24px_70px_rgba(23,33,27,0.09)]">
          {billing.isPaid ? <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--mint)]" /> : <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--mint)]" />}
          <h1 className="mt-5 text-3xl font-black tracking-normal">{billing.isPaid ? (language === "zh" ? "订阅已启用" : "Subscription active") : (language === "zh" ? "正在确认付款" : "Confirming your payment")}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{billing.isPaid ? (language === "zh" ? "你现在可以无限创建 Invoice 和 Quote，导出的文件也不再显示 PaperMint 页脚。" : "You can now create unlimited invoices and quotes, with PaperMint branding removed from exports.") : (language === "zh" ? "Stripe 正在安全确认付款状态，通常只需要几秒。" : "Stripe is securely confirming your payment. This usually takes only a few seconds.")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2"><Link className="btn-primary" href="/dashboard">{language === "zh" ? "返回工作台" : "Open dashboard"}</Link><Link className="btn-secondary" href="/pricing">{language === "zh" ? "查看方案" : "View plan"}</Link></div>
        </section>
      </AppShell>
    </ProtectedRoute>
  );
}
