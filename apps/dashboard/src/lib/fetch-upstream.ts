function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause && (cause as { code?: string }).code === "ECONNREFUSED") {
    return true;
  }
  return err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED");
}

/**
 * `fetch` to the AppBase API; on network failure returns 503 JSON the UI can show instead of an empty 500 body.
 */
export async function fetchApiUpstream(url: string, init: RequestInit, apiBaseLabel: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store" });
  } catch (e: unknown) {
    const message = isConnectionError(e)
      ? `Cannot reach the AppBase API at ${apiBaseLabel}. Start the API (for example \`pnpm --filter api dev\` from the monorepo root) or set API_BASE_URL on the dashboard to the API’s public URL.`
      : e instanceof Error
        ? `API request failed: ${e.message}`
        : "API request failed.";
    return Response.json(
      { success: false, error: { code: "UPSTREAM_UNAVAILABLE", message } },
      { status: 503 },
    );
  }
}
