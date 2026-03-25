import { DbError, StorageError } from "@appbase/sdk";

/** Errors that mean the client cannot talk to the API correctly — clear local session and re-authenticate. */
export function shouldClearSessionForApiError(err: unknown): boolean {
  if (err instanceof DbError || err instanceof StorageError) {
    return err.code === "INVALID_API_KEY" || err.code === "INVALID_TOKEN";
  }
  const msg = err instanceof Error ? err.message : "";
  return /invalid api key/i.test(msg) || /invalid token/i.test(msg);
}
