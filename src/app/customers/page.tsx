"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Edit3, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import { deleteCustomer, fetchCustomers, upsertCustomer } from "@/lib/api";
import { pickLanguage } from "@/lib/i18n";
import type { Customer } from "@/lib/types";

type CustomerForm = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  abn: string;
  billing_address: string;
  shipping_address: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  abn: "",
  billing_address: "",
  shipping_address: "",
  notes: ""
};

function toForm(customer: Customer): CustomerForm {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    abn: customer.abn ?? "",
    billing_address: customer.billing_address ?? "",
    shipping_address: customer.shipping_address ?? "",
    notes: customer.notes ?? ""
  };
}

export default function CustomersPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadCustomers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setCustomers(await fetchCustomers(user.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      await upsertCustomer(user.id, form);
      setForm(emptyForm);
      await loadCustomers();
      const success = copy({ en: "Customer saved.", zh: "客户已保存。", vi: "Đã lưu khách hàng.", ar: "تم حفظ العميل." });
      setMessage(success);
      showToast(success);
    } catch (error) {
      const issue = error instanceof Error ? error.message : "Unable to save customer.";
      setMessage(issue);
      showToast(issue, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    if (!user) return;
    const ok = window.confirm(
      copy({ en: `Delete ${customer.name}?`, zh: `删除客户 ${customer.name}？`, vi: `Xóa khách hàng ${customer.name}?`, ar: `حذف العميل ${customer.name}؟` })
    );
    if (!ok) return;
    try {
      await deleteCustomer(user.id, customer.id);
      await loadCustomers();
      showToast(copy({ en: "Customer deleted.", zh: "客户已删除。", vi: "Đã xóa khách hàng.", ar: "تم حذف العميل." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to delete customer.", "error");
    }
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="panel p-5">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e8f4ef] text-[var(--mint-dark)]">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-normal">{t("customers")}</h1>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  {copy({ en: "Save reusable bill-to and ship-to details.", zh: "保存常用客户，创建单据时快速选择。", vi: "Lưu thông tin khách hàng để chọn nhanh khi lập chứng từ.", ar: "احفظ بيانات العملاء لاختيارها سريعاً عند إنشاء المستندات." })}
                </p>
              </div>
            </div>

            <form className="grid gap-3" onSubmit={handleSubmit}>
              <Field label={copy({ en: "Customer name", zh: "客户名称", vi: "Tên khách hàng", ar: "اسم العميل" })} required value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("email")} type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
                <Field label={copy({ en: "Phone", zh: "电话", vi: "Điện thoại", ar: "الهاتف" })} value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              </div>
              <Field label="ABN" value={form.abn} onChange={(value) => setForm({ ...form, abn: value })} />
              <TextArea label="Bill To" value={form.billing_address} onChange={(value) => setForm({ ...form, billing_address: value })} />
              <TextArea label="Ship To" value={form.shipping_address} onChange={(value) => setForm({ ...form, shipping_address: value })} />
              <TextArea label={t("notes")} value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={saving} type="submit">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {form.id ? t("save") : t("createCustomer")}
                </button>
                {form.id && (
                  <button className="btn-secondary" onClick={() => setForm(emptyForm)} type="button">
                    {copy({ en: "Cancel", zh: "取消", vi: "Hủy", ar: "إلغاء" })}
                  </button>
                )}
              </div>
            </form>

            {message && (
              <div className="mt-4 rounded-lg border border-[var(--line)] bg-white/75 p-3 text-sm font-semibold text-[var(--muted)]">
                {message}
              </div>
            )}
          </section>

          <section className="panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-normal">
                {copy({ en: "Customer list", zh: "客户列表", vi: "Danh sách khách hàng", ar: "قائمة العملاء" })}
              </h2>
              <span className="rounded-lg bg-[#eef3ef] px-3 py-2 text-sm font-black text-[var(--muted)]">
                {customers.length}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 text-sm font-semibold text-[var(--muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy({ en: "Loading customers", zh: "正在加载客户", vi: "Đang tải khách hàng", ar: "جارٍ تحميل العملاء" })}
              </div>
            ) : customers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm font-semibold text-[var(--muted)]">
                {copy({ en: "No customers yet.", zh: "还没有客户。", vi: "Chưa có khách hàng.", ar: "لا يوجد عملاء بعد." })}
              </div>
            ) : (
              <div className="grid gap-3">
                {customers.map((customer) => (
                  <article className="rounded-lg border border-[var(--line)] bg-white/80 p-4" key={customer.id}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black tracking-normal">{customer.name}</h3>
                        <p className="text-sm font-semibold text-[var(--muted)]">
                          {[customer.email, customer.phone, customer.abn].filter(Boolean).join(" · ") || "No contact details"}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                          {customer.billing_address || "No billing address"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="icon-btn" onClick={() => setForm(toForm(customer))} title={t("edit")} type="button">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button className="icon-btn text-[var(--rose)]" onClick={() => handleDelete(customer)} title={t("delete")} type="button">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
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
  required = false,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        className="field"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
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
      <textarea
        className="field min-h-24 resize-y"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}
