import fs from "node:fs";
import path from "node:path";

export function ensureParentDirectory(filePath: string) {
  if (filePath === ":memory:" || filePath.startsWith("file:")) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * Ensures the local storage root exists, `objects/` exists, and the volume is writable.
 * Safe to call on every upload or health check if the directory was removed at runtime.
 */
export function ensureStorageRootReady(storageRoot: string): void {
  fs.mkdirSync(storageRoot, { recursive: true });
  fs.mkdirSync(path.join(storageRoot, "objects"), { recursive: true });
  const probe = path.join(storageRoot, ".write-check");
  try {
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Storage root is not writable: ${storageRoot} (${cause})`);
  }
}
