"use client";

import Link from "next/link";
import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { useLanguage } from "./LanguageProvider";

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const { language } = useLanguage();
  const isPrivacy = type === "privacy";
  const content = language === "zh"
    ? isPrivacy
      ? {
          title: "隐私政策",
          intro: "PaperMint 仅收集提供账号、单据保存和订阅服务所需的信息。",
          sections: [
            ["我们处理的信息", "包括账号邮箱、你主动输入的公司、客户和单据资料、产品使用数据，以及由 Stripe 保存的订阅状态。PaperMint 不保存完整银行卡号码。"],
            ["信息用途", "用于登录认证、保存你的工作内容、生成文件、处理订阅、保障安全并改进产品。"],
            ["服务提供商", "我们使用 Supabase 提供认证与数据库服务、Vercel 托管网站、Stripe 处理付款。各服务商会按其政策处理必要数据。"],
            ["数据控制", "你可以在应用内编辑或删除客户和单据。账号删除及数据导出功能上线前，可通过产品支持渠道提出请求。"],
            ["安全与保留", "账号数据通过访问控制与数据库行级权限隔离。数据会在提供服务、履行法律义务和处理争议所需期间保留。"]
          ]
        }
      : {
          title: "服务条款",
          intro: "使用 PaperMint 即表示你同意以合法、负责的方式使用本服务。",
          sections: [
            ["服务范围", "PaperMint 提供发票、报价、客户管理、PDF 和营收概览工具。它不是会计、税务或法律建议，用户应自行核对 ABN、GST 和财务数据。"],
            ["账号责任", "你应保护登录信息，并对账号内创建和发送的内容负责。不得利用服务进行欺诈、侵权或违法活动。"],
            ["免费与付费方案", "免费方案目前包含全部功能，每个澳洲自然周可新建 5 份 Invoice 或 Quote，并在输出中显示 PaperMint 页脚。付费方案提升额度并移除该页脚，可通过 Stripe 门户管理或取消。"],
            ["可用性与变更", "我们会努力保持服务稳定，但不保证永不中断。功能、价格或限制如有实质变更，会在合理范围内提前说明。"],
            ["责任限制", "在法律允许范围内，PaperMint 不对因输入错误、税务判断、业务损失或第三方服务中断造成的间接损失负责。"]
          ]
        }
    : isPrivacy
      ? {
          title: "Privacy Policy",
          intro: "PaperMint collects only the information needed to provide accounts, document storage and subscriptions.",
          sections: [
            ["Information we process", "This includes your account email, business, customer and document details you enter, product usage data, and subscription status stored by Stripe. PaperMint does not store complete card numbers."],
            ["How information is used", "We use it to authenticate you, save your work, generate files, process subscriptions, protect the service and improve the product."],
            ["Service providers", "We use Supabase for authentication and database services, Vercel for hosting, and Stripe for payments. Each provider processes necessary data under its own policies."],
            ["Your controls", "You can edit or delete customers and documents in the app. Until self-service account deletion and export are available, requests can be made through the product support channel."],
            ["Security and retention", "Account data is isolated with access controls and database row-level security. Data is kept only as needed to provide the service, meet legal duties and resolve disputes."]
          ]
        }
      : {
          title: "Terms of Service",
          intro: "By using PaperMint, you agree to use the service lawfully and responsibly.",
          sections: [
            ["Service scope", "PaperMint provides invoicing, quoting, customer management, PDF and revenue overview tools. It is not accounting, tax or legal advice; users remain responsible for checking ABN, GST and financial data."],
            ["Account responsibility", "Keep your sign-in details secure and take responsibility for content created or sent from your account. The service must not be used for fraud, infringement or unlawful activity."],
            ["Free and paid plans", "The free plan currently includes every feature, allows 5 new invoices or quotes per Australian calendar week, and adds a PaperMint footer to output. Paid plans increase the limit and remove that footer, and can be managed or cancelled through Stripe."],
            ["Availability and changes", "We aim to keep PaperMint reliable but cannot promise uninterrupted availability. Material changes to features, prices or limits will be communicated with reasonable notice."],
            ["Liability", "To the extent permitted by law, PaperMint is not liable for indirect loss caused by incorrect inputs, tax decisions, business outcomes or third-party service interruptions."]
          ]
        };

  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 sm:px-6">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-4"><Link href="/login"><Brand /></Link><LanguageSwitch /></header>
      <article className="mx-auto my-10 max-w-4xl rounded-lg border border-[var(--line)] bg-white p-6 sm:p-10">
        <p className="text-sm font-black text-[var(--mint-dark)]">PaperMint</p>
        <h1 className="mt-2 text-4xl font-black tracking-normal">{content.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">{content.intro}</p>
        <p className="mt-3 text-xs font-bold text-[var(--muted)]">{language === "zh" ? "最后更新：2026 年 7 月 15 日" : "Last updated: 15 July 2026"}</p>
        <div className="mt-9 grid gap-8">
          {content.sections.map(([title, body]) => <section key={title}><h2 className="text-xl font-black tracking-normal">{title}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p></section>)}
        </div>
        <div className="mt-10 border-t border-[var(--line)] pt-5"><Link className="font-black text-[var(--mint-dark)]" href="/login">← {language === "zh" ? "返回 PaperMint" : "Back to PaperMint"}</Link></div>
      </article>
    </main>
  );
}
