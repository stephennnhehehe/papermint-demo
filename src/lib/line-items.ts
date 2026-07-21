import type { LineItem } from "./types";

const NO_GST_VALUES = new Set(["0", "false", "n", "no", "no gst", "nogst", "无", "否"]);

export function cleanDecimalInput(value: string, allowNegative = false, decimalPlaces = 3) {
  const trimmed = value.trimStart();
  const sign = allowNegative && trimmed.startsWith("-") ? "-" : "";
  const unsigned = trimmed.replaceAll("-", "").replace(/[^\d.]/g, "");
  const dotIndex = unsigned.indexOf(".");
  const wholeRaw = dotIndex >= 0 ? unsigned.slice(0, dotIndex) : unsigned;
  const decimals = dotIndex >= 0
    ? unsigned.slice(dotIndex + 1).replaceAll(".", "").slice(0, decimalPlaces)
    : "";
  const whole = wholeRaw.replace(/^0+(?=\d)/, "");

  if (!whole && dotIndex < 0) return sign;
  if (dotIndex >= 0) return `${sign}${whole || "0"}.${decimals}`;
  return `${sign}${whole}`;
}

export function decimalValue(value: string, allowNegative = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return allowNegative ? parsed : Math.max(0, parsed);
}

function parseNumber(value: string, allowNegative: boolean, fallback: number) {
  const withoutCurrency = value.replace(/[$\s]/g, "");
  const cleaned = cleanDecimalInput(withoutCurrency, allowNegative);
  if (!cleaned || cleaned === "-") return fallback;
  return decimalValue(cleaned, allowNegative);
}

function splitRow(row: string) {
  if (row.includes("\t")) return row.split("\t");
  if (row.includes("|")) return row.split("|");
  return row.split(",");
}

export type QuickLineItem = Omit<LineItem, "id">;

export function normalizeLineItems(items: LineItem[]): LineItem[] {
  const roundThree = (value: number) => Math.round((Number(value) || 0) * 1000) / 1000;
  return items.map((item) => ({
    ...item,
    quantity: Math.max(0, roundThree(item.quantity)),
    unitPrice: roundThree(item.unitPrice),
    gstEnabled: item.gstEnabled !== false
  }));
}

/**
 * Parses rows in one of these compact forms:
 * description | details | quantity | unit price | GST
 * description | details | quantity | unit price
 * description | quantity | unit price
 * description | unit price
 */
export function parseQuickLineItems(value: string): QuickLineItem[] {
  return value
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => splitRow(row).map((cell) => cell.trim()))
    .map((cells) => {
      let description = cells[0] ?? "";
      let details = "";
      let quantity = 1;
      let unitPrice = 0;
      let gstEnabled = true;

      if (cells.length >= 5) {
        [description, details] = cells;
        quantity = parseNumber(cells[2], false, 1);
        unitPrice = parseNumber(cells[3], true, 0);
        gstEnabled = !NO_GST_VALUES.has(cells[4].toLowerCase());
      } else if (cells.length === 4) {
        [description, details] = cells;
        quantity = parseNumber(cells[2], false, 1);
        unitPrice = parseNumber(cells[3], true, 0);
      } else if (cells.length === 3) {
        description = cells[0];
        quantity = parseNumber(cells[1], false, 1);
        unitPrice = parseNumber(cells[2], true, 0);
      } else if (cells.length === 2) {
        description = cells[0];
        unitPrice = parseNumber(cells[1], true, 0);
      }

      return {
        description,
        details,
        quantity,
        unitPrice,
        gstEnabled,
        discount: { type: "percent" as const, value: 0 }
      };
    })
    .filter((item) => item.description || item.details || item.unitPrice !== 0);
}
