import { AuthClient } from "./auth.js";
import { StorageClient } from "./storage.js";
import { DbClient } from "./db.js";

export interface AppBaseConfig {
  endpoint: string;
  apiKey: string;
  /**
   * When set (browser only), access token + user + expiry are saved to `localStorage`.
   * Session refresh uses the HttpOnly `appbase_session` cookie (`credentials: 'include'` on `/auth/*`).
   */
  sessionStorageKey?: string;
  /**
   * When true, list() and get() results are cached in memory. Cache is invalidated on create/update/delete.
   * Reduces redundant network requests when the same data is fetched repeatedly.
   */
  dbCache?: boolean;
}

export class AppBase {
  readonly auth: AuthClient;
  readonly storage: StorageClient;
  readonly db: DbClient;

  private constructor(private config: AppBaseConfig) {
    this.auth = new AuthClient(config);
    this.storage = new StorageClient(config, this.auth);
    this.db = new DbClient(config, this.auth, config.dbCache ?? false);
  }

  static init(config: AppBaseConfig): AppBase {
    return new AppBase(config);
  }
}
