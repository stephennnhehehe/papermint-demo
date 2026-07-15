"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  FileText,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useBilling } from "./BillingProvider";
import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { useLanguage } from "./LanguageProvider";

const nav = [
  { href: "/dashboard", key: "dashboard", icon: BarChart3 },
  { href: "/documents", key: "documents", icon: FileText },
  { href: "/customers", key: "customers", icon: Users },
  { href: "/settings", key: "settings", icon: Settings },
  { href: "/pricing", key: "pricing", icon: CreditCard }
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { configured, demo, signOut, user } = useAuth();
  const { billing } = useBilling();
  const { language, t } = useLanguage();
  const hasDocumentEditorBar =
    pathname === "/documents/new" || (pathname.startsWith("/documents/") && pathname !== "/documents");

  async function handleSignOut() {
    await signOut();
    router.replace(configured ? "/login" : "/dashboard");
  }

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <header className="mx-auto flex max-w-7xl flex-col gap-3 rounded-lg border border-[var(--line)] bg-white/80 p-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <Link className="flex min-w-0 items-center gap-3" href="/dashboard">
          <Brand />
          <span className="hidden min-w-0 xl:block">
            <span className="block truncate text-xs font-semibold text-[var(--muted)]">
              {t("appTagline")}
            </span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1 rounded-lg border border-[var(--line)] bg-[#f8faf7] p-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${
                    active ? "bg-white text-[var(--mint-dark)] shadow-sm" : "text-[var(--muted)]"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(item.key)}</span>
                </Link>
              );
            })}
          </nav>
          <LanguageSwitch />
          {demo ? (
            <span className="rounded-lg bg-[#fff3d8] px-3 py-2 text-xs font-black text-amber-800">
              Demo
            </span>
          ) : billing.isPaid ? (
            <Link className="rounded-lg bg-[#eaf6ef] px-3 py-2 text-xs font-black text-[var(--mint-dark)]" href="/pricing">
              {language === "zh" ? "不限量" : "Unlimited"}
            </Link>
          ) : (
            <Link className="rounded-lg bg-[#fff3d8] px-3 py-2 text-xs font-black text-amber-800" href="/pricing">
              {billing.documentsUsed}/{billing.documentsLimit ?? 5} {language === "zh" ? "本周" : "this week"}
            </Link>
          )}
          <button
            className="icon-btn"
            onClick={handleSignOut}
            title={`${t("signOut")} ${user?.email ?? ""}`}
            type="button"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl py-5">{children}</div>
      <footer
        className={`mx-auto flex max-w-7xl flex-col gap-2 border-t border-[var(--line)] py-5 text-sm font-semibold text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between ${
          hasDocumentEditorBar ? "pb-28" : ""
        }`}
      >
        <span>PaperMint © 2026</span>
        <span className="flex flex-wrap gap-4">
          <Link className="hover:text-[var(--mint-dark)]" href="/pricing">{language === "zh" ? "定价" : "Pricing"}</Link>
          <Link className="hover:text-[var(--mint-dark)]" href="/docs">{language === "zh" ? "使用文档" : "Documentation"}</Link>
          <Link className="hover:text-[var(--mint-dark)]" href="/privacy">{language === "zh" ? "隐私" : "Privacy"}</Link>
          <Link className="hover:text-[var(--mint-dark)]" href="/terms">{language === "zh" ? "条款" : "Terms"}</Link>
        </span>
      </footer>
    </div>
  );
}
