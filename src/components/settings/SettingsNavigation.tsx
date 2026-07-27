"use client";

import Link from "next/link";
import { Building2, Globe2, Users } from "lucide-react";
import { useLanguage } from "@/components/app/LanguageProvider";
import { pickLanguage } from "@/lib/i18n";

const sections = [
  { href: "/settings", key: "business", icon: Building2 },
  { href: "/settings/customers", key: "customers", icon: Users },
  { href: "/settings/account", key: "account", icon: Globe2 }
] as const;

export function SettingsNavigation({
  active
}: {
  active: (typeof sections)[number]["key"];
}) {
  const { language, t } = useLanguage();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);

  const labels = {
    business: copy({ en: "Business", zh: "公司与开票", vi: "Doanh nghiệp", ar: "الأعمال" }),
    customers: t("customers"),
    account: copy({ en: "Language & account", zh: "语言与账户", vi: "Ngôn ngữ & tài khoản", ar: "اللغة والحساب" })
  };

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
        <h1 className="text-2xl font-black tracking-normal">{t("settings")}</h1>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
          {copy({
            en: "Manage your business, customers, language and account in one place.",
            zh: "在一个地方管理公司资料、客户、语言和账户。",
            vi: "Quản lý doanh nghiệp, khách hàng, ngôn ngữ và tài khoản tại một nơi.",
            ar: "أدر أعمالك وعملاءك ولغتك وحسابك من مكان واحد."
          })}
        </p>
      </div>
      <nav className="grid grid-cols-1 gap-1 bg-[#f8faf7] p-2 sm:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              className={`flex min-w-0 items-center gap-3 rounded-md px-4 py-3 text-sm font-black ${
                active === section.key
                  ? "bg-white text-[var(--mint-dark)] shadow-sm"
                  : "text-[var(--muted)] hover:bg-white/70"
              }`}
              href={section.href}
              key={section.key}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{labels[section.key]}</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
