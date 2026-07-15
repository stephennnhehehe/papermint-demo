"use client";

import { FormEvent, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { AuthPageShell } from "@/components/app/AuthPageShell";
import { useLanguage } from "@/components/app/LanguageProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const { language } = useLanguage();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!isSupabaseConfigured()) {
      setMessage(language === "zh" ? "认证服务尚未配置。" : "Authentication is not configured.");
      return;
    }

    setBusy(true);
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthPageShell
      language={language}
      subtitle={language === "zh" ? "输入注册邮箱，我们会发送一条安全的密码重置链接。" : "Enter your account email and we will send a secure password reset link."}
      title={language === "zh" ? "找回密码" : "Reset your password"}
    >
      {sent ? (
        <div className="rounded-lg border border-[#b8dbc9] bg-[#eaf6ef] p-4 text-sm leading-6 text-[var(--foreground)]">
          <div className="flex items-center gap-2 font-black"><Mail className="h-4 w-4 text-[var(--mint-dark)]" />{language === "zh" ? "请检查你的邮箱" : "Check your inbox"}</div>
          <p className="mt-2 text-[var(--muted)]">{language === "zh" ? `如果 ${email} 已注册，你会很快收到重置链接。` : `If ${email} is registered, a reset link will arrive shortly.`}</p>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label>
            <span className="label">{language === "zh" ? "邮箱" : "Email"}</span>
            <input autoComplete="email" className="field" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
          </label>
          {message ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{message}</div> : null}
          <button className="btn-primary w-full" disabled={busy} type="submit">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {language === "zh" ? "发送重置链接" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}
