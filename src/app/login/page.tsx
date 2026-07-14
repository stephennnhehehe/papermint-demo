"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, LockKeyhole, Play, Sparkles } from "lucide-react";
import { LanguageSwitch } from "@/components/app/LanguageSwitch";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { getSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { configured, startDemo, user } = useAuth();
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured || user) router.replace("/dashboard");
  }, [configured, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured) {
      setMessage("Supabase is not configured. Add .env.local first.");
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        setMessage(
          language === "zh"
            ? "注册成功。请查看邮箱确认链接，或在 Supabase 测试时关闭邮箱确认。"
            : "Account created. Check your confirmation email, or disable email confirmation for local testing."
        );
      } else {
        router.replace("/dashboard");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDemo() {
    startDemo();
    router.replace("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <div className="grid w-full max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="panel flex flex-col justify-between p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--foreground)] text-white">
                <FileText className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-3xl font-black tracking-normal">PaperMint</h1>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  {t("appTagline")}
                </p>
              </div>
            </div>
            <LanguageSwitch />
          </div>

          <div className="mt-12 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-lg bg-[#e9f5ef] px-3 py-2 text-sm font-bold text-[var(--mint-dark)]">
              <Sparkles className="h-4 w-4" />
              AUD · ABN · GST · PDF
            </div>
            <h2 className="max-w-xl text-4xl font-black leading-tight tracking-normal sm:text-5xl">
              {language === "zh" ? "简洁地完成开票和报价。" : "Clean invoicing, without the admin fog."}
            </h2>
            <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
              {language === "zh"
                ? "注册后即可保存客户、发票和报价，实时预览并下载适合 A4 的 PDF。"
                : "Create customers, invoices and quotes with live preview, A4 PDF export and Australian tax fields."}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-2 text-sm font-bold">
            <div className="rounded-lg border border-[var(--line)] bg-white/70 p-3">GST 10%</div>
            <div className="rounded-lg border border-[var(--line)] bg-white/70 p-3">AUD</div>
            <div className="rounded-lg border border-[var(--line)] bg-white/70 p-3">ABN</div>
          </div>
        </section>

        <section className="panel grid gap-5 p-6 sm:p-8">
          <div>
            <p className="text-sm font-bold text-[var(--mint-dark)]">
              {mode === "signin" ? t("signIn") : t("register")}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-normal">
              {language === "zh" ? "进入工作台" : "Open your workspace"}
            </h2>
          </div>

          {!configured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {language === "zh"
                ? "还没有 Supabase 配置也没关系，可以先进入 Demo 工作台完整试用。"
                : "Supabase is not configured yet. You can still enter the demo workspace and try the full flow."}
            </div>
          )}

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label>
              <span className="label">{t("email")}</span>
              <input
                autoComplete="email"
                className="field"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              <span className="label">{t("password")}</span>
              <input
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="field"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                type="password"
                value={password}
              />
            </label>

            {message && (
              <div className="rounded-lg border border-[var(--line)] bg-white/80 p-3 text-sm font-semibold text-[var(--muted)]">
                {message}
              </div>
            )}

            <button className="btn-primary min-h-11" disabled={busy} type="submit">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {mode === "signin" ? t("signIn") : t("register")}
            </button>
          </form>

          <button
            className="btn-secondary"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            type="button"
          >
            {mode === "signin"
              ? language === "zh"
                ? "没有账号？创建一个"
                : "Need an account? Register"
              : language === "zh"
                ? "已有账号？登录"
                : "Already registered? Sign in"}
          </button>
          <button className="btn-secondary border-[var(--mint)] text-[var(--mint-dark)]" onClick={handleDemo} type="button">
            <Play className="h-4 w-4" />
            {language === "zh" ? "无需账号试用 Demo 工作台" : "Try demo workspace without an account"}
          </button>
        </section>
      </div>
    </main>
  );
}
