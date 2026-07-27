"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Plus, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import { fetchInventoryMovements, fetchInventoryProducts, recordInventoryMovement, upsertInventoryProduct } from "@/lib/api";
import { formatAud } from "@/lib/calculations";
import { pickLanguage } from "@/lib/i18n";
import type { InventoryMovement, InventoryMovementType, InventoryProduct } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

export default function InventoryPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [product, setProduct] = useState({ sku: "", name: "", description: "", unit: "each", salePrice: "0", reorder: "0", gst: true });
  const [movement, setMovement] = useState({ productId: "", type: "purchase" as InventoryMovementType, quantity: "1", cost: "0", date: today(), reference: "", notes: "" });

  const movementLabels: Record<InventoryMovementType, string> = {
    opening: copy({ en: "Opening balance", zh: "期初库存" }),
    purchase: copy({ en: "Stock purchased", zh: "采购入库" }),
    sale: copy({ en: "Sold on invoice", zh: "发票销售出库" }),
    customer_return: copy({ en: "Customer return", zh: "客户退货入库" }),
    supplier_return: copy({ en: "Returned to supplier", zh: "退回供应商" }),
    loss: copy({ en: "Damaged / lost", zh: "损坏／损耗" }),
    adjustment: copy({ en: "Stock correction", zh: "库存更正" }),
    reversal: copy({ en: "Reversal", zh: "冲销" })
  };

  const reload = useCallback(async () => {
    if (!user) return;
    const [nextProducts, nextMovements] = await Promise.all([
      fetchInventoryProducts(user.id),
      fetchInventoryMovements(user.id)
    ]);
    setProducts(nextProducts);
    setMovements(nextMovements);
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  const inventoryValue = useMemo(
    () => products.reduce((sum, item) => sum + item.quantity_on_hand * item.average_cost, 0),
    [products]
  );
  const lowStock = products.filter((item) => item.track_inventory && item.quantity_on_hand <= item.reorder_level);

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!user || !product.name.trim() || !product.sku.trim()) return;
    await upsertInventoryProduct(user.id, {
      name: product.name.trim(),
      sku: product.sku.trim(),
      description: product.description || null,
      unit: product.unit || "each",
      sale_price: Number(product.salePrice),
      reorder_level: Number(product.reorder),
      gst_enabled: product.gst,
      track_inventory: true
    });
    setProduct({ sku: "", name: "", description: "", unit: "each", salePrice: "0", reorder: "0", gst: true });
    setProductOpen(false);
    await reload();
    showToast(copy({ en: "Product saved.", zh: "商品已保存。" }));
  }

  async function saveMovement(event: FormEvent) {
    event.preventDefault();
    if (!user || !movement.productId) return;
    const quantity = Math.abs(Number(movement.quantity));
    const negative = ["sale", "supplier_return", "loss"].includes(movement.type);
    await recordInventoryMovement(user.id, {
      product_id: movement.productId,
      movement_type: movement.type,
      quantity_delta: negative ? -quantity : quantity,
      unit_cost: Number(movement.cost),
      movement_date: movement.date,
      reference: movement.reference || null,
      notes: movement.notes || null,
      source_type: "manual",
      source_id: null
    });
    setMovement((value) => ({ ...value, quantity: "1", cost: "0", reference: "", notes: "" }));
    setMovementOpen(false);
    await reload();
    showToast(copy({ en: "Stock movement recorded.", zh: "库存变动已记录。" }));
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <main className="grid gap-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1>{copy({ en: "Inventory", zh: "库存" })}</h1>
              <p className="subtitle">
                {copy({
                  en: "Products, current stock and a clear history of every change.",
                  zh: "集中管理商品、当前库存，以及每一次库存变动记录。"
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => setMovementOpen(!movementOpen)} type="button">
                <TrendingUp className="h-4 w-4" />
                {copy({ en: "Record stock change", zh: "记录库存变动" })}
              </button>
              <button className="btn-primary" onClick={() => setProductOpen(!productOpen)} type="button">
                <Plus className="h-4 w-4" />
                {copy({ en: "New product", zh: "新建商品" })}
              </button>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-3">
            <Metric label={copy({ en: "Products", zh: "商品数量" })} value={String(products.length)} />
            <Metric label={copy({ en: "Stock value (average cost)", zh: "库存价值（平均成本）" })} value={formatAud(inventoryValue)} />
            <Metric label={copy({ en: "Need attention / reorder", zh: "需要补货" })} value={String(lowStock.length)} warn={lowStock.length > 0} />
          </section>

          {productOpen ? (
            <form className="panel grid gap-3 p-5 md:grid-cols-3" onSubmit={saveProduct}>
              <h2 className="md:col-span-3">{copy({ en: "New product", zh: "新建商品" })}</h2>
              <Field label="SKU *" value={product.sku} onChange={(sku) => setProduct({ ...product, sku })} />
              <Field label={copy({ en: "Product name *", zh: "商品名称 *" })} value={product.name} onChange={(name) => setProduct({ ...product, name })} />
              <Field label={copy({ en: "Unit", zh: "计量单位" })} value={product.unit} onChange={(unit) => setProduct({ ...product, unit })} />
              <Field label={copy({ en: "Sale price", zh: "销售价格" })} type="number" value={product.salePrice} onChange={(salePrice) => setProduct({ ...product, salePrice })} />
              <Field label={copy({ en: "Reorder level", zh: "补货提醒数量" })} type="number" value={product.reorder} onChange={(reorder) => setProduct({ ...product, reorder })} />
              <Field label={copy({ en: "Description", zh: "商品描述" })} value={product.description} onChange={(description) => setProduct({ ...product, description })} />
              <label className="flex items-center gap-2 font-bold">
                <input checked={product.gst} onChange={(event) => setProduct({ ...product, gst: event.target.checked })} type="checkbox" />
                {copy({ en: "GST applies", zh: "适用 GST" })}
              </label>
              <button className="btn-primary md:col-start-3" type="submit">{copy({ en: "Save product", zh: "保存商品" })}</button>
            </form>
          ) : null}

          {movementOpen ? (
            <form className="panel grid gap-3 p-5 md:grid-cols-3" onSubmit={saveMovement}>
              <div className="md:col-span-3">
                <h2>{copy({ en: "Record stock change", zh: "记录库存变动" })}</h2>
                <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                  {copy({ en: "Invoice sales are recorded automatically when an invoice is marked Sent.", zh: "发票标记为 Sent 后，相关商品会自动扣减，无需在这里重复记录。" })}
                </p>
              </div>
              <label>
                <span className="label">{copy({ en: "Product", zh: "商品" })}</span>
                <select className="field" required value={movement.productId} onChange={(event) => setMovement({ ...movement, productId: event.target.value })}>
                  <option value="">{copy({ en: "Select product", zh: "选择商品" })}</option>
                  {products.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}
                </select>
              </label>
              <label>
                <span className="label">{copy({ en: "What changed?", zh: "变动原因" })}</span>
                <select className="field" value={movement.type} onChange={(event) => setMovement({ ...movement, type: event.target.value as InventoryMovementType })}>
                  {(["purchase", "customer_return", "supplier_return", "loss", "adjustment", "opening"] as InventoryMovementType[]).map((type) => (
                    <option key={type} value={type}>{movementLabels[type]}</option>
                  ))}
                </select>
              </label>
              <Field label={copy({ en: "Quantity", zh: "数量" })} type="number" value={movement.quantity} onChange={(quantity) => setMovement({ ...movement, quantity })} />
              <Field label={copy({ en: "Unit cost", zh: "单位成本" })} type="number" value={movement.cost} onChange={(cost) => setMovement({ ...movement, cost })} />
              <Field label={copy({ en: "Date", zh: "日期" })} type="date" value={movement.date} onChange={(date) => setMovement({ ...movement, date })} />
              <Field label={copy({ en: "Reference", zh: "参考编号" })} value={movement.reference} onChange={(reference) => setMovement({ ...movement, reference })} />
              <Field label={copy({ en: "Notes", zh: "备注" })} value={movement.notes} onChange={(notes) => setMovement({ ...movement, notes })} />
              <button className="btn-primary md:col-start-3" type="submit">{copy({ en: "Save stock change", zh: "保存库存变动" })}</button>
            </form>
          ) : null}

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] p-5"><h2>{copy({ en: "Products", zh: "商品" })}</h2></div>
            {products.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr><Th>SKU / {copy({ en: "Product", zh: "商品" })}</Th><Th>{copy({ en: "On hand", zh: "当前库存" })}</Th><Th>{copy({ en: "Average cost", zh: "平均成本" })}</Th><Th>{copy({ en: "Sale price", zh: "销售价格" })}</Th><Th>{copy({ en: "Stock value", zh: "库存价值" })}</Th></tr></thead>
                  <tbody>{products.map((item) => (
                    <tr className="border-t border-[var(--line)]" key={item.id}>
                      <Td><b>{item.sku}</b><div className="text-[var(--muted)]">{item.name}</div></Td>
                      <Td><span className={item.quantity_on_hand <= item.reorder_level ? "font-black text-amber-700" : "font-black"}>{item.quantity_on_hand.toFixed(3).replace(/\.000$/, "")} {item.unit}</span></Td>
                      <Td>{formatAud(item.average_cost)}</Td><Td>{formatAud(item.sale_price)}</Td><Td>{formatAud(item.quantity_on_hand * item.average_cost)}</Td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <Empty>{copy({ en: "No products yet.", zh: "暂时没有商品。" })}</Empty>}
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--line)] p-5"><h2>{copy({ en: "Stock change history", zh: "库存变动历史" })}</h2></div>
            {movements.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr><Th>{copy({ en: "Date", zh: "日期" })}</Th><Th>{copy({ en: "Product", zh: "商品" })}</Th><Th>{copy({ en: "Reason", zh: "原因" })}</Th><Th>{copy({ en: "Quantity", zh: "数量" })}</Th><Th>{copy({ en: "Reference", zh: "参考编号" })}</Th></tr></thead>
                  <tbody>{movements.map((item) => {
                    const matchedProduct = products.find((productRow) => productRow.id === item.product_id);
                    return (
                      <tr className="border-t border-[var(--line)]" key={item.id}>
                        <Td>{item.movement_date}</Td><Td>{matchedProduct?.name ?? copy({ en: "Deleted product", zh: "已删除商品" })}</Td>
                        <Td>{movementLabels[item.movement_type]}</Td>
                        <Td><span className={item.quantity_delta < 0 ? "font-black text-[var(--rose)]" : "font-black text-[var(--mint-dark)]"}>{item.quantity_delta > 0 ? "+" : ""}{item.quantity_delta}</span></Td>
                        <Td>{item.reference || "—"}</Td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            ) : <Empty>{copy({ en: "No stock changes yet.", zh: "暂时没有库存变动。" })}</Empty>}
          </section>
        </main>
      </AppShell>
    </ProtectedRoute>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <div className="panel p-5"><p className="label">{label}</p><p className={`mt-1 text-3xl font-black ${warn ? "text-amber-700" : ""}`}>{value}</p></div>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="label">{label}</span><input className="field" min={type === "number" ? "0" : undefined} onChange={(event) => onChange(event.target.value)} step={type === "number" ? "0.001" : undefined} type={type} value={value} /></label>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 text-xs uppercase text-[var(--muted)]">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3 text-sm">{children}</td>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center gap-2 p-10 text-center text-[var(--muted)]"><Boxes className="h-8 w-8" /><p className="font-bold">{children}</p></div>;
}
