"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ArrowUpRight,
  CreditCard,
  FileText,
  Gauge,
  LogOut,
  Settings,
  ReceiptText,
  Users,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useBilling } from "./BillingProvider";
import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { useLanguage } from "./LanguageProvider";
import { freeDocumentsRemaining, isFreeDocumentLimitReached } from "@/lib/billing";
import { pickLanguage } from "@/lib/i18n";

const nav = [
  { href: "/dashboard", key: "dashboard", icon: BarChart3 },
  { href: "/documents", key: "documents", icon: FileText },
  { href: "/customers", key: "customers", icon: Users },
  { href: "/expenses", key: "expenses", icon: ReceiptText },
  { href: "/settings", key: "settings", icon: Settings },
  { href: "/pricing", key: "pricing", icon: CreditCard }
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { configured, demo, signOut, user } = useAuth();
  const { billing, loading: billingLoading } = useBilling();
  const { language, t } = useLanguage();
  const hasDocumentEditorBar =
    pathname === "/documents/new" || (pathname.startsWith("/documents/") && pathname !== "/documents");
  const remaining = freeDocumentsRemaining(billing);
  const limitReached = isFreeDocumentLimitReached(billing);
  const usagePercent = billing.documentsLimit
    ? Math.min(100, (billing.documentsUsed / billing.documentsLimit) * 100)
    : 0;
  const resetDate = new Date(billing.weekStartsAt);
  resetDate.setDate(resetDate.getDate() + 7);

  async function handleSignOut() {
    await signOut();
    router.replace(configured ? "/login" : "/dashboard");
  }

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <header className="mx-auto flex max-w-7xl flex-col gap-3 rounded-lg border border-[var(--line)] bg-white/80 p-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <Link className="flex min-w-0 shrink-0 items-center gap-3" href="/dashboard">
          <Brand />
          <span className="hidden min-w-0 xl:block">
            <span className="block truncate text-xs font-semibold text-[var(--muted)]">
              {t("appTagline")}
            </span>
          </span>
        </Link>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <nav className="order-2 grid w-full grid-cols-3 gap-1 rounded-lg border border-[var(--line)] bg-[#f8faf7] p-1 md:order-none md:flex md:w-auto md:flex-wrap">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-bold sm:text-sm md:justify-start md:gap-2 md:px-3 ${
                    active ? "bg-white text-[var(--mint-dark)] shadow-sm" : "text-[var(--muted)]"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{t(item.key)}</span>
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
              {pickLanguage(language, { en: "Unlimited", zh: "不限量", vi: "Không giới hạn", ar: "غير محدود" })}
            </Link>
          ) : !billingLoading ? (
            <Link className="rounded-lg bg-[#fff3d8] px-3 py-2 text-xs font-black text-amber-800" href="/pricing">
              {billing.documentsUsed}/{billing.documentsLimit ?? 5} {t("documents")}
            </Link>
          ) : null}
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

      {!billingLoading && !billing.isPaid ? (
        <section className={`mx-auto mt-3 max-w-7xl rounded-lg border p-4 ${limitReached ? "border-amber-300 bg-amber-50" : "border-[#cfe4d8] bg-[#eef7f2]"}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${limitReached ? "bg-amber-100 text-amber-800" : "bg-white text-[var(--mint-dark)]"}`}>
                <Gauge className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-black">
                  {limitReached
                    ? pickLanguage(language, { en: "Weekly free limit reached", zh: "本周免费额度已用完", vi: "Đã hết hạn mức miễn phí tuần này", ar: "تم بلوغ الحد المجاني الأسبوعي" })
                    : pickLanguage(language, {
                        en: `${remaining} of ${billing.documentsLimit ?? 5} free documents remaining`,
                        zh: `本周还可创建 ${remaining} / ${billing.documentsLimit ?? 5} 份免费单据`,
                        vi: `Còn ${remaining} / ${billing.documentsLimit ?? 5} chứng từ miễn phí trong tuần`,
                        ar: `متبقي ${remaining} من ${billing.documentsLimit ?? 5} مستندات مجانية هذا الأسبوع`
                      })}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">
                  {limitReached
                    ? pickLanguage(language, { en: "New invoices and quotes are disabled until the weekly reset or an upgrade.", zh: "新建 Invoice 和 Quote 已停用；等待每周重置或升级后可继续。", vi: "Tạo hóa đơn và báo giá mới đã bị tạm dừng cho đến khi đặt lại hoặc nâng cấp.", ar: "تم إيقاف إنشاء الفواتير وعروض الأسعار حتى إعادة الضبط أو الترقية." })
                    : pickLanguage(language, { en: `Resets ${resetDate.toLocaleDateString()}. Saved documents remain available.`, zh: `${resetDate.toLocaleDateString()} 重置，已保存单据不受影响。`, vi: `Đặt lại vào ${resetDate.toLocaleDateString()}. Chứng từ đã lưu vẫn được giữ.`, ar: `تتم إعادة الضبط في ${resetDate.toLocaleDateString()}. تبقى المستندات المحفوظة متاحة.` })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:min-w-72">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                <div className={`h-full rounded-full ${limitReached ? "bg-amber-500" : "bg-[var(--mint)]"}`} style={{ width: `${usagePercent}%` }} />
              </div>
              <span className="text-sm font-black">{billing.documentsUsed}/{billing.documentsLimit ?? 5}</span>
              <Link className="btn-secondary shrink-0 bg-white px-3 py-2 text-sm" href="/pricing">
                {pickLanguage(language, { en: "Upgrade", zh: "升级", vi: "Nâng cấp", ar: "ترقية" })}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-7xl py-5">{children}</div>
      <footer
        className={`mx-auto flex max-w-7xl flex-col gap-2 border-t border-[var(--line)] py-5 text-sm font-semibold text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between ${
          hasDocumentEditorBar ? "pb-28" : ""
        }`}
      >
        <span>PaperMint © 2026</span>
        <span className="flex flex-wrap gap-4">
          <Link className="hover:text-[var(--mint-dark)]" href="/pricing">{t("pricing")}</Link>
          <Link className="hover:text-[var(--mint-dark)]" href="/docs">{pickLanguage(language, { en: "Documentation", zh: "使用文档", vi: "Tài liệu", ar: "دليل الاستخدام" })}</Link>
          <Link className="hover:text-[var(--mint-dark)]" href="/privacy">{pickLanguage(language, { en: "Privacy", zh: "隐私", vi: "Quyền riêng tư", ar: "الخصوصية" })}</Link>
          <Link className="hover:text-[var(--mint-dark)]" href="/terms">{pickLanguage(language, { en: "Terms", zh: "条款", vi: "Điều khoản", ar: "الشروط" })}</Link>
        </span>
      </footer>
    </div>
  );
}
