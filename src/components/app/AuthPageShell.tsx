import Link from "next/link";
import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { pickLanguage, type Language } from "@/lib/i18n";

export function AuthPageShell({
  children,
  title,
  subtitle,
  language
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  language: Language;
}) {
  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 sm:px-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link href="/login"><Brand /></Link>
        <LanguageSwitch />
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-150px)] max-w-md place-items-center py-10">
        <section className="w-full rounded-lg border border-[var(--line)] bg-white p-6 shadow-[0_24px_70px_rgba(23,33,27,0.09)] sm:p-8">
          <h1 className="text-3xl font-black tracking-normal">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 border-t border-[var(--line)] pt-5 text-center text-xs text-[var(--muted)]">
            <Link className="font-bold hover:text-[var(--mint-dark)]" href="/login">
              {pickLanguage(language, { en: "Back to sign in", zh: "返回登录", vi: "Quay lại đăng nhập", ar: "العودة إلى تسجيل الدخول" })}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
