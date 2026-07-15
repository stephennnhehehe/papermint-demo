"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { AuthPageShell } from "@/components/app/AuthPageShell";
import { useLanguage } from "@/components/app/LanguageProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { pickLanguage } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const { language } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
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
      setMessage(copy({ en: "Use at least 8 characters.", zh: "密码至少需要 8 个字符。", vi: "Mật khẩu cần ít nhất 8 ký tự.", ar: "استخدم 8 أحرف على الأقل." }));
      return;
    }
    if (password !== confirmPassword) {
      setMessage(copy({ en: "The passwords do not match.", zh: "两次输入的密码不一致。", vi: "Mật khẩu không khớp.", ar: "كلمتا المرور غير متطابقتين." }));
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
      subtitle={copy({ en: "Choose a new password, then continue to your PaperMint workspace.", zh: "设置一个新的密码，之后即可继续使用你的 PaperMint 工作台。", vi: "Đặt mật khẩu mới rồi tiếp tục vào PaperMint.", ar: "اختر كلمة مرور جديدة ثم تابع إلى مساحة PaperMint." })}
      title={copy({ en: "Choose a new password", zh: "设置新密码", vi: "Chọn mật khẩu mới", ar: "اختر كلمة مرور جديدة" })}
    >
      {checking ? (
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" />{copy({ en: "Checking your reset link...", zh: "正在验证链接…", vi: "Đang kiểm tra liên kết...", ar: "جارٍ التحقق من الرابط..." })}</div>
      ) : complete ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--mint)]" />
          <p className="mt-3 font-black">{copy({ en: "Password updated", zh: "密码已更新", vi: "Đã cập nhật mật khẩu", ar: "تم تحديث كلمة المرور" })}</p>
          <Link className="btn-primary mt-5 w-full" href="/dashboard">{copy({ en: "Open workspace", zh: "进入工作台", vi: "Mở không gian làm việc", ar: "فتح مساحة العمل" })}</Link>
        </div>
      ) : ready ? (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label><span className="label">{copy({ en: "New password", zh: "新密码", vi: "Mật khẩu mới", ar: "كلمة المرور الجديدة" })}</span><input autoComplete="new-password" className="field" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          <label><span className="label">{copy({ en: "Confirm new password", zh: "确认新密码", vi: "Xác nhận mật khẩu", ar: "تأكيد كلمة المرور" })}</span><input autoComplete="new-password" className="field" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>
          {message ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{message}</div> : null}
          <button className="btn-primary w-full" disabled={busy} type="submit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}{copy({ en: "Update password", zh: "更新密码", vi: "Cập nhật mật khẩu", ar: "تحديث كلمة المرور" })}</button>
        </form>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p className="font-black">{copy({ en: "This reset link is no longer valid", zh: "重置链接已失效", vi: "Liên kết đặt lại không còn hiệu lực", ar: "رابط إعادة التعيين لم يعد صالحاً" })}</p>
          <Link className="mt-3 inline-block font-black underline" href="/forgot-password">{copy({ en: "Request another link", zh: "重新发送链接", vi: "Yêu cầu liên kết khác", ar: "طلب رابط آخر" })}</Link>
        </div>
      )}
    </AuthPageShell>
  );
}
