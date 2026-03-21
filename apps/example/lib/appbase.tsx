"use client";

import { AppBase } from "@appbase/sdk";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getPublicEnv } from "./env";

type AppBaseContextValue = {
  appBase: AppBase;
  /** False until persisted session hydration (and optional token refresh) finishes. */
  authHydrated: boolean;
};

const AppBaseContext = createContext<AppBaseContextValue | null>(null);

export function AppBaseProvider({ children }: { children: ReactNode }) {
  const [authHydrated, setAuthHydrated] = useState(false);

  const appBase = useMemo(() => {
    const env = getPublicEnv();
    return AppBase.init({
      endpoint: env.endpoint,
      apiKey: env.apiKey,
      sessionStorageKey: "appbase_example_session",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void appBase.auth
      .hydratePersistedSession()
      .finally(() => {
        if (!cancelled) setAuthHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [appBase]);

  const value = useMemo(() => ({ appBase, authHydrated }), [appBase, authHydrated]);

  return <AppBaseContext.Provider value={value}>{children}</AppBaseContext.Provider>;
}

export function useAppBase(): AppBase {
  const value = useContext(AppBaseContext);
  if (!value) {
    throw new Error("useAppBase must be used inside <AppBaseProvider>");
  }
  return value.appBase;
}

export function useAuthHydrated(): boolean {
  const value = useContext(AppBaseContext);
  if (!value) {
    throw new Error("useAuthHydrated must be used inside <AppBaseProvider>");
  }
  return value.authHydrated;
}
