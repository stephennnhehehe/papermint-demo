import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyDocument, defaultCompanyProfile } from "./documents";
import {
  localDeleteDocument, localFetchPaymentAccounts, localFetchVehicleTrips,
  localFetchVehicles, localSaveDocument, localUpsertPaymentAccount,
  localUpsertVehicle, localUpsertVehicleTrip
} from "./local-store";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

describe("local demo document allowance", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: memoryStorage() }
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("allows five new documents and does not restore usage after deletion", () => {
    const saved = Array.from({ length: 5 }, (_, index) =>
      localSaveDocument("demo-user", {
        ...createEmptyDocument("invoice", defaultCompanyProfile),
        number: `INV20260715${String(index + 1).padStart(3, "0")}`
      })
    );

    const sixth = {
      ...createEmptyDocument("quote", defaultCompanyProfile),
      number: "QT20260715001"
    };
    expect(() => localSaveDocument("demo-user", sixth)).toThrow(
      "FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"
    );

    localDeleteDocument("demo-user", saved[0].id!);
    expect(() => localSaveDocument("demo-user", sixth)).toThrow(
      "FREE_WEEKLY_DOCUMENT_LIMIT_REACHED"
    );
  });
});

describe("local bookkeeping records", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: memoryStorage() }
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("keeps one default payment account per company", () => {
    localUpsertPaymentAccount("demo-user", { name: "Bank", account_type: "bank", company_profile_id: "company", is_default: true });
    localUpsertPaymentAccount("demo-user", { name: "Card", account_type: "credit_card", company_profile_id: "company", is_default: true });

    const accounts = localFetchPaymentAccounts("demo-user");
    expect(accounts.filter((account) => account.is_default)).toHaveLength(1);
    expect(accounts.find((account) => account.is_default)?.name).toBe("Card");
  });

  it("saves vehicles and complete business/private journey records", () => {
    const vehicle = localUpsertVehicle("demo-user", { name: "Delivery van", registration: "ABC123" });
    localUpsertVehicleTrip("demo-user", {
      vehicle_id: vehicle.id,
      start_date: "2026-07-21",
      end_date: "2026-07-21",
      origin: "Warehouse",
      destination: "Customer",
      purpose: "Delivery",
      start_odometer: 1000,
      end_odometer: 1042.5,
      is_business: true
    });

    expect(localFetchVehicles("demo-user")).toMatchObject([{ name: "Delivery van", registration: "ABC123" }]);
    expect(localFetchVehicleTrips("demo-user")).toMatchObject([{
      origin: "Warehouse", destination: "Customer", purpose: "Delivery",
      start_odometer: 1000, end_odometer: 1042.5, is_business: true
    }]);
  });
});
