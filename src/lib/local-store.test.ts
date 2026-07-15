import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyDocument, defaultCompanyProfile } from "./documents";
import { localDeleteDocument, localSaveDocument } from "./local-store";

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
