const BUCKET_MAX = 64;
const BUCKET_REGEX = /^[a-zA-Z0-9_-]+$/;

export function validateBucket(name: string): { valid: true } | { valid: false; error: string } {
  if (typeof name !== "string" || name.length === 0) {
    return { valid: false, error: "Bucket name is required" };
  }
  if (name.length > BUCKET_MAX) {
    return { valid: false, error: `Bucket name must be at most ${BUCKET_MAX} characters` };
  }
  if (!BUCKET_REGEX.test(name)) {
    return {
      valid: false,
      error: "Bucket name may only contain letters, numbers, hyphens, and underscores",
    };
  }
  return { valid: true };
}

/**
 * MIME allowlist (e.g. from env `STORAGE_ALLOWED_MIME`). `configuredPatterns === null` → allow all.
 */
export function isMimeAllowed(mimeType: string, configuredPatterns: string | null): boolean {
  if (!configuredPatterns) return true;
  const normalized = mimeType.trim().toLowerCase();
  const patterns = configuredPatterns
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const p of patterns) {
    if (p === normalized) return true;
    if (p.endsWith("/*")) {
      const prefix = p.slice(0, -1);
      if (normalized.startsWith(prefix)) return true;
    }
  }
  return false;
}
