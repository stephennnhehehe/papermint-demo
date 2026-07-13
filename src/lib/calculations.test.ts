import { describe, expect, it } from "vitest";
import { calculateTotals, discountAmount } from "./calculations";
import { generateDocumentNumber, sanitizeDocumentNumber } from "./documents";

describe("invoice calculations", () => {
  it("caps fixed discounts at the base amount", () => {
    expect(discountAmount(50, { type: "fixed", value: 100 })).toBe(50);
  });

  it("calculates line discounts, order discount and GST", () => {
    const totals = calculateTotals(
      [
        {
          id: "1",
          description: "Design",
          details: "",
          quantity: 2,
          unitPrice: 100,
          discount: { type: "percent", value: 10 }
        }
      ],
      { type: "fixed", value: 30 },
      true,
      10
    );

    expect(totals.subtotalBeforeDiscount).toBe(200);
    expect(totals.lineDiscountTotal).toBe(20);
    expect(totals.subtotal).toBe(180);
    expect(totals.orderDiscountTotal).toBe(30);
    expect(totals.gst).toBe(15);
    expect(totals.total).toBe(165);
  });

  it("excludes no-GST line items from GST totals", () => {
    const totals = calculateTotals(
      [
        {
          id: "1",
          description: "Taxable",
          details: "",
          quantity: 1,
          unitPrice: 100,
          gstEnabled: true,
          discount: { type: "percent", value: 0 }
        },
        {
          id: "2",
          description: "GST free",
          details: "",
          quantity: 1,
          unitPrice: 100,
          gstEnabled: false,
          discount: { type: "percent", value: 0 }
        }
      ],
      { type: "percent", value: 0 },
      true,
      10
    );

    expect(totals.gst).toBe(10);
    expect(totals.total).toBe(210);
  });
});

describe("document numbering", () => {
  it("keeps invoice numbers alphanumeric", () => {
    expect(sanitizeDocumentNumber("ACME Pty Ltd #42")).toBe("ACMEPTYLTD42");
    expect(generateDocumentNumber("Li & Co.", "invoice")).toMatch(/^[A-Z0-9]+$/);
  });

  it("generates date-based sequential numbers", () => {
    expect(
      generateDocumentNumber("", "invoice", [
        { number: "INV20260713001", type: "invoice", issue_date: "2026-07-13" }
      ], "2026-07-13")
    ).toBe("INV20260713002");
  });
});
