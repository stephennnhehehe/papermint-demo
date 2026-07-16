"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  MousePointer2,
  Play,
  ReceiptText,
  ShieldCheck
} from "lucide-react";
import { Brand } from "@/components/app/Brand";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { getSupabaseClient } from "@/lib/supabase";
import { authEmailForSignIn } from "@/lib/auth-identifier";
import { pickLanguage, type Language } from "@/lib/i18n";

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
  const { completeSignIn, configured, startDemo, user } = useAuth();
  const { t, language } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
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
      setMessage(copy({ en: "Authentication is not configured yet. Try the demo instead.", zh: "认证服务尚未配置，请先使用免费演示。", vi: "Dịch vụ đăng nhập chưa được cấu hình. Hãy thử bản demo.", ar: "لم تتم تهيئة خدمة المصادقة بعد. جرّب العرض التجريبي." }));
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email: authEmailForSignIn(email), password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}${destination}` }
            });

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        setMessage(
          copy({ en: "Account created. Open the confirmation link in your inbox to finish signing up.", zh: "账号已创建。请打开邮箱中的确认链接完成注册。", vi: "Tài khoản đã được tạo. Hãy mở liên kết xác nhận trong email.", ar: "تم إنشاء الحساب. افتح رابط التأكيد في بريدك لإكمال التسجيل." })
        );
      } else {
        if (result.data.user) completeSignIn(result.data.user);
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
      setMessage(copy({ en: "Google sign-in is not configured yet. Try the demo instead.", zh: "Google 登录尚未配置，请先使用免费演示。", vi: "Đăng nhập Google chưa được cấu hình. Hãy thử bản demo.", ar: "لم تتم تهيئة تسجيل الدخول عبر Google. جرّب العرض التجريبي." }));
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
            {t("pricing")}
          </Link>
          <LanguageSwitch />
        </div>
      </header>

      <div className="mx-auto mt-5 grid max-w-[1440px] overflow-hidden rounded-lg border border-[#d9e0d9] bg-white shadow-[0_28px_90px_rgba(23,33,27,0.10)] lg:min-h-[760px] lg:grid-cols-[minmax(0,1.28fr)_460px]">
        <section className="order-2 relative overflow-hidden bg-[#17211b] p-6 text-white sm:p-10 lg:order-1 lg:p-12">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold text-white/80">
              <ShieldCheck className="h-4 w-4 text-[#78d7ac]" />
              {copy({ en: "Made for Australian small business", zh: "专为澳大利亚小生意打造", vi: "Dành cho doanh nghiệp nhỏ tại Úc", ar: "مصمم للشركات الأسترالية الصغيرة" })}
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[1.08] tracking-normal sm:text-5xl">
              {copy({ en: "Professional invoicing. No accounting complexity.", zh: "把发票做好，不必先学会计。", vi: "Hóa đơn chuyên nghiệp, không cần kế toán phức tạp.", ar: "فواتير احترافية بلا تعقيدات محاسبية." })}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
              {copy({ en: "Invoices, quotes, customers and Australian financial-year reporting in one calm, multilingual workspace.", zh: "Invoice、Quote、客户和澳洲财年报表集中在一个简洁的多语言工作台。", vi: "Hóa đơn, báo giá, khách hàng và báo cáo năm tài chính Úc trong một không gian đa ngôn ngữ.", ar: "الفواتير وعروض الأسعار والعملاء وتقارير السنة المالية الأسترالية في مساحة عمل متعددة اللغات." })}
            </p>
          </div>

          <FeatureGrid language={language} />
          <ProductDemo language={language} />
        </section>

        <section className="order-1 flex flex-col justify-center p-6 sm:p-9 lg:order-2 lg:p-10">
          <div className="mx-auto w-full max-w-sm">
            <p className="text-sm font-black text-[var(--mint-dark)]">
              {mode === "signin"
                ? copy({ en: "Welcome back", zh: "欢迎回来", vi: "Chào mừng trở lại", ar: "مرحباً بعودتك" })
                : copy({ en: "Start for free", zh: "免费开始", vi: "Bắt đầu miễn phí", ar: "ابدأ مجاناً" })}
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-normal">
              {mode === "signin"
                ? copy({ en: "Sign in to PaperMint", zh: "登录 PaperMint", vi: "Đăng nhập PaperMint", ar: "تسجيل الدخول إلى PaperMint" })
                : copy({ en: "Create your workspace", zh: "创建你的工作台", vi: "Tạo không gian làm việc", ar: "أنشئ مساحة عملك" })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {copy({ en: "All features are free, with 5 new documents each week.", zh: "所有功能均可免费使用，每周可创建 5 份单据。", vi: "Mọi tính năng đều miễn phí, với 5 chứng từ mới mỗi tuần.", ar: "جميع الميزات مجانية مع 5 مستندات جديدة كل أسبوع." })}
            </p>

            <button className="group mt-5 w-full rounded-lg border border-[#b8dbc9] bg-[#eaf6ef] p-4 text-left hover:border-[var(--mint)] hover:bg-[#e2f2e9]" onClick={handleDemo} type="button">
              <span className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--mint)] text-white"><Play className="h-4 w-4 fill-current" /></span>
                  <span>
                    <span className="block text-sm font-black text-[var(--foreground)]">{copy({ en: "Try PaperMint free now", zh: "立即免费试用 PaperMint", vi: "Dùng thử PaperMint miễn phí", ar: "جرّب PaperMint مجاناً الآن" })}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-[var(--muted)]">{copy({ en: "No account needed. Opens instantly.", zh: "无需账号，点击即可打开", vi: "Không cần tài khoản. Mở ngay lập tức.", ar: "لا حاجة إلى حساب. يفتح فوراً." })}</span>
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
              {copy({ en: "Continue with Google (Gmail)", zh: "使用 Google（Gmail）继续", vi: "Tiếp tục với Google (Gmail)", ar: "المتابعة باستخدام Google (Gmail)" })}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs font-bold text-[var(--muted)]">
              <span className="h-px flex-1 bg-[var(--line)]" />
              {copy({ en: "or use email", zh: "或使用邮箱", vi: "hoặc dùng email", ar: "أو استخدم البريد الإلكتروني" })}
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>

            {!configured ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                {copy({ en: "Authentication is not configured, but the demo workspace is ready.", zh: "认证服务尚未配置，仍可立即打开演示工作台。", vi: "Dịch vụ đăng nhập chưa được cấu hình, nhưng bản demo đã sẵn sàng.", ar: "لم تتم تهيئة المصادقة، لكن مساحة العرض التجريبي جاهزة." })}
              </div>
            ) : null}

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <label>
                <span className="label">{mode === "signin" ? copy({ en: "Email or test account", zh: "邮箱或测试账号", vi: "Email hoặc tài khoản thử", ar: "البريد أو حساب الاختبار" }) : t("email")}</span>
                <input autoComplete={mode === "signin" ? "username" : "email"} className="field" onChange={(event) => setEmail(event.target.value)} placeholder={mode === "signin" ? "you@example.com / test-01" : "you@example.com"} required type={mode === "signin" ? "text" : "email"} value={email} />
              </label>
              <label>
                <span className="flex items-center justify-between gap-3">
                  <span className="label">{t("password")}</span>
                  {mode === "signin" ? (
                    <Link className="mb-1.5 text-xs font-bold text-[var(--mint-dark)] hover:underline" href="/forgot-password">
                      {copy({ en: "Forgot password?", zh: "忘记密码？", vi: "Quên mật khẩu?", ar: "نسيت كلمة المرور؟" })}
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
              {copy({ en: "By continuing, you agree to our", zh: "继续即表示你同意", vi: "Bằng việc tiếp tục, bạn đồng ý với", ar: "بالمتابعة فإنك توافق على" })} {" "}
              <Link className="font-bold underline" href="/terms">{copy({ en: "Terms", zh: "服务条款", vi: "Điều khoản", ar: "الشروط" })}</Link>{" "}
              {copy({ en: "and", zh: "和", vi: "và", ar: "و" })} {" "}
              <Link className="font-bold underline" href="/privacy">{copy({ en: "Privacy Policy", zh: "隐私政策", vi: "Chính sách bảo mật", ar: "سياسة الخصوصية" })}</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureGrid({ language }: { language: Language }) {
  const features = pickLanguage(language, {
    en: ["AUD invoicing", "ABN & GST", "FY reports from 1 July", "Quote to invoice", "A4 PDF", "Multilingual workspace"],
    zh: ["AUD 发票", "ABN 与 GST", "7 月 1 日财年报表", "Quote 转 Invoice", "A4 PDF", "多语言工作台"],
    vi: ["Hóa đơn AUD", "ABN & GST", "Năm tài chính từ 1/7", "Báo giá thành hóa đơn", "PDF A4", "Không gian đa ngôn ngữ"],
    ar: ["فواتير AUD", "ABN وGST", "السنة المالية من 1 يوليو", "تحويل العرض إلى فاتورة", "PDF بحجم A4", "مساحة عمل متعددة اللغات"]
  });
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

function ProductDemo({ language }: { language: Language }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const labels = pickLanguage(language, {
    en: ["Choose a customer", "Add line items", "Preview the invoice", "Track paid revenue"],
    zh: ["选择客户", "添加项目", "预览发票", "追踪已付款收入"],
    vi: ["Chọn khách hàng", "Thêm hạng mục", "Xem trước hóa đơn", "Theo dõi doanh thu"],
    ar: ["اختر عميلاً", "أضف البنود", "عاين الفاتورة", "تابع الإيرادات المدفوعة"]
  });

  useEffect(() => {
    if (paused) return;
    const interval = window.setInterval(() => setStep((current) => (current + 1) % 4), 3200);
    return () => window.clearInterval(interval);
  }, [paused]);

  return (
    <div className="relative z-10 mt-10 overflow-hidden rounded-lg border border-white/12 bg-[#f6f8f5] text-[#17211b] shadow-[0_28px_70px_rgba(0,0,0,0.25)]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex items-center justify-between gap-3 border-b border-[#dfe6df] bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-black"><span className="grid h-7 w-7 place-items-center rounded-md bg-[#17211b] text-white"><ReceiptText className="h-3.5 w-3.5" /></span>PaperMint</div>
        <div className="flex items-center gap-2 text-[10px] font-black text-[#66736b]">
          <span className="h-2 w-2 rounded-full bg-[#2f8c67]" /> LIVE PRODUCT DEMO
        </div>
      </div>
      <div className="relative min-h-[355px] overflow-hidden p-3 sm:p-4">
        {step === 3 ? <DemoDashboard /> : <DemoEditor step={step} />}
      </div>
      <div className="border-t border-[#dfe6df] bg-white p-3">
        <div className="grid grid-cols-4 gap-1.5">
          {labels.map((label, index) => (
            <button className={`relative min-w-0 rounded-md px-2 py-2 text-left text-[10px] font-black ${step === index ? "bg-[#e9f5ef] text-[var(--mint-dark)]" : "text-[#66736b] hover:bg-[#f4f7f4]"}`} key={label} onClick={() => setStep(index)} type="button">
              <span className="block truncate">{index + 1}. {label}</span>
              {step === index && !paused ? <span className="pm-demo-progress absolute inset-x-1.5 bottom-0 h-0.5 origin-left rounded-full bg-[var(--mint)]" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemoEditor({ step }: { step: number }) {
  return (
    <div className="pm-demo-scene grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]" key={step}>
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-[#dfe6df] bg-white p-3"><p className="flex items-center gap-1.5 text-[10px] font-black text-[#66736b]"><Building2 className="h-3 w-3" />FROM</p><p className="mt-2 text-xs font-black">Harbour Studio</p><p className="mt-1 text-[10px] text-[#66736b]">ABN 12 345 678 901</p></div>
          <div className={`rounded-md border bg-white p-3 transition-colors ${step === 0 ? "border-[var(--mint)] ring-2 ring-[#cde8db]" : "border-[#dfe6df]"}`}><p className="text-[10px] font-black text-[#66736b]">BILL TO</p><div className="mt-2 flex items-center justify-between rounded border border-[#dfe6df] px-2 py-1.5 text-xs font-black"><span>North & Co.</span>{step === 0 ? <CheckCircle2 className="pm-demo-pop h-4 w-4 text-[var(--mint)]" /> : null}</div><p className="mt-1.5 text-[10px] text-[#66736b]">Sydney NSW · hello@north.co</p></div>
        </div>
        <div className={`rounded-md border bg-white p-3 ${step === 1 ? "border-[var(--mint)] ring-2 ring-[#cde8db]" : "border-[#dfe6df]"}`}>
          <div className="grid grid-cols-[1fr_42px_64px_64px] gap-2 border-b border-[#e7ebe7] pb-2 text-[9px] font-black text-[#66736b]"><span>DESCRIPTION</span><span>QTY</span><span>GST</span><span className="text-right">AMOUNT</span></div>
          <div className="pm-demo-row mt-2 grid grid-cols-[1fr_42px_64px_64px] gap-2 text-[11px]"><span className="font-black">Website design</span><span>1</span><span>$280</span><span className="text-right font-black">$3,080</span></div>
          {step >= 1 ? <div className="pm-demo-row mt-2 grid grid-cols-[1fr_42px_64px_64px] gap-2 text-[11px]" style={{ animationDelay: "140ms" }}><span className="font-black">Brand package</span><span>2</span><span>$120</span><span className="text-right font-black">$1,320</span></div> : <div className="mt-2 h-4 rounded bg-[#f1f4f1]" />}
        </div>
      </div>
      <div className="rounded-md border border-[#dfe6df] bg-white p-3">
        <div className="flex items-center justify-between"><span className="rounded-full bg-[#f0f3f0] px-2 py-1 text-[9px] font-black">DRAFT</span><span className="text-[9px] text-[#66736b]">AUD</span></div>
        <p className="mt-3 text-[10px] font-black text-[#66736b]">INVOICE NUMBER</p><p className="mt-1 text-sm font-black">INV20260715001</p>
        <div className="mt-4 border-t border-[#e7ebe7] pt-3 text-[10px]"><p className="flex justify-between"><span>Subtotal</span><strong>$4,000</strong></p><p className="mt-2 flex justify-between"><span>GST</span><strong>$400</strong></p><p className="mt-3 flex justify-between rounded bg-[#17211b] px-2 py-2 text-white"><span>Total</span><strong>$4,400</strong></p></div>
        <button className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-[10px] font-black text-white ${step === 2 ? "bg-[var(--mint)] ring-4 ring-[#cde8db]" : "bg-[#17211b]"}`} type="button"><MousePointer2 className="h-3 w-3" />Preview</button>
      </div>
      {step === 2 ? (
        <div className="pm-demo-preview absolute inset-3 z-10 grid place-items-center rounded-md bg-[#17211b]/55 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-sm bg-white p-4 shadow-2xl" dir="ltr">
            <div className="flex items-start justify-between border-b border-[#dfe6df] pb-3"><div><p className="text-[9px] font-black text-[var(--mint-dark)]">TAX INVOICE</p><p className="mt-1 text-lg font-black">#INV20260715001</p></div><div className="text-right text-[9px]"><strong>Harbour Studio</strong><p>ABN 12 345 678 901</p></div></div>
            <div className="mt-3 grid grid-cols-2 text-[9px]"><div><strong>BILL TO</strong><p>North & Co.</p></div><div className="text-right"><strong>TOTAL</strong><p className="text-base font-black">$4,400</p></div></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DemoDashboard() {
  const values = [32, 48, 39, 64, 53, 78, 70, 88, 74, 92, 82, 100];
  return (
    <div className="pm-demo-scene rounded-md border border-[#dfe6df] bg-white p-4">
      <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-1.5 text-[10px] font-black text-[#66736b]"><LayoutDashboard className="h-3 w-3" />DASHBOARD · FY 2026–2027</p><h3 className="mt-1 text-lg font-black">Paid revenue</h3></div><span className="rounded-md bg-[#e9f5ef] px-3 py-2 text-sm font-black text-[var(--mint-dark)]">$42,680</span></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]"><div className="rounded border border-[#dfe6df] p-2"><span className="text-[#66736b]">Invoices</span><strong className="mt-1 block text-base">18</strong></div><div className="rounded border border-[#dfe6df] p-2"><span className="text-[#66736b]">Paid</span><strong className="mt-1 block text-base text-[var(--mint-dark)]">$8,420</strong></div><div className="rounded border border-[#dfe6df] p-2"><span className="text-[#66736b]">Overdue</span><strong className="mt-1 block text-base text-[var(--rose)]">$620</strong></div></div>
      <div className="mt-5 flex h-36 items-end gap-2 border-b border-l border-[#dfe6df] px-3">
        {values.map((height, index) => <span className="pm-demo-bar flex-1 rounded-t-sm bg-[var(--mint)]" key={index} style={{ height: `${height}%`, animationDelay: `${index * 45}ms` }} />)}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-bold text-[#66736b]"><span>JUL</span><span>OCT</span><span>JAN</span><span>APR</span><span>JUN</span></div>
    </div>
  );
}
