import { pinyin } from "pinyin-pro";

export type BulkProductLine = {
  line: number;
  name: string;
  salePrice: number;
  description: string | null;
};

export type BulkProductParseResult = {
  items: BulkProductLine[];
  errors: Array<{
    line: number;
    code: "format" | "price";
  }>;
};

export type GeneratedInventoryProduct = BulkProductLine & {
  sku: string;
  description: string | null;
};

const skuOverrides: Record<string, string> = {
  "央尊咸酥油茶": "YZXSYC",
  "盛侨行竹盐枇杷": "QSHZYPP",
  "西域美农欧若姆高钙夹心奶皮子": "XYMNNPZ"
};

const flavourWords = [
  "原味",
  "经典味",
  "香辣味",
  "麻辣味",
  "烧烤味",
  "海苔味",
  "番茄味",
  "草莓味",
  "巧克力味",
  "香草味",
  "柠檬味",
  "葡萄味",
  "苹果味"
];

export function parseBulkProductLines(value: string): BulkProductParseResult {
  const items: BulkProductLine[] = [];
  const errors: BulkProductParseResult["errors"] = [];

  value.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const lineNumber = index + 1;
    const cells = line.split(/[,，]/).map((cell) => cell.trim());
    if (cells.length < 2 || !cells[0]) {
      errors.push({ line: lineNumber, code: "format" });
      return;
    }
    const salePriceText = cells[1];
    if (!/^-?\d+(?:\.\d{1,3})?$/.test(salePriceText)) {
      errors.push({ line: lineNumber, code: "format" });
      return;
    }
    const salePrice = Number(salePriceText);
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      errors.push({ line: lineNumber, code: "price" });
      return;
    }
    const description = cells.slice(2).join(", ").trim();
    items.push({
      line: lineNumber,
      name: cells[0],
      salePrice,
      description: description || null
    });
  });

  return { items, errors };
}

export function generateInventoryProducts(
  items: BulkProductLine[],
  existingSkus: Iterable<string>
): GeneratedInventoryProduct[] {
  const used = new Set(Array.from(existingSkus, (sku) => sku.toUpperCase()));
  const parts = items.map((item) => productSkuParts(item.name));
  const groupCounts = new Map<string, number>();
  parts.forEach(({ prefix, weight }) => {
    const key = `${prefix}|${weight}`;
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  });
  const groupIndexes = new Map<string, number>();

  return items.map((item, index) => {
    const { prefix, weight } = parts[index];
    const key = `${prefix}|${weight}`;
    const repeatedInBatch = (groupCounts.get(key) ?? 0) > 1;
    let suffixIndex = repeatedInBatch ? (groupIndexes.get(key) ?? 0) : -1;
    groupIndexes.set(key, (groupIndexes.get(key) ?? 0) + 1);
    let candidate = assembleSku(prefix, weight, suffixIndex);

    while (used.has(candidate)) {
      suffixIndex = Math.max(0, suffixIndex + 1);
      candidate = assembleSku(prefix, weight, suffixIndex);
    }
    used.add(candidate);

    return {
      ...item,
      sku: candidate
    };
  });
}

function productSkuParts(name: string) {
  const weightMatch = findWeight(name);
  const withoutWeight = name.replace(weightMatch?.raw ?? "", "");
  const compact = compactName(withoutWeight);
  const override = skuOverrides[compact];
  if (override) return { prefix: override, weight: weightMatch?.code ?? "" };

  let canonical = withoutWeight;
  flavourWords.forEach((word) => {
    canonical = canonical.replaceAll(word, "");
  });
  const prefix = pinyin(canonical, {
    pattern: "first",
    toneType: "none",
    nonZh: "consecutive",
    separator: ""
  })
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "PRODUCT";
  return { prefix, weight: weightMatch?.code ?? "" };
}

function findWeight(name: string) {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(kg|g|mg|ml|l)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const normalized = unit === "kg" || unit === "l" ? value * 1000 : value;
  const code = String(Number(normalized.toFixed(3))).replace(".", "");
  return {
    raw: match[0],
    code,
    label: `${match[1]}${unit}`
  };
}

function assembleSku(prefix: string, weight: string, suffixIndex: number) {
  const suffix = suffixIndex >= 0 ? alphabeticSuffix(suffixIndex) : "";
  return `${prefix}${suffix}${weight}`.toUpperCase();
}

function alphabeticSuffix(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function compactName(value: string) {
  return value.toLowerCase().replace(/[\s\-_/，、,.]/g, "");
}
