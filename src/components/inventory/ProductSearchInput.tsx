"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { InventoryProduct } from "@/lib/types";

type ProductSearchInputProps = {
  label: string;
  products: InventoryProduct[];
  value: string | null;
  onSelect: (product: InventoryProduct | null) => void;
  placeholder: string;
  onHandLabel?: string;
  required?: boolean;
  compact?: boolean;
};

function productOptionLabel(product: InventoryProduct, onHandLabel?: string) {
  const stock = onHandLabel
    ? ` (${product.quantity_on_hand.toFixed(3).replace(/\.000$/, "")} ${onHandLabel})`
    : "";
  return `${product.sku} · ${product.name}${stock}`;
}

export function ProductSearchInput({
  label,
  products,
  value,
  onSelect,
  placeholder,
  onHandLabel,
  required = false,
  compact = false
}: ProductSearchInputProps) {
  const listId = useId();
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value) ?? null,
    [products, value]
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(selectedProduct ? productOptionLabel(selectedProduct, onHandLabel) : "");
  }, [onHandLabel, selectedProduct]);

  function handleChange(nextQuery: string) {
    setQuery(nextQuery);
    const normalized = nextQuery.trim().toLocaleLowerCase();
    const selected = products.find((product) => {
      const option = productOptionLabel(product, onHandLabel).toLocaleLowerCase();
      return option === normalized ||
        product.sku.toLocaleLowerCase() === normalized ||
        product.name.toLocaleLowerCase() === normalized;
    }) ?? null;
    onSelect(selected);
  }

  return (
    <label>
      <span className="label">{label}</span>
      <span className="relative block">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          className={`field !pl-10 ${compact ? "py-2 text-sm" : ""}`}
          list={listId}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          value={query}
        />
        <datalist id={listId}>
          {products.map((product) => (
            <option key={product.id} value={productOptionLabel(product, onHandLabel)} />
          ))}
        </datalist>
      </span>
    </label>
  );
}
