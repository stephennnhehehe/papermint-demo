"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Brand } from "@/components/app/Brand";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";
import { useAuth } from "@/components/app/AuthProvider";
import { useBilling } from "@/components/app/BillingProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { openStripePortal, startStripeCheckout } from "@/lib/billing-client";
import { isCurrentBillingPlan, type PaidPlan } from "@/lib/billing";
import { pickLanguage } from "@/lib/i18n";

export default function PricingPage() {
  return <Suspense><PricingContent /></Suspense>;
}

function PricingContent() {
  const router = useRouter();
  const { user, demo, loading: authLoading, signOut } = useAuth();
  const { billing, loading: billingLoading, refreshBilling } = useBilling();
  const { language } = useLanguage();
  const [busyPlan, setBusyPlan] = useState<PaidPlan | "portal" | null>(null);
  const [message, setMessage] = useState("");
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  async function choosePlan(plan: PaidPlan) {
    setMessage("");
    if (billing.isPaid) {
      await manageBilling();
      return;
    }
    if (demo) {
      await signOut();
      router.push(`/login?mode=signup&next=/pricing&plan=${plan}`);
      return;
    }
    if (!user) {
      router.push(`/login?mode=signup&next=/pricing&plan=${plan}`);
      return;
    }
    setBusyPlan(plan);
    try {
      await startStripeCheckout(plan);
    } catch (error) {
      const issue = error as Error & { manage?: boolean };
      if (issue.manage) {
        await manageBilling();
        return;
      }
      setMessage(issue.message);
      setBusyPlan(null);
    }
  }

  async function manageBilling() {
    if (!user || demo) return;
    setMessage("");
    setBusyPlan("portal");
    try {
      await openStripePortal();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open billing.");
      setBusyPlan(null);
    }
  }

  const freeCurrent = !billingLoading && isCurrentBillingPlan(billing, "free");
  const weeklyCurrent = !billingLoading && isCurrentBillingPlan(billing, "weekly");
  const monthlyCurrent = !billingLoading && isCurrentBillingPlan(billing, "monthly");
  const currentLabel = copy({ en: "Current plan", zh: "当前方案", vi: "Gói hiện tại", ar: "الخطة الحالية" });
  const manageLabel = copy({ en: "Manage plan", zh: "管理方案", vi: "Quản lý gói", ar: "إدارة الخطة" });

  const page = (
    <div className="mx-auto w-full max-w-6xl">
      <section className="px-1 py-7 text-center sm:py-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#b8dbc9] bg-[#eaf6ef] px-3 py-1.5 text-xs font-black text-[var(--mint-dark)]">
          <Sparkles className="h-4 w-4" />
          {copy({ en: "Start free. Cancel anytime.", zh: "从免费开始，随时取消", vi: "Bắt đầu miễn phí. Hủy bất cứ lúc nào.", ar: "ابدأ مجاناً وألغِ في أي وقت." })}
        </div>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight tracking-normal sm:text-5xl">
          {copy({ en: "Pricing that stays out of your way", zh: "简单到不需要计算的定价", vi: "Mức giá đơn giản, dễ bắt đầu", ar: "أسعار بسيطة بلا تعقيد" })}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          {copy({ en: "Use every PaperMint feature for free. Upgrade for unlimited documents and no PaperMint footer.", zh: "免费用户可使用全部功能。升级即可无限创建并移除品牌页脚。", vi: "Dùng miễn phí mọi tính năng. Nâng cấp để tạo không giới hạn và xóa chân trang PaperMint.", ar: "استخدم جميع الميزات مجاناً، ثم قم بالترقية لمستندات غير محدودة وإزالة تذييل PaperMint." })}
        </p>
      </section>

      {message ? <div className="mx-auto mb-5 max-w-2xl rounded-lg border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-900">{message}</div> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <PriceCard
          buttonLabel={freeCurrent ? currentLabel : billing.isPaid ? manageLabel : copy({ en: "Free plan", zh: "免费方案", vi: "Gói miễn phí", ar: "الخطة المجانية" })}
          current={freeCurrent}
          currentBadge={currentLabel}
          description={copy({ en: "For getting started or occasional client work.", zh: "适合刚开始开票或偶尔接单。", vi: "Phù hợp để bắt đầu hoặc làm việc không thường xuyên.", ar: "مناسب للبدء أو للعمل المتقطع." })}
          disabled={freeCurrent}
          features={copy({
            en: ["Every product feature", "5 invoices or quotes each week", "PDF, FY reports and customer management", "Small PaperMint footer included"],
            zh: ["全部产品功能", "每周 5 份 Invoice 或 Quote", "PDF、FY 报表和客户管理", "含小型 PaperMint 页脚"],
            vi: ["Mọi tính năng", "5 hóa đơn hoặc báo giá mỗi tuần", "PDF, báo cáo năm tài chính và khách hàng", "Có chân trang PaperMint nhỏ"],
            ar: ["جميع الميزات", "5 فواتير أو عروض أسعار أسبوعياً", "PDF وتقارير السنة المالية وإدارة العملاء", "يتضمن تذييل PaperMint صغيراً"]
          })}
          onClick={billing.isPaid ? manageBilling : undefined}
          price="$0"
          title={copy({ en: "Free", zh: "免费", vi: "Miễn phí", ar: "مجاني" })}
        />
        <PriceCard
          buttonLabel={weeklyCurrent ? currentLabel : billing.isPaid ? manageLabel : copy({ en: "Choose weekly", zh: "选择周付", vi: "Chọn theo tuần", ar: "اختر الأسبوعي" })}
          busy={busyPlan === "weekly" || (busyPlan === "portal" && billing.plan === "weekly")}
          current={weeklyCurrent}
          currentBadge={currentLabel}
          description={copy({ en: "A small commitment for short projects.", zh: "短期项目或先小步体验。", vi: "Linh hoạt cho dự án ngắn hạn.", ar: "التزام بسيط للمشاريع القصيرة." })}
          disabled={weeklyCurrent}
          features={copy({ en: ["Unlimited documents", "Remove PaperMint footer", "All current and new features", "Secure Stripe checkout"], zh: ["不限单据数量", "移除 PaperMint 页脚", "包含全部现有及新增功能", "Stripe 安全结账"], vi: ["Chứng từ không giới hạn", "Xóa chân trang PaperMint", "Mọi tính năng hiện tại và mới", "Thanh toán Stripe an toàn"], ar: ["مستندات غير محدودة", "إزالة تذييل PaperMint", "جميع الميزات الحالية والجديدة", "دفع آمن عبر Stripe"] })}
          interval={copy({ en: "/ week, AUD", zh: "/ 周，AUD", vi: "/ tuần, AUD", ar: "/ أسبوع، AUD" })}
          onClick={() => choosePlan("weekly")}
          price="$0.99"
          title={copy({ en: "Flexible weekly", zh: "灵活周付", vi: "Linh hoạt theo tuần", ar: "أسبوعي مرن" })}
        />
        <PriceCard
          badge={copy({ en: "BEST VALUE", zh: "最划算", vi: "GIÁ TỐT NHẤT", ar: "أفضل قيمة" })}
          buttonLabel={monthlyCurrent ? currentLabel : billing.isPaid ? manageLabel : copy({ en: "Choose monthly", zh: "选择月付", vi: "Chọn theo tháng", ar: "اختر الشهري" })}
          busy={busyPlan === "monthly" || (busyPlan === "portal" && billing.plan === "monthly")}
          current={monthlyCurrent}
          currentBadge={currentLabel}
          description={copy({ en: "For regular use, about $0.69 per week.", zh: "稳定使用，约每周只需 $0.69。", vi: "Dùng thường xuyên, khoảng $0.69 mỗi tuần.", ar: "للاستخدام المنتظم، حوالي 0.69$ أسبوعياً." })}
          disabled={monthlyCurrent}
          emphasized
          features={copy({ en: ["Unlimited documents", "Remove PaperMint footer", "All current and new features", "Cancel in the billing portal anytime"], zh: ["不限单据数量", "移除 PaperMint 页脚", "包含全部现有及新增功能", "随时通过账单门户取消"], vi: ["Chứng từ không giới hạn", "Xóa chân trang PaperMint", "Mọi tính năng hiện tại và mới", "Hủy bất cứ lúc nào trong cổng thanh toán"], ar: ["مستندات غير محدودة", "إزالة تذييل PaperMint", "جميع الميزات الحالية والجديدة", "الإلغاء في أي وقت من بوابة الفوترة"] })}
          interval={copy({ en: "/ month, AUD", zh: "/ 月，AUD", vi: "/ tháng, AUD", ar: "/ شهر، AUD" })}
          onClick={() => choosePlan("monthly")}
          price="$2.99"
          title={copy({ en: "Easy monthly", zh: "轻松月付", vi: "Dễ dàng theo tháng", ar: "شهري سهل" })}
        />
      </section>

      {billing.isPaid && !demo ? (
        <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5 sm:flex-row">
          <div>
            <p className="font-black">{copy({ en: `Your ${billing.plan} plan is active`, zh: `你的${billing.plan === "weekly" ? "周付" : "月付"}方案已启用`, vi: `Gói ${billing.plan === "weekly" ? "tuần" : "tháng"} đang hoạt động`, ar: `خطتك ${billing.plan === "weekly" ? "الأسبوعية" : "الشهرية"} نشطة` })}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{copy({ en: "Unlimited documents are enabled and PaperMint branding is removed from exports.", zh: "已启用不限量单据，导出文件不再显示 PaperMint 页脚。", vi: "Đã bật chứng từ không giới hạn và xóa thương hiệu PaperMint khỏi bản xuất.", ar: "تم تفعيل المستندات غير المحدودة وإزالة علامة PaperMint من الملفات المصدرة." })}</p>
          </div>
          <button className="btn-secondary shrink-0 bg-white" disabled={busyPlan === "portal"} onClick={manageBilling} type="button">
            {busyPlan === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {manageLabel}
          </button>
        </div>
      ) : null}

      <section className="mx-auto mt-9 max-w-3xl border-t border-[var(--line)] py-8 text-center text-sm leading-6 text-[var(--muted)]">
        <p className="font-bold text-[var(--foreground)]">{copy({ en: "No surprise data lock-in and no complicated accounting tiers.", zh: "不会突然锁住你的数据，也没有复杂的会计套餐。", vi: "Không khóa dữ liệu bất ngờ và không có gói kế toán phức tạp.", ar: "لا قفل مفاجئ للبيانات ولا باقات محاسبية معقدة." })}</p>
        <p className="mt-2">{copy({ en: "Prices are charged in AUD. Payments are securely handled by Stripe.", zh: "价格以澳元结算，付款由 Stripe 安全处理。", vi: "Giá được tính bằng AUD. Thanh toán được Stripe xử lý an toàn.", ar: "تُحصّل الأسعار بالدولار الأسترالي وتتم معالجة الدفع بأمان عبر Stripe." })}</p>
      </section>
    </div>
  );

  if (authLoading) return <main className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--mint)]" /></main>;
  if (user) return <AppShell>{page}</AppShell>;
  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 sm:px-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4"><Link href="/login"><Brand /></Link><div className="flex items-center gap-2"><Link className="btn-secondary" href="/login">{copy({ en: "Sign in", zh: "登录", vi: "Đăng nhập", ar: "تسجيل الدخول" })}</Link><LanguageSwitch /></div></header>
      {page}
    </main>
  );
}

function PriceCard({ title, description, price, interval, features, buttonLabel, onClick, badge, currentBadge = "Current plan", emphasized = false, disabled = false, busy = false, current = false }: { title: string; description: string; price: string; interval?: string; features: string[]; buttonLabel: string; onClick?: () => void; badge?: string; currentBadge?: string; emphasized?: boolean; disabled?: boolean; busy?: boolean; current?: boolean }) {
  return (
    <article className={`relative flex min-h-[480px] flex-col rounded-lg border bg-white p-6 ${current ? "border-emerald-400 ring-2 ring-emerald-100" : emphasized ? "border-[var(--mint)] shadow-[0_20px_60px_rgba(47,140,103,0.14)]" : "border-[var(--line)]"}`}>
      {badge && !current ? <span className="absolute right-4 top-4 rounded-full bg-[var(--foreground)] px-2.5 py-1 text-[10px] font-black text-white">{badge}</span> : null}
      {current ? <span className="absolute right-4 top-4 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800">{currentBadge}</span> : null}
      <h2 className="text-xl font-black tracking-normal">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-6 flex items-end gap-2"><span className="text-4xl font-black tracking-normal">{price}</span>{interval ? <span className="pb-1 text-sm font-bold text-[var(--muted)]">{interval}</span> : null}</div>
      <div className="my-6 h-px bg-[var(--line)]" />
      <ul className="grid gap-3">
        {features.map((feature) => <li className="flex items-start gap-2 text-sm font-semibold" key={feature}><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eaf6ef] text-[var(--mint-dark)]"><Check className="h-3.5 w-3.5" /></span>{feature}</li>)}
      </ul>
      <button className={emphasized && !current ? "btn-primary mt-auto w-full" : "btn-secondary mt-auto w-full"} disabled={disabled || busy} onClick={onClick} type="button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : current ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}{buttonLabel}</button>
    </article>
  );
}
