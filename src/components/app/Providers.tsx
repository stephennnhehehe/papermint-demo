"use client";

import { AuthProvider } from "./AuthProvider";
import { BillingProvider } from "./BillingProvider";
import { LanguageProvider } from "./LanguageProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BillingProvider>{children}</BillingProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
