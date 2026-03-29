"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppBase } from "./appbase";
import type { AuthState } from "./auth";

type AuthContextValue = {
  appBase: AppBase;
  /** null = still loading (startup restore/refresh); AuthState = ready */
  authState: AuthState | null;
};

const AppBaseContext = createContext<AuthContextValue | null>(null);

export function AppBaseProvider({
  appBase,
  children,
}: {
  appBase: AppBase;
  children: ReactNode;
}) {
  const [authState, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    return appBase.auth.onAuthStateChange(setAuthState);
  }, [appBase]);

  const value = useMemo(
    () => ({ appBase, authState }),
    [appBase, authState],
  );

  return (
    <AppBaseContext.Provider value={value}>{children}</AppBaseContext.Provider>
  );
}

export function useAppBase(): AppBase {
  const value = useContext(AppBaseContext);
  if (!value) throw new Error("useAppBase must be used inside <AppBaseProvider>");
  return value.appBase;
}

/** Auth state + methods. authState is null until startup restore/refresh is done. */
export function useAuth(): {
  authState: AuthState | null;
  signIn: AppBase["auth"]["signIn"];
  signOut: AppBase["auth"]["signOut"];
  signUp: AppBase["auth"]["signUp"];
  getCustomIdentity: AppBase["auth"]["getCustomIdentity"];
  getCurrentUser: AppBase["auth"]["getCurrentUser"];
} {
  const value = useContext(AppBaseContext);
  if (!value) throw new Error("useAuth must be used inside <AppBaseProvider>");
  const { appBase, authState } = value;
  return {
    authState,
    signIn: appBase.auth.signIn,
    signOut: appBase.auth.signOut,
    signUp: appBase.auth.signUp,
    getCustomIdentity: appBase.auth.getCustomIdentity,
    getCurrentUser: appBase.auth.getCurrentUser,
  };
}

/** Redirect to login when not authenticated. Pass router from useRouter() (Next.js) or similar. */
export function useRequireAuth(
  redirectTo = "/sign-in",
  router?: { replace: (url: string) => void },
): {
  authState: AuthState | null;
  authenticated: boolean;
  user: AuthState["user"];
} {
  const { authState } = useAuth();
  useEffect(() => {
    if (authState === null || !router) return;
    if (!authState.authenticated) router.replace(redirectTo);
  }, [authState, redirectTo, router]);

  return {
    authState,
    authenticated: authState?.authenticated ?? false,
    user: authState?.user ?? null,
  };
}
