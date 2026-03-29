import "server-only";

/** HTTP header values must be ISO-8859-1 / ByteString; masked previews use Unicode bullets and will throw in `Headers.set`. */
export function validateDashboardApiKeyForHeader(key: string): { ok: true; value: string } | { ok: false; code: string } {
  const value = key.trim();
  if (value.length === 0) {
    return { ok: false, code: "EMPTY" };
  }
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) {
      return { ok: false, code: "NON_LATIN1" };
    }
  }
  return { ok: true, value };
}
