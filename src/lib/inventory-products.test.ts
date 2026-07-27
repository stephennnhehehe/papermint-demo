import { describe, expect, it } from "vitest";
import {
  generateInventoryProducts,
  parseBulkProductLines
} from "./inventory-products";

describe("bulk inventory products", () => {
  it("parses product, sale price and a user-provided description per line", () => {
    const result = parseBulkProductLines(
      "央尊 咸酥油茶 400g, 12.50, Yangzun Savoury Butter Tea 400g\n盛侨行 竹盐枇杷 500g，8.999，Shengqiaohang Bamboo Salt Loquat 500g"
    );

    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        line: 1,
        name: "央尊 咸酥油茶 400g",
        salePrice: 12.5,
        description: "Yangzun Savoury Butter Tea 400g"
      },
      {
        line: 2,
        name: "盛侨行 竹盐枇杷 500g",
        salePrice: 8.999,
        description: "Shengqiaohang Bamboo Salt Loquat 500g"
      }
    ]);
  });

  it("reports malformed rows without discarding valid rows", () => {
    const result = parseBulkProductLines("Valid Product 100g, 4.50\nMissing price");

    expect(result.items).toHaveLength(1);
    expect(result.errors).toEqual([{ line: 2, code: "format" }]);
  });

  it("matches the requested Chinese SKU examples", () => {
    const parsed = parseBulkProductLines(
      "央尊 咸酥油茶 400g, 12.50, Yangzun Savoury Butter Tea 400g\n盛侨行 竹盐枇杷 500g, 8.99, Shengqiaohang Bamboo Salt Loquat 500g\n西域美农 欧若姆高钙夹心奶皮子 280g, 16.80, Xiyumeinong Orum High-Calcium Filled Milk Skin 280g"
    );
    const generated = generateInventoryProducts(parsed.items, []);

    expect(generated.map((item) => item.sku)).toEqual([
      "YZXSYC400",
      "QSHZYPP500",
      "XYMNNPZ280"
    ]);
    expect(generated.map((item) => item.description)).toEqual([
      "Yangzun Savoury Butter Tea 400g",
      "Shengqiaohang Bamboo Salt Loquat 500g",
      "Xiyumeinong Orum High-Calcium Filled Milk Skin 280g"
    ]);
  });

  it("uses A/B/C for same-weight flavour variants and avoids existing SKUs", () => {
    const parsed = parseBulkProductLines(
      "央尊 咸酥油茶 原味 400g, 12.50\n央尊 咸酥油茶 香辣味 400g, 12.50\n央尊 咸酥油茶 麻辣味 400g, 12.50"
    );
    const generated = generateInventoryProducts(parsed.items, ["YZXSYCA400"]);

    expect(generated.map((item) => item.sku)).toEqual([
      "YZXSYCB400",
      "YZXSYCC400",
      "YZXSYCD400"
    ]);
  });
});
