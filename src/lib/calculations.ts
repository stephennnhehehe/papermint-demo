import type { Discount, LineItem, Totals } from "./types";

export function clampMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function discountAmount(base: number, discount: Discount): number {
  const rawValue = Number(discount.value) || 0;
  if (rawValue <= 0 || base <= 0) return 0;
  if (discount.type === "percent") {
    return clampMoney(Math.min(base, base * (rawValue / 100)));
  }
  return clampMoney(Math.min(base, rawValue));
}

export function lineSubtotalBeforeDiscount(item: LineItem): number {
  return clampMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
}

export function lineTotal(item: LineItem): number {
  const base = lineSubtotalBeforeDiscount(item);
  return clampMoney(base - discountAmount(base, item.discount));
}

export function lineGstAmount(
  item: LineItem,
  allItems: LineItem[],
  orderDiscount: Discount,
  gstEnabled: boolean,
  gstRate = 10
): number {
  if (!gstEnabled || item.gstEnabled === false) return 0;
  const lineBase = lineTotal(item);
  const subtotal = clampMoney(allItems.reduce((sum, current) => sum + lineTotal(current), 0));
  const orderDiscountTotal = discountAmount(subtotal, orderDiscount);
  const discountShare = subtotal > 0 ? orderDiscountTotal * (lineBase / subtotal) : 0;
  const taxableLineAmount = clampMoney(Math.max(0, lineBase - discountShare));
  return clampMoney(taxableLineAmount * ((Number(gstRate) || 0) / 100));
}

export function calculateTotals(
  items: LineItem[],
  orderDiscount: Discount,
  gstEnabled: boolean,
  gstRate = 10
): Totals {
  const subtotalBeforeDiscount = clampMoney(
    items.reduce((sum, item) => sum + lineSubtotalBeforeDiscount(item), 0)
  );
  const subtotal = clampMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
  const lineDiscountTotal = clampMoney(subtotalBeforeDiscount - subtotal);
  const orderDiscountTotal = discountAmount(subtotal, orderDiscount);
  const taxableAmount = clampMoney(
    items
      .filter((item) => item.gstEnabled !== false)
      .reduce((sum, item) => {
        const base = lineTotal(item);
        const discountShare = subtotal > 0 ? orderDiscountTotal * (base / subtotal) : 0;
        return sum + Math.max(0, base - discountShare);
      }, 0)
  );
  const gst = gstEnabled ? clampMoney(taxableAmount * ((Number(gstRate) || 0) / 100)) : 0;
  const total = clampMoney(Math.max(0, subtotal - orderDiscountTotal) + gst);

  return {
    subtotalBeforeDiscount,
    lineDiscountTotal,
    subtotal,
    orderDiscountTotal,
    taxableAmount,
    gst,
    total
  };
}

export function formatAud(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD"
  }).format(Number.isFinite(value) ? value : 0);
}
