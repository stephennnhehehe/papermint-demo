"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  LockKeyhole,
  Play,
  Repeat2,
  ShieldCheck
} from "lucide-react";
import { Brand } from "@/components/app/Brand";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { getSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { configured, startDemo, user } = useAuth();
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const requestedPath = searchParams.get("next");
  const destination =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";

  useEffect(() => {
    if (!configured || user) router.replace(destination);
  }, [configured, destination, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured) {
      setMessage(language === "zh" ? "认证服务尚未配置，请先使用免费演示。" : "Authentication is not configured yet. Try the demo instead.");
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}${destination}` }
            });

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        setMessage(
          language === "zh"
            ? "账号已创建。请打开邮箱中的确认链接完成注册。"
            : "Account created. Open the confirmation link in your inbox to finish signing up."
        );
      } else {
        router.replace(destination);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (!configured) {
      setMessage(language === "zh" ? "Google 登录尚未配置，请先使用免费演示。" : "Google sign-in is not configured yet. Try the demo instead.");
      return;
    }
    setGoogleBusy(true);
    setMessage("");
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${destination}` }
    });
    if (error) {
      setMessage(error.message);
      setGoogleBusy(false);
    }
  }

  function handleDemo() {
    startDemo();
    router.replace(destination);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-4 sm:px-6 sm:py-6">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 py-1">
        <Brand />
        <div className="flex items-center gap-2">
          <Link className="hidden text-sm font-bold text-[var(--muted)] hover:text-[var(--foreground)] sm:block" href="/pricing">
            {language === "zh" ? "定价" : "Pricing"}
          </Link>
          <LanguageSwitch />
        </div>
      </header>

      <div className="mx-auto mt-5 grid max-w-[1440px] overflow-hidden rounded-lg border border-[#d9e0d9] bg-white shadow-[0_28px_90px_rgba(23,33,27,0.10)] lg:min-h-[760px] lg:grid-cols-[minmax(0,1.28fr)_460px]">
        <section className="order-2 relative overflow-hidden bg-[#17211b] p-6 text-white sm:p-10 lg:order-1 lg:p-12">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold text-white/80">
              <ShieldCheck className="h-4 w-4 text-[#78d7ac]" />
              {language === "zh" ? "专为澳大利亚小生意打造" : "Made for Australian small business"}
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.08] tracking-normal sm:text-5xl">
              {language === "zh" ? "把发票做好，不必先学会计。" : "Professional invoicing. No accounting complexity."}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
              {language === "zh"
                ? "Invoice、Quote、客户和澳洲财年报表集中在一个安静好用的工作台。先免费使用，需要更多时再升级。"
                : "Invoices, quotes, customers and Australian financial-year reporting in one calm workspace. Start free and upgrade only when you need more."}
            </p>
          </div>

          <FeatureGrid language={language} />
          <ProductDemo language={language} />
        </section>

        <section className="order-1 flex flex-col justify-center p-6 sm:p-9 lg:order-2 lg:p-10">
          <div className="mx-auto w-full max-w-sm">
            <p className="text-sm font-black text-[var(--mint-dark)]">
              {mode === "signin"
                ? language === "zh" ? "欢迎回来" : "Welcome back"
                : language === "zh" ? "免费开始" : "Start for free"}
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-normal">
              {mode === "signin"
                ? language === "zh" ? "登录 PaperMint" : "Sign in to PaperMint"
                : language === "zh" ? "创建你的工作台" : "Create your workspace"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {language === "zh"
                ? "所有功能均可免费使用，每周可创建 5 份单据。"
                : "All features are free to use, with 5 new documents each week."}
            </p>

            <button className="group mt-5 w-full rounded-lg border border-[#b8dbc9] bg-[#eaf6ef] p-4 text-left hover:border-[var(--mint)] hover:bg-[#e2f2e9]" onClick={handleDemo} type="button">
              <span className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--mint)] text-white"><Play className="h-4 w-4 fill-current" /></span>
                  <span>
                    <span className="block text-sm font-black text-[var(--foreground)]">{language === "zh" ? "立即免费试用 PaperMint" : "Try PaperMint free now"}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-[var(--muted)]">{language === "zh" ? "无需账号，点击即可打开" : "No account needed. Opens instantly."}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
              </span>
            </button>

            <div className="mt-6 grid grid-cols-2 rounded-lg border border-[var(--line)] bg-[#f6f8f5] p-1">
              {(["signin", "signup"] as const).map((item) => (
                <button
                  className={`rounded-md px-3 py-2.5 text-sm font-black ${mode === item ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`}
                  key={item}
                  onClick={() => {
                    setMode(item);
                    setMessage("");
                  }}
                  type="button"
                >
                  {item === "signin" ? t("signIn") : t("register")}
                </button>
              ))}
            </div>

            <button className="btn-secondary mt-4 w-full" disabled={googleBusy} onClick={handleGoogle} type="button">
              {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="grid h-5 w-5 place-items-center rounded-full border border-[var(--line)] text-xs font-black text-[#4285f4]">G</span>}
              {language === "zh" ? "使用 Google（Gmail）继续" : "Continue with Google (Gmail)"}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs font-bold text-[var(--muted)]">
              <span className="h-px flex-1 bg-[var(--line)]" />
              {language === "zh" ? "或使用邮箱" : "or use email"}
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>

            {!configured ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                {language === "zh" ? "认证服务尚未配置，仍可立即打开演示工作台。" : "Authentication is not configured, but the demo workspace is ready."}
              </div>
            ) : null}

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <label>
                <span className="label">{t("email")}</span>
                <input autoComplete="email" className="field" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
              </label>
              <label>
                <span className="flex items-center justify-between gap-3">
                  <span className="label">{t("password")}</span>
                  {mode === "signin" ? (
                    <Link className="mb-1.5 text-xs font-bold text-[var(--mint-dark)] hover:underline" href="/forgot-password">
                      {language === "zh" ? "忘记密码？" : "Forgot password?"}
                    </Link>
                  ) : null}
                </span>
                <span className="relative block">
                  <input
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    className="field pr-11"
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--muted)]" onClick={() => setShowPassword((current) => !current)} title={showPassword ? "Hide password" : "Show password"} type="button">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              {message ? <div className="rounded-lg border border-[var(--line)] bg-[#f8faf7] p-3 text-sm font-semibold leading-6 text-[var(--muted)]">{message}</div> : null}

              <button className="btn-primary min-h-11 w-full" disabled={busy} type="submit">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                {mode === "signin" ? t("signIn") : t("register")}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-[var(--muted)]">
              {language === "zh" ? "继续即表示你同意" : "By continuing, you agree to our"} {" "}
              <Link className="font-bold underline" href="/terms">{language === "zh" ? "服务条款" : "Terms"}</Link>{" "}
              {language === "zh" ? "和" : "and"} {" "}
              <Link className="font-bold underline" href="/privacy">{language === "zh" ? "隐私政策" : "Privacy Policy"}</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureGrid({ language }: { language: "en" | "zh" }) {
  const features = language === "zh"
    ? ["AUD 发票", "ABN 与 GST", "7 月 1 日财年报表", "Quote 转 Invoice", "A4 PDF", "中英文"]
    : ["AUD invoicing", "ABN & GST", "FY reports from 1 July", "Quote to invoice", "A4 PDF", "English & Chinese"];
  return (
    <div className="relative z-10 mt-8 grid max-w-3xl gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {features.map((feature) => (
        <div className="flex items-center gap-2 text-sm font-bold text-white/78" key={feature}>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#78d7ac]/15 text-[#78d7ac]"><Check className="h-3.5 w-3.5" /></span>
          {feature}
        </div>
      ))}
    </div>
  );
}

function ProductDemo({ language }: { language: "en" | "zh" }) {
  const [view, setView] = useState<"invoice" | "report">("invoice");
  return (
    <div className="relative z-10 mt-10 overflow-hidden rounded-lg border border-white/12 bg-[#f6f8f5] text-[#17211b] shadow-[0_28px_70px_rgba(0,0,0,0.25)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe6df] bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d85a61]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f4b860]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2f8c67]" />
        </div>
        <div className="inline-grid grid-cols-2 rounded-md bg-[#eef2ef] p-1 text-xs font-black">
          <button className={`rounded px-3 py-1.5 ${view === "invoice" ? "bg-white shadow-sm" : "text-[#66736b]"}`} onClick={() => setView("invoice")} type="button">Invoice</button>
          <button className={`rounded px-3 py-1.5 ${view === "report" ? "bg-white shadow-sm" : "text-[#66736b]"}`} onClick={() => setView("report")} type="button">FY report</button>
        </div>
      </div>
      <div className="min-h-[292px] p-4 sm:p-5">
        {view === "invoice" ? <InvoiceDemo language={language} /> : <ReportDemo language={language} />}
      </div>
    </div>
  );
}

function InvoiceDemo({ language }: { language: "en" | "zh" }) {
  return (
    <div className="pm-demo-enter grid gap-4 lg:grid-cols-[1fr_180px]">
      <div className="rounded-lg border border-[#dfe6df] bg-white p-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#e7ebe7] pb-4">
          <div><p className="text-[10px] font-black text-[var(--mint-dark)]">TAX INVOICE</p><p className="mt-1 text-xl font-black">#INV20260715001</p></div>
          <span className="rounded-full bg-[#e9f5ef] px-2.5 py-1 text-[10px] font-black text-[var(--mint-dark)]">PAID</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div><p className="font-black text-[#66736b]">FROM</p><p className="mt-1 font-black">Harbour Studio</p><p className="mt-1 text-[#66736b]">ABN 12 345 678 901</p></div>
          <div><p className="font-black text-[#66736b]">BILL TO</p><p className="mt-1 font-black">North & Co.</p><p className="mt-1 text-[#66736b]">Sydney NSW</p></div>
        </div>
        <div className="mt-5 grid gap-2 text-xs">
          <div className="grid grid-cols-[1fr_48px_80px] border-b border-[#e7ebe7] pb-2 font-black text-[#66736b]"><span>DESCRIPTION</span><span>GST</span><span className="text-right">AMOUNT</span></div>
          <div className="grid grid-cols-[1fr_48px_80px] py-1"><span>{language === "zh" ? "品牌设计" : "Brand design"}</span><span>$120</span><span className="text-right font-black">$1,320</span></div>
          <div className="grid grid-cols-[1fr_48px_80px] py-1"><span>{language === "zh" ? "网站开发" : "Web development"}</span><span>$280</span><span className="text-right font-black">$3,080</span></div>
        </div>
      </div>
      <div className="grid content-start gap-3">
        <DemoStat icon={<FileCheck2 className="h-4 w-4" />} label={language === "zh" ? "本周发票" : "Invoices this week"} value="5" />
        <DemoStat icon={<Repeat2 className="h-4 w-4" />} label={language === "zh" ? "报价已转换" : "Quotes converted"} value="3" tone="amber" />
        <DemoStat icon={<BarChart3 className="h-4 w-4" />} label={language === "zh" ? "已收款" : "Paid revenue"} value="$8,420" tone="blue" />
      </div>
    </div>
  );
}

function ReportDemo({ language }: { language: "en" | "zh" }) {
  const values = [32, 48, 39, 64, 53, 78, 70, 88, 74, 92, 82, 100];
  return (
    <div className="pm-demo-enter rounded-lg border border-[#dfe6df] bg-white p-5">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black text-[#66736b]">FY 2026–2027</p><h3 className="mt-1 text-xl font-black">{language === "zh" ? "财年营收" : "Financial year revenue"}</h3></div><span className="rounded-lg bg-[#eef3ff] px-3 py-2 text-sm font-black text-[#4361ee]">$42,680</span></div>
      <div className="mt-7 flex h-36 items-end gap-2 border-b border-l border-[#dfe6df] px-3">
        {values.map((height, index) => <span className="pm-demo-bar flex-1 rounded-t-sm bg-[var(--mint)]" key={index} style={{ height: `${height}%`, animationDelay: `${index * 45}ms` }} />)}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-bold text-[#66736b]"><span>JUL</span><span>OCT</span><span>JAN</span><span>APR</span><span>JUN</span></div>
    </div>
  );
}

function DemoStat({ icon, label, value, tone = "green" }: { icon: React.ReactNode; label: string; value: string; tone?: "green" | "amber" | "blue" }) {
  const toneClass = tone === "amber" ? "bg-[#fff6e8] text-[#9a5b00]" : tone === "blue" ? "bg-[#eef3ff] text-[#4361ee]" : "bg-[#e9f5ef] text-[var(--mint-dark)]";
  return <div className="rounded-lg border border-[#dfe6df] bg-white p-3"><span className={`grid h-8 w-8 place-items-center rounded-md ${toneClass}`}>{icon}</span><p className="mt-3 text-[10px] font-bold text-[#66736b]">{label}</p><p className="mt-0.5 text-lg font-black">{value}</p></div>;
}
