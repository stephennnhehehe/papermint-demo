import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  localDeleteInventoryProduct,
  localFetchInventoryMovements,
  localFetchInventoryProducts,
  localRecordInventoryMovement,
  localReplaceInventoryMovement,
  localUpsertInventoryProduct
} from "./local-store";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("local inventory editing", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: new MemoryStorage() }
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("updates a manual movement and recalculates the product position", () => {
    const product = localUpsertInventoryProduct("user", {
      name: "Test product",
      sku: "TEST-EDIT"
    });
    const movement = localRecordInventoryMovement("user", {
      product_id: product.id,
      movement_type: "purchase",
      quantity_delta: 3,
      unit_cost: 4,
      movement_date: "2026-07-01",
      reference: "PO-1",
      notes: null,
      source_type: "manual",
      source_id: null
    });

    localReplaceInventoryMovement("user", movement.id, {
      product_id: product.id,
      movement_type: "purchase",
      quantity_delta: 5,
      unit_cost: 6,
      movement_date: "2026-07-02",
      reference: "PO-2",
      notes: "Corrected",
      source_type: "manual",
      source_id: null
    });

    expect(localFetchInventoryProducts("user")[0]).toMatchObject({
      quantity_on_hand: 5,
      average_cost: 6
    });
    expect(localFetchInventoryMovements("user")[0]).toMatchObject({
      id: movement.id,
      quantity_delta: 5,
      unit_cost: 6,
      reference: "PO-2"
    });
  });

  it("hides a deleted product while preserving its movement history", () => {
    const product = localUpsertInventoryProduct("user", {
      name: "Delete safely",
      sku: "TEST-DELETE"
    });
    localRecordInventoryMovement("user", {
      product_id: product.id,
      movement_type: "opening",
      quantity_delta: 2,
      unit_cost: 0,
      movement_date: "2026-07-01",
      reference: null,
      notes: null,
      source_type: "manual",
      source_id: null
    });

    localDeleteInventoryProduct("user", product.id);

    expect(localFetchInventoryProducts("user")).toEqual([]);
    expect(localFetchInventoryMovements("user")).toHaveLength(1);
  });
});
