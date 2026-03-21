"use client";

import { AUTH_SESSION_CHANGE_EVENT } from "@appbase/sdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppBase, useAuthHydrated } from "./appbase";

export function useAuthSession() {
  const appBase = useAppBase();
  const [session, setSession] = useState(() => appBase.auth.getSession());

  const refreshSession = () => setSession(appBase.auth.getSession());

  useEffect(() => {
    const sync = () => setSession(appBase.auth.getSession());
    sync();
    window.addEventListener(AUTH_SESSION_CHANGE_EVENT, sync);
    return () => window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, sync);
  }, [appBase]);

  return {
    session,
    hasSession: Boolean(session),
    refreshSession,
  };
}

export function useRequireAuth(redirectTo = "/sign-in") {
  const router = useRouter();
  const authHydrated = useAuthHydrated();
  const { hasSession } = useAuthSession();

  useEffect(() => {
    if (!authHydrated) return;
    if (!hasSession) router.replace(redirectTo);
  }, [authHydrated, hasSession, router, redirectTo]);

  return { hasSession, authHydrated };
}

