import { describe, expect, it } from "vitest";
import { cleanDecimalInput, parseQuickLineItems } from "./line-items";

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
});
