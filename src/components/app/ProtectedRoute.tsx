"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="panel flex items-center gap-3 px-5 py-4 text-sm font-semibold text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading PaperMint
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
