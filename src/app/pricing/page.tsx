"use client";

import { Suspense, useState } from "react";
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
import type { PaidPlan } from "@/lib/billing";

export default function PricingPage() {
  return <Suspense><PricingContent /></Suspense>;
}

function PricingContent() {
  const router = useRouter();
  const { user, demo, loading: authLoading, signOut } = useAuth();
  const { billing } = useBilling();
  const { language } = useLanguage();
  const [busyPlan, setBusyPlan] = useState<PaidPlan | "portal" | null>(null);
  const [message, setMessage] = useState("");

  async function choosePlan(plan: PaidPlan) {
    setMessage("");
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

  const page = (
    <div className="mx-auto w-full max-w-6xl">
      <section className="px-1 py-7 text-center sm:py-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#b8dbc9] bg-[#eaf6ef] px-3 py-1.5 text-xs font-black text-[var(--mint-dark)]"><Sparkles className="h-4 w-4" />{language === "zh" ? "从免费开始，随时取消" : "Start free. Cancel anytime."}</div>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight tracking-normal sm:text-5xl">{language === "zh" ? "简单到不需要计算的定价" : "Pricing that stays out of your way"}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">{language === "zh" ? "免费用户可使用 PaperMint 全部功能。业务变忙时，升级即可无限创建并移除品牌页脚。" : "Use every PaperMint feature for free. When work gets busy, upgrade for unlimited documents and no PaperMint footer."}</p>
      </section>

      {message ? <div className="mx-auto mb-5 max-w-2xl rounded-lg border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-900">{message}</div> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <PriceCard
          buttonLabel={language === "zh" ? "当前免费方案" : "Current free plan"}
          description={language === "zh" ? "适合刚开始开票或偶尔接单。" : "For getting started or occasional client work."}
          disabled
          features={language === "zh" ? ["全部产品功能", "每周 5 份 Invoice 或 Quote", "PDF、FY 报表和客户管理", "含小型 PaperMint 页脚"] : ["Every product feature", "5 invoices or quotes each week", "PDF, FY reports and customer management", "Small PaperMint footer included"]}
          price="$0"
          title={language === "zh" ? "免费" : "Free"}
        />
        <PriceCard
          buttonLabel={language === "zh" ? "选择周付" : "Choose weekly"}
          busy={busyPlan === "weekly"}
          description={language === "zh" ? "短期项目或先小步体验。" : "A small commitment for short projects."}
          features={language === "zh" ? ["不限单据数量", "移除 PaperMint 页脚", "包含全部现有及新增功能", "Stripe 安全结账"] : ["Unlimited documents", "Remove PaperMint footer", "All current and new features", "Secure Stripe checkout"]}
          interval={language === "zh" ? "/ 周，AUD" : "/ week, AUD"}
          onClick={() => choosePlan("weekly")}
          price="$0.99"
          title={language === "zh" ? "灵活周付" : "Flexible weekly"}
        />
        <PriceCard
          badge={language === "zh" ? "最划算" : "BEST VALUE"}
          buttonLabel={language === "zh" ? "选择月付" : "Choose monthly"}
          busy={busyPlan === "monthly"}
          description={language === "zh" ? "稳定使用，约每周只需 $0.69。" : "For regular use, about $0.69 per week."}
          emphasized
          features={language === "zh" ? ["不限单据数量", "移除 PaperMint 页脚", "包含全部现有及新增功能", "随时通过账单门户取消"] : ["Unlimited documents", "Remove PaperMint footer", "All current and new features", "Cancel in the billing portal anytime"]}
          interval={language === "zh" ? "/ 月，AUD" : "/ month, AUD"}
          onClick={() => choosePlan("monthly")}
          price="$2.99"
          title={language === "zh" ? "轻松月付" : "Easy monthly"}
        />
      </section>

      {billing.isPaid && !demo ? (
        <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white p-5 sm:flex-row">
          <div><p className="font-black">{language === "zh" ? "你的 PaperMint 订阅已启用" : "Your PaperMint subscription is active"}</p><p className="mt-1 text-sm text-[var(--muted)]">{language === "zh" ? "可在 Stripe 门户更新付款方式、更换或取消方案。" : "Update payment details, switch or cancel through the Stripe portal."}</p></div>
          <button className="btn-secondary shrink-0" disabled={busyPlan === "portal"} onClick={manageBilling} type="button">{busyPlan === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{language === "zh" ? "管理账单" : "Manage billing"}</button>
        </div>
      ) : null}

      <section className="mx-auto mt-9 max-w-3xl border-t border-[var(--line)] py-8 text-center text-sm leading-6 text-[var(--muted)]">
        <p className="font-bold text-[var(--foreground)]">{language === "zh" ? "不会突然锁住你的数据，也没有复杂的会计套餐。" : "No surprise data lock-in and no complicated accounting tiers."}</p>
        <p className="mt-2">{language === "zh" ? "价格以澳元结算。付款由 Stripe 安全处理，PaperMint 不接触你的银行卡资料。" : "Prices are charged in AUD. Payments are securely handled by Stripe; PaperMint never receives your card details."}</p>
      </section>
    </div>
  );

  if (authLoading) return <main className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--mint)]" /></main>;
  if (user) return <AppShell>{page}</AppShell>;
  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 sm:px-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4"><Link href="/login"><Brand /></Link><div className="flex items-center gap-2"><Link className="btn-secondary" href="/login">{language === "zh" ? "登录" : "Sign in"}</Link><LanguageSwitch /></div></header>
      {page}
    </main>
  );
}

function PriceCard({ title, description, price, interval, features, buttonLabel, onClick, badge, emphasized = false, disabled = false, busy = false }: { title: string; description: string; price: string; interval?: string; features: string[]; buttonLabel: string; onClick?: () => void; badge?: string; emphasized?: boolean; disabled?: boolean; busy?: boolean }) {
  return (
    <article className={`relative flex min-h-[480px] flex-col rounded-lg border bg-white p-6 ${emphasized ? "border-[var(--mint)] shadow-[0_20px_60px_rgba(47,140,103,0.14)]" : "border-[var(--line)]"}`}>
      {badge ? <span className="absolute right-4 top-4 rounded-full bg-[var(--foreground)] px-2.5 py-1 text-[10px] font-black text-white">{badge}</span> : null}
      <h2 className="text-xl font-black tracking-normal">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-6 flex items-end gap-2"><span className="text-4xl font-black tracking-normal">{price}</span>{interval ? <span className="pb-1 text-sm font-bold text-[var(--muted)]">{interval}</span> : null}</div>
      <div className="my-6 h-px bg-[var(--line)]" />
      <ul className="grid gap-3">
        {features.map((feature) => <li className="flex items-start gap-2 text-sm font-semibold" key={feature}><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eaf6ef] text-[var(--mint-dark)]"><Check className="h-3.5 w-3.5" /></span>{feature}</li>)}
      </ul>
      <button className={emphasized ? "btn-primary mt-auto w-full" : "btn-secondary mt-auto w-full"} disabled={disabled || busy} onClick={onClick} type="button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{buttonLabel}</button>
    </article>
  );
}
