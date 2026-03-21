import type { AppBaseConfig } from "./appbase";
import type {
  Session,
  User,
  RegisterRequest,
  LoginRequest,
  RefreshResponse,
  LogoutResponse,
} from "@appbase/types";

const AUTH_SESSION_EVENT = "appbase:auth-session";

/**
 * What we persist to localStorage: access token + user + expiry metadata only.
 * Refresh token stays in memory (Bearer for /auth/refresh and /auth/logout only).
 */
type PersistedAccessSlice = {
  accessToken: string;
  expiresIn: number;
  user: User;
  accessTokenIssuedAt: number;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notifySessionListeners(): void {
  if (isBrowser()) {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }
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
  /** Full session fields we keep in memory. */
  private session: Session | null = null;
  /** Refresh token: memory only — never written to localStorage. */
  private refreshTokenMemory: string | null = null;
  private accessTokenIssuedAt: number | null = null;

  constructor(private config: AppBaseConfig) {
    if (isBrowser() && this.config.sessionStorageKey) {
      this.restoreFromStorage();
    }
  }

  private get baseUrl() {
    return `${this.config.endpoint}/auth`;
  }

  private get storageKey(): string | undefined {
    return this.config.sessionStorageKey;
  }

  private setSessionFromLogin(session: Session, issuedAt: number): void {
    this.session = session;
    this.refreshTokenMemory = session.refreshToken;
    this.accessTokenIssuedAt = issuedAt;
  }

  private clearSessionInternal(): void {
    this.session = null;
    this.refreshTokenMemory = null;
    this.accessTokenIssuedAt = null;
  }

  /** Persist access slice only (no refresh token). */
  private persist(): void {
    const key = this.storageKey;
    if (!key || !isBrowser()) return;
    if (!this.session || this.accessTokenIssuedAt == null) {
      localStorage.removeItem(key);
      notifySessionListeners();
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
    notifySessionListeners();
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
      this.refreshTokenMemory = null;
      this.accessTokenIssuedAt = parsed.accessTokenIssuedAt;
      this.session = {
        accessToken: parsed.accessToken,
        refreshToken: "",
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
    notifySessionListeners();
  }

  private isAccessTokenStale(): boolean {
    if (!this.session || this.accessTokenIssuedAt == null) return true;
    const ttlMs = this.session.expiresIn * 1000;
    const skewMs = 30_000;
    return Date.now() - this.accessTokenIssuedAt >= ttlMs - skewMs;
  }

  /**
   * After mount: refresh access token if stale **and** refresh token is still in memory.
   * After a full page reload, refresh token is gone — user stays logged in until access JWT expires.
   */
  hydratePersistedSession = async (): Promise<void> => {
    if (!this.storageKey || !this.session) return;
    if (!this.isAccessTokenStale()) return;
    if (!this.refreshTokenMemory) {
      // Access token expired and refresh exists only in memory (gone after reload) — clear stored access.
      this.clearSessionInternal();
      this.clearStorage();
      return;
    }
    try {
      await this.refresh();
    } catch {
      this.clearSessionInternal();
      this.clearStorage();
    }
  };

  signUp = async (data: RegisterRequest): Promise<Session> => {
    const res = await fetch(`${this.baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { data: Session };
    const now = Date.now();
    this.setSessionFromLogin(json.data, now);
    this.persist();
    return json.data;
  };

  signIn = async (data: LoginRequest): Promise<Session> => {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { data: Session };
    const now = Date.now();
    this.setSessionFromLogin(json.data, now);
    this.persist();
    return json.data;
  };

  refresh = async (): Promise<RefreshResponse> => {
    if (!this.session) {
      throw new Error("No active session");
    }
    const rt = this.refreshTokenMemory;
    if (!rt) {
      throw new Error("No refresh token in memory; sign in again after a full page reload");
    }

    const res = await fetch(`${this.baseUrl}/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rt}`,
      },
    });
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
  };

  signOut = async (): Promise<void> => {
    const rt = this.refreshTokenMemory;
    if (rt) {
      const res = await fetch(`${this.baseUrl}/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rt}`,
        },
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json() as { data: LogoutResponse };
    }
    this.clearSessionInternal();
    this.clearStorage();
  };

  getSession = (): Session | null => {
    return this.session;
  };

  getAccessToken = (): string | null => {
    return this.session?.accessToken ?? null;
  };
}

export const AUTH_SESSION_CHANGE_EVENT = AUTH_SESSION_EVENT;
