"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, ListPlus, Pencil, Plus, Search, TrendingUp, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { useAuth } from "@/components/app/AuthProvider";
import { useLanguage } from "@/components/app/LanguageProvider";
import { useToast } from "@/components/app/ToastProvider";
import { ProductSearchInput } from "@/components/inventory/ProductSearchInput";
import { fetchInventoryMovements, fetchInventoryProducts, recordInventoryMovement, upsertInventoryProduct } from "@/lib/api";
import { formatAud } from "@/lib/calculations";
import { pickLanguage } from "@/lib/i18n";
import { generateInventoryProducts, parseBulkProductLines } from "@/lib/inventory-products";
import type { InventoryMovement, InventoryMovementType, InventoryProduct } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

type ProductForm = {
  id?: string;
  sku: string;
  name: string;
  description: string;
  salePrice: string;
  reorder: string;
  gst: boolean;
  trackInventory: boolean;
  active: boolean;
};

const emptyProductForm: ProductForm = {
  sku: "",
  name: "",
  description: "",
  salePrice: "0",
  reorder: "0",
  gst: true,
  trackInventory: true,
  active: true
};

function toProductForm(product: InventoryProduct): ProductForm {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description ?? "",
    salePrice: String(product.sale_price),
    reorder: String(product.reorder_level),
    gst: product.gst_enabled,
    trackInventory: product.track_inventory,
    active: product.is_active
  };
}

export default function InventoryPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const copy = <T,>(values: { en: T; zh?: T; vi?: T; ar?: T }) => pickLanguage(language, values);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [product, setProduct] = useState<ProductForm>(emptyProductForm);
  const [productFilter, setProductFilter] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [bulkText, setBulkText] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
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
  const lowStock = products.filter((item) =>
    item.track_inventory &&
    item.reorder_level > 0 &&
    item.quantity_on_hand <= item.reorder_level
  );
  const filteredProducts = useMemo(() => {
    const query = productFilter.trim().toLocaleLowerCase();
    return products.filter((item) => {
      const matchesStatus = productStatusFilter === "all" ||
        (productStatusFilter === "active" ? item.is_active : !item.is_active);
      const matchesQuery = !query ||
        item.sku.toLocaleLowerCase().includes(query) ||
        item.name.toLocaleLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [productFilter, productStatusFilter, products]);
  const parsedBulk = useMemo(() => parseBulkProductLines(bulkText), [bulkText]);
  const generatedBulk = useMemo(
    () => generateInventoryProducts(
      parsedBulk.items,
      products.map((item) => item.sku)
    ),
    [parsedBulk.items, products]
  );

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!user || !product.name.trim() || !product.sku.trim()) return;
    if (products.some((item) =>
      item.id !== product.id &&
      item.sku.toUpperCase() === product.sku.trim().toUpperCase()
    )) {
      showToast(copy({ en: "That SKU is already used by another product.", zh: "该 SKU 已被其他商品使用。" }), "error");
      return;
    }
    setSavingProduct(true);
    try {
      await upsertInventoryProduct(user.id, {
        id: product.id,
        name: product.name.trim(),
        sku: product.sku.trim().toUpperCase(),
        description: product.description || null,
        sale_price: Number(product.salePrice),
        reorder_level: Number(product.reorder),
        gst_enabled: product.gst,
        track_inventory: product.trackInventory,
        is_active: product.active
      });
      setProduct(emptyProductForm);
      setProductOpen(false);
      await reload();
      showToast(copy({
        en: product.id ? "Product updated." : "Product saved.",
        zh: product.id ? "商品资料已更新。" : "商品已保存。"
      }));
    } catch (error) {
      const duplicate = error instanceof Error && /duplicate|unique|SKU_ALREADY_EXISTS/i.test(error.message);
      showToast(duplicate
        ? copy({ en: "That SKU is already used by another product.", zh: "该 SKU 已被其他商品使用。" })
        : error instanceof Error ? error.message : "Unable to save product.", "error");
    } finally {
      setSavingProduct(false);
    }
  }

  async function saveBulkProducts() {
    if (!user || generatedBulk.length === 0 || parsedBulk.errors.length > 0) return;
    setSavingBulk(true);
    try {
      for (const item of generatedBulk) {
        await upsertInventoryProduct(user.id, {
          name: item.name,
          sku: item.sku,
          description: item.description,
          sale_price: item.salePrice,
          reorder_level: 0,
          gst_enabled: true,
          track_inventory: true,
          is_active: true
        });
      }
      setBulkText("");
      setBulkOpen(false);
      await reload();
      showToast(copy({
        en: `${generatedBulk.length} products created.`,
        zh: `已批量创建 ${generatedBulk.length} 个商品。`
      }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to create products.", "error");
    } finally {
      setSavingBulk(false);
    }
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
              <button className="btn-secondary" onClick={() => {
                setBulkOpen((open) => !open);
                setProductOpen(false);
              }} type="button">
                <ListPlus className="h-4 w-4" />
                {copy({ en: "Bulk add products", zh: "批量生成商品" })}
              </button>
              <button className="btn-primary" onClick={() => {
                setProduct(emptyProductForm);
                setProductOpen(true);
                setBulkOpen(false);
              }} type="button">
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
              <div className="flex items-start justify-between gap-3 md:col-span-3">
                <div>
                  <h2>{product.id
                    ? copy({ en: "Edit product", zh: "修改商品资料" })
                    : copy({ en: "New product", zh: "新建商品" })}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    {copy({
                      en: "SKU must be unique. Changes apply to future invoice selections.",
                      zh: "SKU 必须唯一；修改后的资料会用于之后的 Invoice 商品选择。"
                    })}
                  </p>
                </div>
                <button className="icon-btn" onClick={() => {
                  setProductOpen(false);
                  setProduct(emptyProductForm);
                }} title={copy({ en: "Close", zh: "关闭" })} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Field label="SKU *" value={product.sku} onChange={(sku) => setProduct({ ...product, sku })} />
              <Field label={copy({ en: "Product name *", zh: "商品名称 *" })} value={product.name} onChange={(name) => setProduct({ ...product, name })} />
              <Field label={copy({ en: "Sale price", zh: "销售价格" })} type="number" value={product.salePrice} onChange={(salePrice) => setProduct({ ...product, salePrice })} />
              <Field label={copy({ en: "Reorder level", zh: "补货提醒数量" })} type="number" value={product.reorder} onChange={(reorder) => setProduct({ ...product, reorder })} />
              <Field label={copy({ en: "Description", zh: "商品描述" })} value={product.description} onChange={(description) => setProduct({ ...product, description })} />
              <label className="flex items-center gap-2 font-bold">
                <input checked={product.gst} onChange={(event) => setProduct({ ...product, gst: event.target.checked })} type="checkbox" />
                {copy({ en: "GST applies", zh: "适用 GST" })}
              </label>
              <label className="flex items-center gap-2 font-bold">
                <input checked={product.trackInventory} onChange={(event) => setProduct({ ...product, trackInventory: event.target.checked })} type="checkbox" />
                {copy({ en: "Track inventory", zh: "追踪库存数量" })}
              </label>
              <label className="flex items-center gap-2 font-bold">
                <input checked={product.active} onChange={(event) => setProduct({ ...product, active: event.target.checked })} type="checkbox" />
                {copy({ en: "Product is active", zh: "商品启用中" })}
              </label>
              <button className="btn-primary md:col-start-3" disabled={savingProduct} type="submit">
                {copy({
                  en: product.id ? "Save changes" : "Save product",
                  zh: product.id ? "保存修改" : "保存商品"
                })}
              </button>
            </form>
          ) : null}

          {bulkOpen ? (
            <section className="panel grid gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2>{copy({ en: "Bulk add products", zh: "批量生成商品" })}</h2>
                  <p className="mt-1 max-w-3xl text-sm font-semibold text-[var(--muted)]">
                    {copy({
                      en: "Enter one product per line as Product name, Sale price, English Description. Put the brand first and include a weight such as 400g so PaperMint can generate the SKU.",
                      zh: "每行输入一个商品，格式为“商品名称, 销售价格, 英文 Description”。名称中请先写品牌，并包含 400g 等重量，PaperMint 会据此生成 SKU。"
                    })}
                  </p>
                </div>
                <button className="icon-btn" onClick={() => setBulkOpen(false)} title={copy({ en: "Close", zh: "关闭" })} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                className="field min-h-36 resize-y font-mono text-sm"
                onChange={(event) => setBulkText(event.target.value)}
                placeholder={copy({
                  en: "央尊 咸酥油茶 400g, 12.50, Yangzun Savoury Butter Tea 400g\n盛侨行 竹盐枇杷 500g, 8.99, Shengqiaohang Bamboo Salt Loquat 500g",
                  zh: "央尊 咸酥油茶 400g, 12.50, Yangzun Savoury Butter Tea 400g\n盛侨行 竹盐枇杷 500g, 8.99, Shengqiaohang Bamboo Salt Loquat 500g"
                })}
                value={bulkText}
              />

              {parsedBulk.errors.length ? (
                <div className="rounded-lg border border-[#efcaca] bg-[#fff8f7] p-3 text-sm font-bold text-[var(--rose)]">
                  {parsedBulk.errors.map((error) => (
                    <p key={`${error.line}:${error.code}`}>
                      {error.code === "format"
                        ? copy({
                            en: `Line ${error.line}: use Product name, Sale price, English Description`,
                            zh: `第 ${error.line} 行：请使用“商品名称, 销售价格, 英文 Description”格式`
                          })
                        : copy({
                            en: `Line ${error.line}: sale price must be zero or more`,
                            zh: `第 ${error.line} 行：销售价格不能小于 0`
                          })}
                    </p>
                  ))}
                </div>
              ) : null}

              {generatedBulk.length ? (
                <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white/75">
                  <table className="w-full min-w-[640px] text-left">
                    <thead><tr><Th>SKU</Th><Th>{copy({ en: "Product", zh: "商品" })}</Th><Th>{copy({ en: "Sale price", zh: "销售价格" })}</Th><Th>Description</Th></tr></thead>
                    <tbody>
                      {generatedBulk.map((item) => (
                        <tr className="border-t border-[var(--line)]" key={`${item.line}:${item.sku}`}>
                          <Td><b>{item.sku}</b></Td>
                          <Td>{item.name}</Td>
                          <Td>{formatAud(item.salePrice)}</Td>
                          <Td>{item.description ?? "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-[var(--muted)]">
                  {copy({
                    en: `${generatedBulk.length} valid products · Reorder level 0`,
                    zh: `${generatedBulk.length} 个有效商品 · 补货提醒默认为 0`
                  })}
                </p>
                <button
                  className="btn-primary"
                  disabled={savingBulk || generatedBulk.length === 0 || parsedBulk.errors.length > 0}
                  onClick={saveBulkProducts}
                  type="button"
                >
                  <ListPlus className="h-4 w-4" />
                  {savingBulk
                    ? copy({ en: "Creating...", zh: "正在创建..." })
                    : copy({ en: "Confirm and create products", zh: "确认并生成商品" })}
                </button>
              </div>
            </section>
          ) : null}

          {movementOpen ? (
            <form className="panel grid gap-3 p-5 md:grid-cols-3" onSubmit={saveMovement}>
              <div className="md:col-span-3">
                <h2>{copy({ en: "Record stock change", zh: "记录库存变动" })}</h2>
                <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                  {copy({ en: "Invoice sales are recorded automatically when an invoice is marked Sent.", zh: "发票标记为 Sent 后，相关商品会自动扣减，无需在这里重复记录。" })}
                </p>
              </div>
              <ProductSearchInput
                label={copy({ en: "Product", zh: "商品" })}
                onSelect={(selected) => setMovement({ ...movement, productId: selected?.id ?? "" })}
                placeholder={copy({ en: "Type product name or SKU", zh: "输入商品名称或 SKU" })}
                products={products}
                required
                value={movement.productId}
              />
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
            <div className="flex flex-col gap-3 border-b border-[var(--line)] p-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2>{copy({ en: "Products", zh: "商品" })}</h2>
                <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                  {copy({ en: "Select Edit to update any product information.", zh: "点击“修改”即可更新任何商品资料。" })}
                </p>
              </div>
              <div className="grid w-full gap-2 sm:max-w-xl sm:grid-cols-[minmax(0,1fr)_150px]">
                <label className="relative">
                  <span className="sr-only">{copy({ en: "Filter by SKU or product", zh: "按 SKU 或商品名称筛选" })}</span>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
                  />
                  <input
                    aria-label={copy({ en: "Filter by SKU or product", zh: "按 SKU 或商品名称筛选" })}
                    className="field !pl-10 py-2 text-sm"
                    onChange={(event) => setProductFilter(event.target.value)}
                    placeholder={copy({ en: "Search SKU or product name", zh: "输入 SKU 或商品名称" })}
                    value={productFilter}
                  />
                </label>
                <label>
                  <span className="sr-only">{copy({ en: "Filter by status", zh: "按状态筛选" })}</span>
                  <select
                    aria-label={copy({ en: "Filter by status", zh: "按状态筛选" })}
                    className="field py-2 text-sm"
                    onChange={(event) => setProductStatusFilter(event.target.value as "all" | "active" | "inactive")}
                    value={productStatusFilter}
                  >
                    <option value="all">{copy({ en: "All products", zh: "全部商品" })}</option>
                    <option value="active">{copy({ en: "Active", zh: "启用中" })}</option>
                    <option value="inactive">{copy({ en: "Inactive", zh: "已停用" })}</option>
                  </select>
                </label>
              </div>
            </div>
            {products.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead><tr><Th>SKU / {copy({ en: "Product", zh: "商品" })}</Th><Th>{copy({ en: "On hand", zh: "当前库存" })}</Th><Th>{copy({ en: "Average cost", zh: "平均成本" })}</Th><Th>{copy({ en: "Sale price", zh: "销售价格" })}</Th><Th>{copy({ en: "Stock value", zh: "库存价值" })}</Th><Th>{copy({ en: "Actions", zh: "操作" })}</Th></tr></thead>
                  <tbody>{filteredProducts.map((item) => (
                    <tr className="border-t border-[var(--line)]" key={item.id}>
                      <Td>
                        <div className="flex flex-wrap items-center gap-2">
                          <b>{item.sku}</b>
                          {!item.is_active ? (
                            <span className="rounded bg-[#eef2ef] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--muted)]">
                              {copy({ en: "Inactive", zh: "已停用" })}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[var(--muted)]">{item.name}</div>
                        {item.description ? <div className="max-w-sm truncate text-xs text-[var(--muted)]">{item.description}</div> : null}
                      </Td>
                      <Td><span className={item.reorder_level > 0 && item.quantity_on_hand <= item.reorder_level ? "font-black text-amber-700" : "font-black"}>{item.quantity_on_hand.toFixed(3).replace(/\.000$/, "")}</span></Td>
                      <Td>{formatAud(item.average_cost)}</Td><Td>{formatAud(item.sale_price)}</Td><Td>{formatAud(item.quantity_on_hand * item.average_cost)}</Td>
                      <Td>
                        <button
                          className="btn-secondary px-3 py-2 text-xs"
                          onClick={() => {
                            setProduct(toProductForm(item));
                            setProductOpen(true);
                            setBulkOpen(false);
                          }}
                          type="button"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {copy({ en: "Edit", zh: "修改" })}
                        </button>
                      </Td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 ? (
                    <tr className="border-t border-[var(--line)]">
                      <td className="px-5 py-10 text-center text-sm font-bold text-[var(--muted)]" colSpan={6}>
                        {copy({ en: "No products match this search.", zh: "没有符合该筛选条件的商品。" })}
                      </td>
                    </tr>
                  ) : null}</tbody>
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
