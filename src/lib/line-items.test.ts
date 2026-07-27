import { describe, expect, it } from "vitest";
import { cleanDecimalInput, normalizeLineItems, parseQuickLineItems, reorderLineItems } from "./line-items";

describe("line item input", () => {
  it("allows signed prices with at most three decimal places", () => {
    expect(cleanDecimalInput("-0012.3459", true)).toBe("-12.345");
    expect(cleanDecimalInput("--4.2", true)).toBe("-4.2");
  });

  it("removes negative signs from quantities", () => {
    expect(cleanDecimalInput("-2.3459")).toBe("2.345");
  });

  it("parses pasted line item rows", () => {
    const items = parseQuickLineItems("Apples | Red carton | 2.5 | 12.345 | GST\nReturned crate | 1 | -8.5");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ description: "Apples", details: "Red carton", quantity: 2.5, unitPrice: 12.345, gstEnabled: true });
    expect(items[1]).toMatchObject({ description: "Returned crate", quantity: 1, unitPrice: -8.5 });
  });

  it("marks legacy negative-price lines as returns without changing their order", () => {
    const items = normalizeLineItems([
      { id: "sale", description: "Apples", details: "", quantity: 2, unitPrice: 10, gstEnabled: true, discount: { type: "percent", value: 0 } },
      { id: "return", description: "Expired apples", details: "", quantity: 1, unitPrice: -10, gstEnabled: true, discount: { type: "percent", value: 0 } }
    ]);

    expect(items.map((item) => item.id)).toEqual(["sale", "return"]);
    expect(items[0].itemType).toBe("sale");
    expect(items[1].itemType).toBe("return");
  });

  it("reorders line items using their stable ids", () => {
    const items = normalizeLineItems([
      { id: "first", description: "First", details: "", quantity: 1, unitPrice: 1, gstEnabled: true, discount: { type: "percent", value: 0 } },
      { id: "second", description: "Second", details: "", quantity: 1, unitPrice: 2, gstEnabled: true, discount: { type: "percent", value: 0 } },
      { id: "third", description: "Third", details: "", quantity: 1, unitPrice: 3, gstEnabled: true, discount: { type: "percent", value: 0 } }
    ]);

    expect(reorderLineItems(items, "third", "first").map((item) => item.id)).toEqual(["third", "first", "second"]);
  });
});
