"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, Edit3, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import {
  deleteCompanyProfile,
  fetchCompanyProfiles,
  fetchProfile,
  saveProfile,
  upsertCompanyProfile
} from "@/lib/api";
import { defaultCompanyProfile } from "@/lib/documents";
import { uploadLogo } from "@/lib/storage";
import { pickLanguage } from "@/lib/i18n";
import type { CompanyProfile, CompanyRecord } from "@/lib/types";

type CompanyForm = {
  id?: string;
  business_name: string;
  email: string;
  phone: string;
  abn: string;
  address: string;
  logo_url: string;
  is_default: boolean;
};

const emptyCompanyForm: CompanyForm = {
  business_name: "",
  email: "",
  phone: "",
  abn: "",
  address: "",
  logo_url: "",
  is_default: false
};

function toCompanyForm(company: CompanyRecord): CompanyForm {
  return {
    id: company.id,
    business_name: company.business_name,
    email: company.email ?? "",
    phone: company.phone ?? "",
    abn: company.abn ?? "",
    address: company.address ?? "",
    logo_url: company.logo_url ?? "",
    is_default: company.is_default
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const [profile, setProfile] = useState<CompanyProfile>(defaultCompanyProfile);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [row, companyRows] = await Promise.all([
        fetchProfile(user.id),
        fetchCompanyProfiles(user.id)
      ]);
      setCompanies(companyRows);
      if (row) {
        setProfile({
          business_name: row.business_name ?? "",
          email: row.email ?? "",
          phone: row.phone ?? "",
          abn: row.abn ?? "",
          address: row.address ?? "",
          logo_url: row.logo_url ?? "",
          default_payment_methods:
            row.default_payment_methods ?? defaultCompanyProfile.default_payment_methods,
          default_notes: row.default_notes ?? defaultCompanyProfile.default_notes
        });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      await saveProfile(user.id, profile);
      if (profile.business_name) {
        const currentDefault = companies.find((company) => company.is_default);
        const savedCompany = await upsertCompanyProfile(user.id, {
          id: currentDefault?.id,
          business_name: profile.business_name,
          email: profile.email,
          phone: profile.phone,
          abn: profile.abn,
          address: profile.address,
          logo_url: profile.logo_url,
          is_default: true
        });
        setCompanies((current) => [
          savedCompany,
          ...current.filter((company) => company.id !== savedCompany.id).map((company) => ({
            ...company,
            is_default: false
          }))
        ]);
      }
      const success = copy({ en: "Company defaults saved.", zh: "默认公司资料已保存。", vi: "Đã lưu thông tin công ty mặc định.", ar: "تم حفظ بيانات الشركة الافتراضية." });
      setMessage(success);
      showToast(success);
    } catch (error) {
      const issue = error instanceof Error ? error.message : "Unable to save settings.";
      setMessage(issue);
      showToast(issue, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompanySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      const saved = await upsertCompanyProfile(user.id, companyForm);
      setCompanies((current) => [
        saved,
        ...current.filter((company) => company.id !== saved.id).map((company) =>
          saved.is_default ? { ...company, is_default: false } : company
        )
      ]);
      setCompanyForm(emptyCompanyForm);
      const success = copy({ en: "Issuer profile saved.", zh: "开票方资料已保存。", vi: "Đã lưu hồ sơ bên phát hành.", ar: "تم حفظ ملف جهة الإصدار." });
      setMessage(success);
      showToast(success);
    } catch (error) {
      const issue = error instanceof Error ? error.message : "Unable to save issuer profile.";
      setMessage(issue);
      showToast(issue, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompanyDelete(company: CompanyRecord) {
    if (!user) return;
    const ok = window.confirm(
      copy({ en: `Delete ${company.business_name}?`, zh: `删除开票方 ${company.business_name}？`, vi: `Xóa bên phát hành ${company.business_name}?`, ar: `حذف جهة الإصدار ${company.business_name}؟` })
    );
    if (!ok) return;
    try {
      await deleteCompanyProfile(user.id, company.id);
      setCompanies((current) => current.filter((item) => item.id !== company.id));
      showToast(copy({ en: "Issuer profile deleted.", zh: "开票方资料已删除。", vi: "Đã xóa hồ sơ bên phát hành.", ar: "تم حذف ملف جهة الإصدار." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to delete issuer profile.", "error");
    }
  }

  async function handleLogo(file: File | undefined) {
    if (!file || !user) return;
    setSaving(true);
    setMessage("");
    try {
      const url = await uploadLogo(file, user.id);
      setProfile((current) => ({ ...current, logo_url: url }));
      const success = copy({ en: "Logo uploaded. Save settings to keep it as default.", zh: "Logo 已上传，记得保存设置。", vi: "Đã tải logo lên. Hãy lưu để đặt làm mặc định.", ar: "تم رفع الشعار. احفظ الإعدادات لاستخدامه افتراضياً." });
      setMessage(success);
      showToast(success);
    } catch (error) {
      const issue = error instanceof Error ? error.message : "Unable to upload logo.";
      setMessage(issue);
      showToast(issue, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="panel p-5 sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e8f4ef] text-[var(--mint-dark)]">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-normal">{t("companyDefaults")}</h1>
              <p className="text-sm font-semibold text-[var(--muted)]">
                {copy({ en: "These details prefill every new document.", zh: "新建单据时自动填入这些资料。", vi: "Thông tin này được điền sẵn cho mỗi chứng từ mới.", ar: "تُملأ هذه البيانات تلقائياً في كل مستند جديد." })}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy({ en: "Loading settings", zh: "正在加载设置", vi: "Đang tải cài đặt", ar: "جارٍ تحميل الإعدادات" })}
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy({ en: "Business name", zh: "公司名称", vi: "Tên doanh nghiệp", ar: "اسم الشركة" })} value={profile.business_name} onChange={(value) => setProfile({ ...profile, business_name: value })} />
                <Field label="ABN" value={profile.abn} onChange={(value) => setProfile({ ...profile, abn: value })} />
                <Field label={t("email")} type="email" value={profile.email} onChange={(value) => setProfile({ ...profile, email: value })} />
                <Field label={copy({ en: "Phone", zh: "电话", vi: "Điện thoại", ar: "الهاتف" })} value={profile.phone} onChange={(value) => setProfile({ ...profile, phone: value })} />
              </div>
              <TextArea label={copy({ en: "Address", zh: "地址", vi: "Địa chỉ", ar: "العنوان" })} value={profile.address} onChange={(value) => setProfile({ ...profile, address: value })} />
              <TextArea label={t("paymentMethods")} value={profile.default_payment_methods} onChange={(value) => setProfile({ ...profile, default_payment_methods: value })} />
              <TextArea label={t("notes")} value={profile.default_notes} onChange={(value) => setProfile({ ...profile, default_notes: value })} />

              <div className="rounded-lg border border-[var(--line)] bg-white/70 p-4">
                <span className="label">{t("logo")}</span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {profile.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="Company logo" className="h-16 w-28 rounded-lg border border-[var(--line)] object-contain p-2" src={profile.logo_url} />
                  ) : (
                    <div className="grid h-16 w-28 place-items-center rounded-lg border border-dashed border-[var(--line)] text-xs font-bold text-[var(--muted)]">
                      Logo
                    </div>
                  )}
                  <label className="btn-secondary cursor-pointer">
                    <Upload className="h-4 w-4" />
                    {copy({ en: "Upload logo", zh: "上传 Logo", vi: "Tải logo lên", ar: "رفع الشعار" })}
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => handleLogo(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                </div>
              </div>

              {message && (
                <div className="rounded-lg border border-[var(--line)] bg-white/75 p-3 text-sm font-semibold text-[var(--muted)]">
                  {message}
                </div>
              )}

              <button className="btn-primary max-w-xs" disabled={saving} type="submit">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("save")}
              </button>
            </form>
          )}
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black tracking-normal">
                {copy({ en: "Issuer profiles", zh: "开票方资料", vi: "Hồ sơ bên phát hành", ar: "ملفات جهات الإصدار" })}
              </h2>
              <p className="text-sm font-semibold text-[var(--muted)]">
                {copy({ en: "Save multiple From profiles and choose one in the document editor.", zh: "像客户一样保存多个开票方，在创建发票时选择。", vi: "Lưu nhiều bên phát hành và chọn khi lập chứng từ.", ar: "احفظ عدة جهات إصدار واختر منها عند إنشاء المستند." })}
              </p>
            </div>
            <span className="rounded-lg bg-[#eef3ef] px-3 py-2 text-sm font-black text-[var(--muted)]">
              {companies.length}
            </span>
          </div>

          <form className="grid gap-3" onSubmit={handleCompanySubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={copy({ en: "Business name", zh: "公司名称", vi: "Tên doanh nghiệp", ar: "اسم الشركة" })} value={companyForm.business_name} onChange={(value) => setCompanyForm({ ...companyForm, business_name: value })} />
              <Field label="ABN" value={companyForm.abn} onChange={(value) => setCompanyForm({ ...companyForm, abn: value })} />
              <Field label={t("email")} type="email" value={companyForm.email} onChange={(value) => setCompanyForm({ ...companyForm, email: value })} />
              <Field label={copy({ en: "Phone", zh: "电话", vi: "Điện thoại", ar: "الهاتف" })} value={companyForm.phone} onChange={(value) => setCompanyForm({ ...companyForm, phone: value })} />
            </div>
            <TextArea label={copy({ en: "Address", zh: "地址", vi: "Địa chỉ", ar: "العنوان" })} value={companyForm.address} onChange={(value) => setCompanyForm({ ...companyForm, address: value })} />
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white/70 p-3 text-sm font-bold">
              <span>{copy({ en: "Default issuer", zh: "设为默认开票方", vi: "Bên phát hành mặc định", ar: "جهة الإصدار الافتراضية" })}</span>
              <input checked={companyForm.is_default} onChange={(event) => setCompanyForm({ ...companyForm, is_default: event.target.checked })} type="checkbox" />
            </label>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={saving || !companyForm.business_name} type="submit">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {companyForm.id ? t("save") : copy({ en: "Add issuer", zh: "添加开票方", vi: "Thêm bên phát hành", ar: "إضافة جهة إصدار" })}
              </button>
              {companyForm.id ? (
                <button className="btn-secondary" onClick={() => setCompanyForm(emptyCompanyForm)} type="button">
                  {copy({ en: "Cancel", zh: "取消", vi: "Hủy", ar: "إلغاء" })}
                </button>
              ) : null}
            </div>
          </form>

          <div className="mt-5 grid gap-3">
            {companies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--line)] p-6 text-center text-sm font-semibold text-[var(--muted)]">
                {copy({ en: "No issuer profiles saved yet.", zh: "还没有保存开票方。", vi: "Chưa có hồ sơ bên phát hành.", ar: "لا توجد ملفات جهات إصدار محفوظة بعد." })}
              </div>
            ) : (
              companies.map((company) => (
                <article className="rounded-lg border border-[var(--line)] bg-white/75 p-4" key={company.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-black tracking-normal">{company.business_name}</h3>
                        {company.is_default ? (
                          <span className="status-pill bg-emerald-50 text-emerald-700">Default</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                        {[company.email, company.phone, company.abn ? `ABN ${company.abn}` : ""]
                          .filter(Boolean)
                          .join(" · ") || "No contact details"}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                        {company.address || "No address"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="icon-btn" onClick={() => setCompanyForm(toCompanyForm(company))} title={t("edit")} type="button">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button className="icon-btn text-[var(--rose)]" onClick={() => handleCompanyDelete(company)} title={t("delete")} type="button">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="field" onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="field min-h-28 resize-y" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}
