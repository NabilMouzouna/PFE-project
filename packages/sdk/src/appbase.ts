import { AuthClient } from "./auth";
import { StorageClient } from "./storage";
import { DbClient } from "./db";

export interface AppBaseConfig {
  endpoint: string;
  apiKey: string;
  /**
   * When set (browser only), the auth session is saved to `localStorage` under this key
   * so it survives full page reloads. Sign out clears it.
   */
  sessionStorageKey?: string;
}

export class AppBase {
  readonly auth: AuthClient;
  readonly storage: StorageClient;
  readonly db: DbClient;

  private constructor(private config: AppBaseConfig) {
    this.auth = new AuthClient(config);
    this.storage = new StorageClient(config, this.auth);
    this.db = new DbClient(config, this.auth);
  }

  static init(config: AppBaseConfig): AppBase {
    return new AppBase(config);
  }
}
