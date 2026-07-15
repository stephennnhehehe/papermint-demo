"use client";

import { FormEvent, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { AuthPageShell } from "@/components/app/AuthPageShell";
import { useLanguage } from "@/components/app/LanguageProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { pickLanguage } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { language } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!isSupabaseConfigured()) {
      setMessage(copy({ en: "Authentication is not configured.", zh: "认证服务尚未配置。", vi: "Dịch vụ đăng nhập chưa được cấu hình.", ar: "لم تتم تهيئة خدمة المصادقة." }));
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
      subtitle={copy({ en: "Enter your account email and we will send a secure password reset link.", zh: "输入注册邮箱，我们会发送一条安全的密码重置链接。", vi: "Nhập email tài khoản để nhận liên kết đặt lại mật khẩu an toàn.", ar: "أدخل بريد حسابك لنرسل رابطاً آمناً لإعادة تعيين كلمة المرور." })}
      title={copy({ en: "Reset your password", zh: "找回密码", vi: "Đặt lại mật khẩu", ar: "إعادة تعيين كلمة المرور" })}
    >
      {sent ? (
        <div className="rounded-lg border border-[#b8dbc9] bg-[#eaf6ef] p-4 text-sm leading-6 text-[var(--foreground)]">
          <div className="flex items-center gap-2 font-black"><Mail className="h-4 w-4 text-[var(--mint-dark)]" />{copy({ en: "Check your inbox", zh: "请检查你的邮箱", vi: "Kiểm tra hộp thư", ar: "تحقق من بريدك" })}</div>
          <p className="mt-2 text-[var(--muted)]">{copy({ en: `If ${email} is registered, a reset link will arrive shortly.`, zh: `如果 ${email} 已注册，你会很快收到重置链接。`, vi: `Nếu ${email} đã đăng ký, liên kết sẽ sớm được gửi đến.`, ar: `إذا كان ${email} مسجلاً، فسيصل الرابط قريباً.` })}</p>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label>
            <span className="label">Email</span>
            <input autoComplete="email" className="field" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
          </label>
          {message ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{message}</div> : null}
          <button className="btn-primary w-full" disabled={busy} type="submit">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {copy({ en: "Send reset link", zh: "发送重置链接", vi: "Gửi liên kết đặt lại", ar: "إرسال رابط إعادة التعيين" })}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}
