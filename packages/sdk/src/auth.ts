import type { AppBaseConfig } from "./appbase";
import type {
  Session,
  User,
  RegisterRequest,
  LoginRequest,
  RefreshResponse,
  LogoutResponse,
} from "@appbase/types";

/** Auth state for conditional render and protected routes. */
export type AuthState = {
  authenticated: boolean;
  user: { id: string; email: string } | null;
};

/** Persisted in localStorage: access JWT + user + expiry. Session refresh is HttpOnly cookie only. */
type PersistedAccessSlice = {
  accessToken: string;
  expiresIn: number;
  user: User;
  accessTokenIssuedAt: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function isPersistedAccessSlice(value: unknown): value is PersistedAccessSlice {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.accessToken === "string" &&
    typeof o.expiresIn === "number" &&
    o.user != null &&
    typeof o.user === "object" &&
    typeof (o.user as { email?: string }).email === "string" &&
    typeof o.accessTokenIssuedAt === "number"
  );
}

export class AuthClient {
  private session: Session | null = null;
  private accessTokenIssuedAt: number | null = null;
  private listeners = new Set<(state: AuthState) => void>();
  private initPromise: Promise<void>;

  constructor(private config: AppBaseConfig) {
    this.initPromise = (() => {
      if (!isBrowser() || !this.config.sessionStorageKey) return Promise.resolve();
      this.restoreFromStorage();
      if (this.session && this.isAccessTokenStale()) {
        return this.refreshAccessToken()
          .catch(() => {
            this.clearSessionInternal();
            this.clearStorage();
          })
          .then(() => undefined);
      }
      return Promise.resolve();
    })();
  }

  private get baseUrl() {
    return `${this.config.endpoint}/auth`;
  }

  private get storageKey(): string | undefined {
    return this.config.sessionStorageKey;
  }

  /** All `/auth/*` routes require `x-api-key` (same as `auth.http` and API-SPEC). */
  private authFetch(init: RequestInit): RequestInit {
    const headers = new Headers(init.headers ?? undefined);
    headers.set("x-api-key", this.config.apiKey);
    return { ...init, headers, credentials: "include" };
  }

  private setSessionFromLogin(data: Session, issuedAt: number): void {
    this.session = data;
    this.accessTokenIssuedAt = issuedAt;
  }

  private clearSessionInternal(): void {
    this.session = null;
    this.accessTokenIssuedAt = null;
  }

  private notifyListeners(): void {
    const state = this.getAuthState();
    this.listeners.forEach((cb) => cb(state));
  }

  private persist(): void {
    const key = this.storageKey;
    if (!key || !isBrowser()) return;
    if (!this.session || this.accessTokenIssuedAt == null) {
      localStorage.removeItem(key);
      this.notifyListeners();
      return;
    }
    const payload: PersistedAccessSlice = {
      accessToken: this.session.accessToken,
      expiresIn: this.session.expiresIn,
      user: this.session.user,
      accessTokenIssuedAt: this.accessTokenIssuedAt,
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore quota / private mode
    }
    this.notifyListeners();
  }

  private restoreFromStorage(): void {
    const key = this.storageKey;
    if (!key || !isBrowser()) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isPersistedAccessSlice(parsed)) {
        localStorage.removeItem(key);
        return;
      }
      this.accessTokenIssuedAt = parsed.accessTokenIssuedAt;
      this.session = {
        accessToken: parsed.accessToken,
        expiresIn: parsed.expiresIn,
        user: parsed.user,
      };
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }

  private clearStorage(): void {
    const key = this.storageKey;
    if (!key || !isBrowser()) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    this.notifyListeners();
  }

  private isAccessTokenStale(): boolean {
    if (!this.session || this.accessTokenIssuedAt == null) return true;
    const ttlMs = this.session.expiresIn * 1000;
    const skewMs = 30_000;
    return Date.now() - this.accessTokenIssuedAt >= ttlMs - skewMs;
  }

  private async refreshAccessToken(): Promise<RefreshResponse> {
    if (!this.session) throw new Error("No active session");
    const res = await fetch(`${this.baseUrl}/refresh`, this.authFetch({ method: "POST" }));
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { data: RefreshResponse };
    const now = Date.now();
    this.session = {
      ...this.session,
      accessToken: json.data.accessToken,
      expiresIn: json.data.expiresIn,
    };
    this.accessTokenIssuedAt = now;
    this.persist();
    return json.data;
  }

  signUp = async (data: RegisterRequest): Promise<Session> => {
    const res = await fetch(
      `${this.baseUrl}/register`,
      this.authFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { data: Session };
    const now = Date.now();
    this.setSessionFromLogin(json.data, now);
    this.persist();
    return json.data;
  };

  signIn = async (data: LoginRequest): Promise<Session> => {
    const res = await fetch(
      `${this.baseUrl}/login`,
      this.authFetch({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    );
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { data: Session };
    const now = Date.now();
    this.setSessionFromLogin(json.data, now);
    this.persist();
    return json.data;
  };

  signOut = async (): Promise<void> => {
    const res = await fetch(`${this.baseUrl}/logout`, this.authFetch({ method: "POST" }));
    if (!res.ok) throw new Error(await res.text());
    await (res.json() as Promise<{ data: LogoutResponse }>);
    this.clearSessionInternal();
    this.clearStorage();
  };

  /** Current auth state. Use `authenticated` for conditional render or redirect. */
  getAuthState = (): AuthState => {
    const s = this.session;
    if (!s?.user?.id || typeof s.user.email !== "string" || s.user.email.length === 0) {
      return { authenticated: false, user: null };
    }
    if (this.isAccessTokenStale()) {
      return { authenticated: false, user: null };
    }
    return { authenticated: true, user: { id: s.user.id, email: s.user.email } };
  };

  /**
   * Full user row from the session (email, timestamps, `customIdentity`), when the access token is valid.
   * Use for profile UI; prefer {@link getAuthState} for minimal `{ id, email }` checks.
   */
  getCurrentUser = (): User | null => {
    const s = this.session;
    if (!s?.user?.id || typeof s.user.email !== "string" || s.user.email.length === 0) {
      return null;
    }
    if (this.isAccessTokenStale()) {
      return null;
    }
    return s.user;
  };

  /** Resolves when the startup check (restore + optional refresh) is done. Use before gating protected routes. */
  ready = (): Promise<void> => this.initPromise;

  /** Subscribe to auth changes. First callback fires after startup restore/refresh; subsequent callbacks on changes. Returns unsubscribe. */
  onAuthStateChange = (callback: (state: AuthState) => void): (() => void) => {
    let unsubscribed = false;
    const run = (state: AuthState) => {
      if (!unsubscribed) callback(state);
    };
    this.listeners.add(run);
    this.initPromise.then(() => {
      if (!unsubscribed) run(this.getAuthState());
    });
    return () => {
      unsubscribed = true;
      this.listeners.delete(run);
    };
  };

  /** Custom fields from sign-up (`customIdentity`). */
  getCustomIdentity = (): Record<string, string> => {
    const ci = this.session?.user.customIdentity;
    if (!ci || typeof ci !== "object") return {};
    return { ...ci };
  };

  getAccessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  /**
   * Ensures a usable access JWT for protected API routes (`/storage/*`, `/db/*`).
   * Runs the startup restore hook, then refreshes via session cookie when the token is near expiry.
   */
  ensureAccessToken = async (): Promise<string> => {
    await this.initPromise;
    if (!this.session) {
      throw new Error(
        "Not authenticated. Call auth.signIn or auth.signUp before storage or database operations.",
      );
    }
    if (this.isAccessTokenStale()) {
      await this.refreshAccessToken();
    }
    const token = this.session.accessToken;
    if (!token) {
      throw new Error("No access token available.");
    }
    return token;
  };
}
