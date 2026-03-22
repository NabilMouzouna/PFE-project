"use client";

import { useMemo } from "react";
import { AppBase } from "@appbase/sdk";
import { AppBaseProvider as SDKProvider } from "@appbase/sdk/react";
import { getPublicEnv } from "./env";

export function AppBaseProvider({ children }: { children: React.ReactNode }) {
  const appBase = useMemo(() => {
    const env = getPublicEnv();
    return AppBase.init({
      endpoint: env.endpoint,
      apiKey: env.apiKey,
      sessionStorageKey: "appbase_example_session",
      dbCache: true,
    });
  }, []);

  return <SDKProvider appBase={appBase}>{children}</SDKProvider>;
}

export { useAppBase, useAuth, useRequireAuth } from "@appbase/sdk/react";
