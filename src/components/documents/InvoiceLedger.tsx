"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Pencil, Plus, ReceiptText, RotateCcw, X } from "lucide-react";
import {
  fetchCreditNotes,
  fetchInvoicePayments,
  fetchInventoryProducts,
  fetchPaymentAccounts,
  issueCreditNote,
  recordInvoicePayment,
  replaceCreditNote,
  replaceInvoicePayment,
  reverseInvoicePayment,
  voidCreditNote
} from "@/lib/api";
import { formatAud } from "@/lib/calculations";
import { pickLanguage } from "@/lib/i18n";
import type { CreditNote, InventoryProduct, InvoicePayment, PaperDocument, PaymentAccount } from "@/lib/types";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";

type Panel = "payment" | "adjustment" | null;

const today = () => new Date().toISOString().slice(0, 10);

export function InvoiceLedger({
  userId,
  document,
  total,
  onChanged
}: {
  userId: string;
  document: PaperDocument;
  total: number;
  onChanged: () => Promise<void> | void;
}) {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);
  const [payment, setPayment] = useState({ amount: "", date: today(), account: "", reference: "", notes: "" });
  const [credit, setCredit] = useState({
    total: "",
    date: today(),
    reason: "returned_goods",
    details: "",
    product: "",
    quantity: "",
    includesGst: document.gstEnabled
  });
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!document.id) return;
    const [nextPayments, nextCredits, nextAccounts, nextProducts] = await Promise.all([
      fetchInvoicePayments(userId, document.id),
      fetchCreditNotes(userId, document.id),
      fetchPaymentAccounts(userId),
      fetchInventoryProducts(userId)
    ]);
    setPayments(nextPayments);
    setCredits(nextCredits);
    setAccounts(nextAccounts);
    setProducts(nextProducts);
  }, [document.id, userId]);

  useEffect(() => { void reload(); }, [reload]);

  const paid = useMemo(() => payments.reduce((sum, item) => sum + Number(item.amount), 0), [payments]);
  const credited = useMemo(
    () => credits.filter((item) => item.status === "issued").reduce((sum, item) => sum + Number(item.total), 0),
    [credits]
  );
  const due = Math.max(0, total - paid - credited);
  const gstAmount = credit.includesGst && document.gstRate > 0
    ? Number(credit.total || 0) * document.gstRate / (100 + document.gstRate)
    : 0;

  const reasonOptions = [
    { value: "returned_goods", label: copy({ en: "Customer returned goods", zh: "客户退货", vi: "Khách trả hàng", ar: "إرجاع بضائع" }) },
    { value: "price_correction", label: copy({ en: "Price correction", zh: "价格更正", vi: "Điều chỉnh giá", ar: "تصحيح السعر" }) },
    { value: "service_issue", label: copy({ en: "Service issue / goodwill", zh: "服务问题／善意折让", vi: "Vấn đề dịch vụ", ar: "مشكلة خدمة" }) },
    { value: "other", label: copy({ en: "Other reason", zh: "其他原因", vi: "Lý do khác", ar: "سبب آخر" }) }
  ];

  function closePanel() {
    setPanel(null);
    setEditingPaymentId(null);
    setEditingCreditId(null);
    setPayment({ amount: "", date: today(), account: "", reference: "", notes: "" });
    setCredit({ total: "", date: today(), reason: "returned_goods", details: "", product: "", quantity: "", includesGst: document.gstEnabled });
  }

  async function savePayment() {
    if (!document.id || Number(payment.amount) <= 0) return;
    setBusy(true);
    try {
      const payload = {
        amount: Number(payment.amount),
        payment_date: payment.date,
        payment_account_id: payment.account || null,
        reference: payment.reference || null,
        notes: payment.notes || null
      };
      if (editingPaymentId) {
        await replaceInvoicePayment(userId, editingPaymentId, payload);
      } else {
        await recordInvoicePayment(userId, { ...payload, document_id: document.id });
      }
      closePanel();
      await reload();
      await onChanged();
      showToast(copy({ en: "Payment saved.", zh: "收款记录已保存。", vi: "Đã lưu thanh toán.", ar: "تم حفظ الدفعة." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save payment.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveAdjustment() {
    if (!document.id || Number(credit.total) <= 0 || !credit.details.trim()) return;
    setBusy(true);
    try {
      const payload = {
        issue_date: credit.date,
        description: credit.details.trim(),
        reason: credit.reason,
        total: Number(credit.total),
        gst_amount: gstAmount,
        inventory_product_id: credit.product || null,
        inventory_quantity: credit.product ? Number(credit.quantity) || 0 : null
      };
      if (editingCreditId) {
        await replaceCreditNote(userId, editingCreditId, payload);
      } else {
        await issueCreditNote(userId, { ...payload, document_id: document.id });
      }
      closePanel();
      await reload();
      await onChanged();
      showToast(copy({ en: "Refund / adjustment saved.", zh: "退款／折让记录已保存。", vi: "Đã lưu khoản điều chỉnh.", ar: "تم حفظ التعديل." }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save adjustment.", "error");
    } finally {
      setBusy(false);
    }
  }

  function editPayment(item: InvoicePayment) {
    setEditingPaymentId(item.id);
    setPayment({
      amount: String(item.amount),
      date: item.payment_date,
      account: item.payment_account_id ?? "",
      reference: item.reference ?? "",
      notes: item.notes ?? ""
    });
    setPanel("payment");
  }

  function editCredit(item: CreditNote) {
    setEditingCreditId(item.id);
    setCredit({
      total: String(item.total),
      date: item.issue_date,
      reason: reasonOptions.some((option) => option.value === item.reason) ? item.reason : "other",
      details: item.description,
      product: item.inventory_product_id ?? "",
      quantity: item.inventory_quantity ? String(item.inventory_quantity) : "",
      includesGst: Number(item.gst_amount) > 0
    });
    setPanel("adjustment");
  }

  const reversedPaymentIds = new Set(payments.map((item) => item.reverses_payment_id).filter(Boolean));

  return (
    <section className="panel mt-5 grid gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2>{copy({ en: "Invoice payments", zh: "发票收款", vi: "Thanh toán hóa đơn", ar: "مدفوعات الفاتورة" })}</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[var(--muted)]">
            {copy({
              en: "Record money received, or reduce what the customer owes after a return, refund or price correction.",
              zh: "记录客户实际支付的款项；如发生退货、退款或价格更正，也可以直接减少客户应付金额。",
              vi: "Ghi tiền đã nhận hoặc giảm số tiền khách còn nợ sau hoàn trả hay điều chỉnh.",
              ar: "سجّل المبلغ المستلم أو خفّض المبلغ المستحق بعد الإرجاع أو التصحيح."
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => { closePanel(); setPayment((value) => ({ ...value, amount: due > 0 ? String(due.toFixed(2)) : "" })); setPanel("payment"); }} type="button">
            <Plus className="h-4 w-4" />
            {copy({ en: "Add payment", zh: "记录收款", vi: "Thêm thanh toán", ar: "إضافة دفعة" })}
          </button>
          <button className="btn-secondary" onClick={() => { closePanel(); setPanel("adjustment"); }} type="button">
            <ReceiptText className="h-4 w-4" />
            {copy({ en: "Refund / adjustment", zh: "退货、退款或折让", vi: "Hoàn tiền / điều chỉnh", ar: "استرداد / تعديل" })}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label={copy({ en: "Invoice total", zh: "发票总额" })} value={formatAud(total)} />
        <Metric label={copy({ en: "Money received", zh: "已收款" })} value={formatAud(paid)} />
        <Metric label={copy({ en: "Refunds / adjustments", zh: "退款／折让" })} value={formatAud(credited)} />
        <Metric label={copy({ en: "Customer still owes", zh: "客户仍需支付" })} value={formatAud(due)} strong />
      </div>

      {panel === "payment" ? (
        <div className="rounded-lg border border-[#bcdccb] bg-[#f7fbf8] p-4">
          <PanelHeader
            onClose={closePanel}
            title={editingPaymentId
              ? copy({ en: "Correct payment record", zh: "修改收款记录" })
              : copy({ en: "Add money received", zh: "记录收到的款项" })}
          />
          {editingPaymentId ? (
            <Hint>{copy({ en: "The original entry is kept in history and replaced with this corrected version.", zh: "为保留审计记录，原记录会标记为已冲销，并新增一条更正后的记录。" })}</Hint>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input label={copy({ en: "Amount received", zh: "收到金额" })} type="number" value={payment.amount} onChange={(amount) => setPayment({ ...payment, amount })} />
            <Input label={copy({ en: "Date received", zh: "收款日期" })} type="date" value={payment.date} onChange={(date) => setPayment({ ...payment, date })} />
            <label>
              <span className="label">{copy({ en: "Paid into", zh: "收款账户" })}</span>
              <select className="field" value={payment.account} onChange={(event) => setPayment({ ...payment, account: event.target.value })}>
                <option value="">{copy({ en: "Not specified", zh: "未指定" })}</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <Input label={copy({ en: "Reference (optional)", zh: "参考编号（可选）" })} value={payment.reference} onChange={(reference) => setPayment({ ...payment, reference })} />
            <Input label={copy({ en: "Note (optional)", zh: "备注（可选）" })} value={payment.notes} onChange={(notes) => setPayment({ ...payment, notes })} />
          </div>
          <button className="btn-primary mt-3" disabled={busy || Number(payment.amount) <= 0} onClick={savePayment} type="button">
            <CreditCard className="h-4 w-4" />
            {copy({ en: "Save payment", zh: "保存收款" })}
          </button>
        </div>
      ) : null}

      {panel === "adjustment" ? (
        <div className="rounded-lg border border-[#ead9b3] bg-[#fffaf0] p-4">
          <PanelHeader
            onClose={closePanel}
            title={editingCreditId
              ? copy({ en: "Correct refund / adjustment", zh: "修改退款／折让记录" })
              : copy({ en: "Reduce the amount the customer owes", zh: "减少客户应付金额" })}
          />
          <Hint>
            {copy({
              en: "Use this when goods are returned, you give a refund or discount after invoicing, or the original price was wrong. PaperMint creates the credit note for you.",
              zh: "适用于客户退货、开票后退款或折让、原价格错误等情况。PaperMint 会自动生成 Credit Note，无需了解税务术语。"
            })}
          </Hint>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label={copy({ en: "Amount to reduce", zh: "减少金额" })} type="number" value={credit.total} onChange={(value) => setCredit({ ...credit, total: value })} />
            <Input label={copy({ en: "Date", zh: "日期" })} type="date" value={credit.date} onChange={(value) => setCredit({ ...credit, date: value })} />
            <label>
              <span className="label">{copy({ en: "What happened?", zh: "发生了什么？" })}</span>
              <select className="field" value={credit.reason} onChange={(event) => setCredit({ ...credit, reason: event.target.value })}>
                {reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <Input label={copy({ en: "Short explanation *", zh: "简要说明 *" })} value={credit.details} onChange={(value) => setCredit({ ...credit, details: value })} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-bold">
              <input checked={credit.includesGst} onChange={(event) => setCredit({ ...credit, includesGst: event.target.checked })} type="checkbox" />
              {copy({ en: "Amount includes GST", zh: "金额包含 GST" })}
            </label>
            <label>
              <span className="label">{copy({ en: "Returned product (optional)", zh: "退回库存商品（可选）" })}</span>
              <select className="field" value={credit.product} onChange={(event) => setCredit({ ...credit, product: event.target.value })}>
                <option value="">{copy({ en: "No stock returned", zh: "不退回库存" })}</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
              </select>
            </label>
            {credit.product ? (
              <Input label={copy({ en: "Quantity returned", zh: "退回数量" })} type="number" value={credit.quantity} onChange={(value) => setCredit({ ...credit, quantity: value })} />
            ) : <div />}
          </div>
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
            {copy({ en: `GST adjustment calculated automatically: ${formatAud(gstAmount)}`, zh: `自动计算 GST 调整额：${formatAud(gstAmount)}` })}
          </p>
          <button className="btn-primary mt-3" disabled={busy || Number(credit.total) <= 0 || !credit.details.trim()} onClick={saveAdjustment} type="button">
            {copy({ en: "Save refund / adjustment", zh: "保存退款／折让" })}
          </button>
        </div>
      ) : null}

      {payments.length || credits.length ? (
        <div className="overflow-x-auto">
          <h3 className="mb-2 font-black">{copy({ en: "Activity history", zh: "记录历史" })}</h3>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr><Th>{copy({ en: "Date", zh: "日期" })}</Th><Th>{copy({ en: "Type", zh: "类型" })}</Th><Th>{copy({ en: "Details", zh: "明细" })}</Th><Th>{copy({ en: "Amount", zh: "金额" })}</Th><Th>{copy({ en: "Actions", zh: "操作" })}</Th></tr></thead>
            <tbody>
              {payments.map((item) => {
                const reversed = item.entry_type === "payment" && reversedPaymentIds.has(item.id);
                const active = item.entry_type === "payment" && !reversed;
                return (
                  <tr className={`border-t border-[var(--line)] ${!active ? "text-[var(--muted)]" : ""}`} key={item.id}>
                    <Td>{item.payment_date}</Td>
                    <Td>{item.entry_type === "reversal" ? copy({ en: "Payment correction", zh: "收款冲销" }) : copy({ en: "Payment received", zh: "收到款项" })}</Td>
                    <Td>{item.reference || item.notes || "—"}{reversed ? <span className="ml-2 rounded bg-[#eef2ef] px-2 py-0.5 text-xs">{copy({ en: "Replaced", zh: "已更正" })}</span> : null}</Td>
                    <Td><span className={item.amount < 0 ? "text-[var(--rose)]" : "font-black"}>{formatAud(item.amount)}</span></Td>
                    <Td>{active ? <div className="flex gap-1"><Action title={copy({ en: "Edit", zh: "修改" })} onClick={() => editPayment(item)}><Pencil className="h-4 w-4" /></Action><Action title={copy({ en: "Reverse", zh: "冲销" })} onClick={async () => {
                      if (!window.confirm(copy({ en: "Reverse this payment?", zh: "确认冲销这笔收款吗？" }))) return;
                      await reverseInvoicePayment(userId, item.id);
                      await reload(); await onChanged();
                    }}><RotateCcw className="h-4 w-4" /></Action></div> : "—"}</Td>
                  </tr>
                );
              })}
              {credits.map((item) => (
                <tr className={`border-t border-[var(--line)] ${item.status === "void" ? "text-[var(--muted)]" : ""}`} key={item.id}>
                  <Td>{item.issue_date}</Td>
                  <Td>{copy({ en: "Refund / adjustment", zh: "退款／折让" })}</Td>
                  <Td>{item.number} · {item.description}{item.status === "void" ? <span className="ml-2 rounded bg-[#eef2ef] px-2 py-0.5 text-xs">{copy({ en: "Voided", zh: "已作废" })}</span> : null}</Td>
                  <Td><span className="font-black text-[var(--rose)]">-{formatAud(item.total)}</span></Td>
                  <Td>{item.status === "issued" ? <div className="flex gap-1"><Action title={copy({ en: "Edit", zh: "修改" })} onClick={() => editCredit(item)}><Pencil className="h-4 w-4" /></Action><Action title={copy({ en: "Void", zh: "作废" })} onClick={async () => {
                    if (!window.confirm(copy({ en: "Void this refund / adjustment?", zh: "确认作废这条退款／折让记录吗？" }))) return;
                    await voidCreditNote(userId, item.id);
                    await reload(); await onChanged();
                  }}><X className="h-4 w-4" /></Action></div> : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--line)] p-5 text-center text-sm font-semibold text-[var(--muted)]">
          {copy({ en: "No payments or adjustments yet.", zh: "暂时没有收款或退款／折让记录。" })}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`rounded-lg border border-[var(--line)] p-3 ${strong ? "bg-[#eef7f2]" : ""}`}><p className="label">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}
function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="label">{label}</span><input className="field" min={type === "number" ? "0" : undefined} onChange={(event) => onChange(event.target.value)} step={type === "number" ? "0.01" : undefined} type={type} value={value} /></label>;
}
function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="flex items-center justify-between gap-3"><h3 className="font-black">{title}</h3><button className="icon-btn" onClick={onClose} title="Close" type="button"><X className="h-4 w-4" /></button></div>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">{children}</p>;
}
function Action({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return <button className="icon-btn h-8 w-8" onClick={onClick} title={title} type="button">{children}</button>;
}
function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-xs uppercase text-[var(--muted)]">{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
