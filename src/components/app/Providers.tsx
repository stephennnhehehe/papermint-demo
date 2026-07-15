"use client";

import { AuthProvider } from "./AuthProvider";
import { BillingProvider } from "./BillingProvider";
import { LanguageProvider } from "./LanguageProvider";
import { ToastProvider } from "./ToastProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <BillingProvider>{children}</BillingProvider>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
