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
          intro: "本政策说明 PaperMint 在提供开票、轻量记账及报表工具时如何处理个人信息。我们仅处理合理提供服务所需的数据，也不会出售个人信息。",
          sections: [
            ["我们收集的信息", "包括登录邮箱及 Google 登录标识；你输入的企业、ABN、客户、Invoice、Quote、Expense、付款账户标签、车辆及 Logbook 数据；你上传的 Logo、PDF 或图片凭证；安全分享和单据状态事件；订阅状态、必要的诊断与使用数据。付款账户仅保存你填写的名称、类型和可选末四位。PaperMint 不保存完整银行卡号码。"],
            ["信息的来源与用途", "数据由你直接提供、在使用功能时自动产生，或由登录及付款服务商返回。我们用它来认证账号、保存和同步记录、生成 PDF/CSV/ZIP、提供安全客户链接和提醒、计算报表、处理订阅、预防滥用、排查故障及改善产品。"],
            ["附件与客户链接", "收据及采购发票保存在仅限所属用户访问的私有存储中。企业 Logo 为生成单据所需，可通过公开文件地址呈现。启用安全分享后，持有该随机链接的人可以查看相应单据；请仅向预期收件人发送链接。"],
            ["服务提供商与境外处理", "PaperMint 使用 Supabase 提供认证、数据库及文件存储，Vercel 提供托管和基础分析，Stripe 处理订阅，Resend 发送已启用的邮件，Google 可用于登录。这些服务可能在澳洲境外处理必要数据，并依各自条款及隐私政策运营。"],
            ["披露", "除向上述服务商提供完成服务所需的数据、取得你的指示或同意、保护 PaperMint 及用户安全，或法律要求外，我们不会向第三方披露个人信息。"],
            ["安全与保留", "我们采用账号认证、访问控制、Supabase 行级权限和私有附件策略隔离用户数据。没有任何网络服务能保证绝对安全。数据会在提供服务、满足合理的备份、安全、争议及法律要求所需期间保留；税务资料的法定保存责任仍由用户承担。"],
            ["访问、更正与删除", "你可以在应用内查看、修改或删除多数企业、客户、单据、费用及 Logbook 记录。若需要账号级导出、访问、更正、删除或提出隐私投诉，请通过产品支持渠道联系我们。删除请求可能受备份周期、法律保留义务或已去标识的汇总数据限制。"],
            ["儿童与政策更新", "PaperMint 面向企业用户，并非为儿童设计。若功能或信息处理方式发生重要变化，我们会更新本政策并修改最后更新日期；重大变化会在合理可行的情况下进一步通知。"]
          ]
        }
      : {
          title: "服务条款",
          intro: "使用 PaperMint 即表示你同意以下条款，并理解它是一套辅助开票与记录整理工具。",
          sections: [
            ["服务范围", "PaperMint 提供客户与开票方管理、Invoice、Quote、PDF、安全分享、Expense、凭证附件、付款账户分类、车辆 Logbook、现金流概览、BAS preparation 和财年 accountant pack。PaperMint 不代收客户款项，也不自动向 ATO 申报。"],
            ["非专业建议", "计算结果、GST 标签、车辆业务比例、退货或损耗记录及 BAS 文件仅用于准备和核对，不构成会计、税务或法律建议。你应检查 ABN、GST、分类、抵扣资格、记录保存期和最终申报，并在需要时咨询注册税务代理或其他专业人士。"],
            ["账号责任", "你应保护登录信息，并对账号内创建和发送的内容负责。不得利用服务进行欺诈、侵权或违法活动。"],
            ["你的数据与许可", "你保留所输入及上传内容的权利，并授权 PaperMint 在提供、保护和改进服务所必需的范围内托管、处理、复制及生成该内容的输出。你保证有权处理客户、员工、司机、供应商及其他第三方资料。"],
            ["安全分享与邮件", "任何持有安全链接的人都可能查看相应单据。你负责核对收件人、内容和付款说明。邮件投递、查看事件及提醒依赖第三方服务，不能保证送达或被阅读。"],
            ["免费与付费方案", "免费方案目前包含全部功能，每个澳洲自然周可新建 5 份 Invoice 或 Quote，并在输出中显示 PaperMint 页脚。付费方案提升额度并移除该页脚，可通过 Stripe 门户管理或取消。"],
            ["可用性、备份与变更", "我们会努力保持服务稳定，但不保证永不中断、无错误或永久保留任何功能。你应保留依法或经营所需的独立副本。功能、价格或限制如有实质变更，会在合理范围内提前说明。"],
            ["暂停与终止", "如账号存在安全风险、违法或严重违反条款的行为，或为遵守法律要求，我们可限制或暂停服务。你可以停止使用服务并申请删除账号，但仍应支付终止前已产生的费用。"],
            ["责任与消费者权利", "法律不能排除的消费者保证及其他权利不受影响。在法律允许范围内，PaperMint 不对因输入错误、税务或业务判断、丢失记录、未经授权的链接访问或第三方服务中断造成的间接或后果性损失负责。"]
          ]
        }
    : isPrivacy
      ? {
          title: "Privacy Policy",
          intro: "This policy explains how PaperMint handles personal information while providing invoicing, lightweight bookkeeping and reporting tools. We process only data reasonably needed to provide the service and do not sell personal information.",
          sections: [
            ["Information we collect", "This includes your sign-in email and Google sign-in identifier; business, ABN, customer, invoice, quote, expense, payment-account label, vehicle and logbook data you enter; logos and PDF or image attachments; secure-sharing and document-status events; subscription state; and necessary diagnostic and usage data. Payment accounts store only the name, type and optional last four digits you provide. PaperMint does not store complete card numbers."],
            ["Sources and purposes", "Information comes directly from you, is created as you use a feature, or is returned by sign-in and billing providers. We use it to authenticate accounts, store and sync records, generate PDF/CSV/ZIP files, provide secure customer links and reminders, calculate reports, manage subscriptions, prevent misuse, troubleshoot and improve PaperMint."],
            ["Attachments and customer links", "Receipt and supplier-invoice attachments are kept in private user-scoped storage. A business logo may be served through a public file URL so it can appear on documents. When secure sharing is enabled, anyone holding the unguessable link can view that document, so share it only with intended recipients."],
            ["Providers and overseas processing", "PaperMint uses Supabase for authentication, database and file storage; Vercel for hosting and basic analytics; Stripe for subscriptions; Resend for enabled email delivery; and Google as an optional sign-in provider. These providers may process necessary data outside Australia under their own terms and privacy policies."],
            ["Disclosure", "We do not disclose personal information except to the providers above as needed to operate PaperMint, at your direction or with your consent, to protect PaperMint and its users, or where required by law."],
            ["Security and retention", "We use account authentication, access controls, Supabase row-level security and private attachment policies to isolate user data. No online service can guarantee absolute security. We retain data as needed for service delivery, reasonable backup and security processes, disputes and legal obligations; users remain responsible for statutory retention of their tax records."],
            ["Access, correction and deletion", "You can view, edit or delete most business, customer, document, expense and logbook records in the app. Contact the product support channel for account-level access, correction, export, deletion or a privacy complaint. Deletion may be limited by backup cycles, legal retention duties or de-identified aggregate data."],
            ["Children and policy changes", "PaperMint is a business service and is not designed for children. We will update this policy and its date when features or information practices materially change, and provide further notice where reasonably practicable."]
          ]
        }
      : {
          title: "Terms of Service",
          intro: "By using PaperMint, you agree to these terms and understand that it is an invoicing and record-preparation tool.",
          sections: [
            ["Service scope", "PaperMint provides issuer and customer management, invoices, quotes, PDFs, secure sharing, expenses, receipt attachments, payment-account classification, vehicle logbooks, cashflow views, BAS preparation and FY accountant packs. PaperMint does not collect your customer payments or lodge reports with the ATO."],
            ["No professional advice", "Calculations, GST labels, vehicle business-use allocations, return or loss records and BAS files are for preparation and reconciliation only. They are not accounting, tax or legal advice. You remain responsible for ABNs, GST, classifications, credit eligibility, record retention and lodgement, and should obtain professional advice where appropriate."],
            ["Account responsibility", "Keep your sign-in details secure and take responsibility for content created or sent from your account. The service must not be used for fraud, infringement or unlawful activity."],
            ["Your content and licence", "You retain rights in content you enter or upload and grant PaperMint permission to host, process, copy and generate outputs from it only as needed to provide, protect and improve the service. You confirm that you are authorised to process customer, employee, driver, supplier and other third-party information."],
            ["Secure links and email", "Anyone holding a secure link may be able to view the related document. You are responsible for checking recipients, content and payment instructions. Email delivery, viewing events and reminders depend on third parties and are not guaranteed."],
            ["Free and paid plans", "The free plan currently includes every feature, allows 5 new invoices or quotes per Australian calendar week, and adds a PaperMint footer to output. Paid plans increase the limit and remove that footer, and can be managed or cancelled through Stripe."],
            ["Availability, backups and changes", "We aim to keep PaperMint reliable but cannot promise uninterrupted or error-free availability or permanent retention of any feature. Keep independent copies of records required for law or business. Material changes to features, prices or limits will be communicated with reasonable notice."],
            ["Suspension and termination", "We may limit or suspend service for security risks, unlawful use, material breach or legal compliance. You may stop using PaperMint and request account deletion, but charges accrued before termination remain payable."],
            ["Liability and consumer rights", "Consumer guarantees and other rights that cannot lawfully be excluded remain unaffected. To the extent permitted by law, PaperMint is not liable for indirect or consequential loss arising from incorrect inputs, tax or business decisions, lost records, unauthorised link access or third-party interruptions."]
          ]
        };

  return (
    <main className="min-h-screen bg-[#f5f7f4] px-4 py-5 sm:px-6">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-4"><Link href="/login"><Brand /></Link><LanguageSwitch /></header>
      <article className="mx-auto my-10 max-w-4xl rounded-lg border border-[var(--line)] bg-white p-6 sm:p-10">
        <p className="text-sm font-black text-[var(--mint-dark)]">PaperMint</p>
        <h1 className="mt-2 text-4xl font-black tracking-normal">{content.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">{content.intro}</p>
        <p className="mt-3 text-xs font-bold text-[var(--muted)]">{language === "zh" ? "最后更新：2026 年 7 月 21 日" : "Last updated: 21 July 2026"}</p>
        <div className="mt-9 grid gap-8">
          {content.sections.map(([title, body]) => <section key={title}><h2 className="text-xl font-black tracking-normal">{title}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p></section>)}
        </div>
        <div className="mt-10 border-t border-[var(--line)] pt-5"><Link className="font-black text-[var(--mint-dark)]" href="/login">← {language === "zh" ? "返回 PaperMint" : "Back to PaperMint"}</Link></div>
      </article>
    </main>
  );
}
