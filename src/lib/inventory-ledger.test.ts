import { describe, expect, it } from "vitest";
import { calculateInventoryPosition } from "./inventory-ledger";

function movement(
  id: string,
  quantityDelta: number,
  unitCost: number,
  date: string
) {
  return {
    id,
    quantity_delta: quantityDelta,
    unit_cost: unitCost,
    movement_date: date,
    created_at: `${date}T00:00:00.000Z`
  };
}

describe("inventory ledger recalculation", () => {
  it("recalculates quantity and weighted average cost in ledger order", () => {
    const result = calculateInventoryPosition([
      movement("sale", -4, 0, "2026-07-03"),
      movement("purchase-two", 10, 20, "2026-07-02"),
      movement("purchase-one", 10, 10, "2026-07-01")
    ]);

    expect(result.quantityOnHand).toBe(16);
    expect(result.averageCost).toBe(15);
  });

  it("reflects a corrected historical movement", () => {
    const before = calculateInventoryPosition([
      movement("purchase", 10, 12, "2026-07-01"),
      movement("loss", -2, 0, "2026-07-02")
    ]);
    const after = calculateInventoryPosition([
      movement("purchase", 8, 15, "2026-07-01"),
      movement("loss", -1, 0, "2026-07-02")
    ]);

    expect(before).toEqual({ quantityOnHand: 8, averageCost: 12 });
    expect(after).toEqual({ quantityOnHand: 7, averageCost: 15 });
  });
});
