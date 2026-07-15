"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchBillingStatus } from "@/lib/api";
import { freeBillingStatus } from "@/lib/billing";
import type { BillingStatus } from "@/lib/types";
import { useAuth } from "./AuthProvider";

type BillingContextValue = {
  billing: BillingStatus;
  loading: boolean;
  refreshBilling: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingStatus>(freeBillingStatus());
  const [loading, setLoading] = useState(true);

  const refreshBilling = useCallback(async () => {
    if (!user) {
      setBilling(freeBillingStatus());
      setLoading(false);
      return;
    }
    try {
      setBilling(await fetchBillingStatus(user.id));
    } catch {
      // Keep the app usable before the billing migration is applied.
      setBilling(freeBillingStatus());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refreshBilling();
  }, [refreshBilling]);

  const value = useMemo(
    () => ({ billing, loading, refreshBilling }),
    [billing, loading, refreshBilling]
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) throw new Error("useBilling must be used inside BillingProvider");
  return context;
}
