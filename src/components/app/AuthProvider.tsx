"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/supabase";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  demo: boolean;
  startDemo: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    const demoEnabled =
      !configured && window.localStorage.getItem("papermint:demo") === "true";
    if (demoEnabled) {
      setDemo(true);
      setUser(createDemoUser());
      setLoading(false);
      return;
    }

    if (!configured) {
      window.localStorage.setItem("papermint:demo", "true");
      setDemo(true);
      setUser(createDemoUser());
      setLoading(false);
      return;
    }

    window.localStorage.removeItem("papermint:demo");
    setDemo(false);
    const supabase = getSupabaseClient();
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user);
        setLoading(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.localStorage.removeItem("papermint:demo");
      setDemo(false);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  const startDemo = useCallback(() => {
    if (configured) return;
    window.localStorage.setItem("papermint:demo", "true");
    setDemo(true);
    setUser(createDemoUser());
    setLoading(false);
  }, [configured]);

  const signOut = useCallback(async () => {
    window.localStorage.removeItem("papermint:demo");
    setDemo(false);
    if (configured) {
      await getSupabaseClient().auth.signOut();
      setUser(null);
    } else {
      window.localStorage.setItem("papermint:demo", "true");
      setDemo(true);
      setUser(createDemoUser());
    }
  }, [configured]);

  const value = useMemo(
    () => ({ user, loading, configured, demo, startDemo, signOut }),
    [configured, demo, loading, signOut, startDemo, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function createDemoUser(): AuthUser {
  return {
    id: "demo-user",
    app_metadata: {},
    user_metadata: { name: "Demo User" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "demo@papermint.local"
  } as AuthUser;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
