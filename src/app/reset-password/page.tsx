"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { AuthPageShell } from "@/components/app/AuthPageShell";
import { useLanguage } from "@/components/app/LanguageProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const { language } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setChecking(false);
      return;
    }
    const supabase = getSupabaseClient();
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setReady(Boolean(data.session));
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
      setChecking(false);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage(language === "zh" ? "密码至少需要 8 个字符。" : "Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage(language === "zh" ? "两次输入的密码不一致。" : "The passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await getSupabaseClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setComplete(true);
  }

  return (
    <AuthPageShell
      language={language}
      subtitle={language === "zh" ? "设置一个新的密码，之后即可继续使用你的 PaperMint 工作台。" : "Choose a new password, then continue to your PaperMint workspace."}
      title={language === "zh" ? "设置新密码" : "Choose a new password"}
    >
      {checking ? (
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" />{language === "zh" ? "正在验证链接…" : "Checking your reset link…"}</div>
      ) : complete ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--mint)]" />
          <p className="mt-3 font-black">{language === "zh" ? "密码已更新" : "Password updated"}</p>
          <Link className="btn-primary mt-5 w-full" href="/dashboard">{language === "zh" ? "进入工作台" : "Open workspace"}</Link>
        </div>
      ) : ready ? (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label><span className="label">{language === "zh" ? "新密码" : "New password"}</span><input autoComplete="new-password" className="field" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          <label><span className="label">{language === "zh" ? "确认新密码" : "Confirm new password"}</span><input autoComplete="new-password" className="field" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>
          {message ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{message}</div> : null}
          <button className="btn-primary w-full" disabled={busy} type="submit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}{language === "zh" ? "更新密码" : "Update password"}</button>
        </form>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p className="font-black">{language === "zh" ? "重置链接已失效" : "This reset link is no longer valid"}</p>
          <Link className="mt-3 inline-block font-black underline" href="/forgot-password">{language === "zh" ? "重新发送链接" : "Request another link"}</Link>
        </div>
      )}
    </AuthPageShell>
  );
}
