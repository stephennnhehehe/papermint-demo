"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe2, Loader2, LogOut, Mail, UserRound } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { SettingsNavigation } from "@/components/settings/SettingsNavigation";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { languageOptions, pickLanguage } from "@/lib/i18n";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { configured, demo, signOut, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace(configured ? "/login" : "/dashboard");
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto grid max-w-6xl gap-5">
          <SettingsNavigation active="account" />
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel p-5 sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e8f4ef] text-[var(--mint-dark)]">
                  <Globe2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-normal">{t("language")}</h2>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    {copy({
                      en: "Choose the language used throughout PaperMint.",
                      zh: "选择 PaperMint 整个应用使用的语言。",
                      vi: "Chọn ngôn ngữ sử dụng trong PaperMint.",
                      ar: "اختر اللغة المستخدمة في PaperMint."
                    })}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {languageOptions.map((option) => (
                  <button
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-black ${
                      language === option.code
                        ? "border-[#a9d5be] bg-[#eaf6ef] text-[var(--mint-dark)]"
                        : "border-[var(--line)] bg-white/80 text-[var(--foreground)] hover:bg-white"
                    }`}
                    key={option.code}
                    onClick={() => setLanguage(option.code)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    {language === option.code ? <Check className="h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel p-5 sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eef3ef] text-[var(--muted)]">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-normal">
                    {copy({ en: "Account", zh: "账户", vi: "Tài khoản", ar: "الحساب" })}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    {copy({
                      en: "View your signed-in account and securely sign out.",
                      zh: "查看当前登录账户，并在需要时安全退出。",
                      vi: "Xem tài khoản đang đăng nhập và đăng xuất an toàn.",
                      ar: "اعرض الحساب الحالي وسجّل الخروج بأمان."
                    })}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-white/75 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      {copy({ en: "Signed in as", zh: "当前登录账户", vi: "Đăng nhập với", ar: "مسجل الدخول باسم" })}
                    </p>
                    <p className="truncate font-black">{user?.email ?? "—"}</p>
                  </div>
                  {demo ? (
                    <span className="ml-auto shrink-0 rounded-md bg-[#fff3d8] px-2 py-1 text-xs font-black text-amber-800">
                      Demo
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                className="btn-secondary mt-4 w-full border-[#efcaca] bg-[#fff8f7] text-[var(--rose)]"
                disabled={signingOut}
                onClick={handleSignOut}
                type="button"
              >
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {t("signOut")}
              </button>
            </section>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
