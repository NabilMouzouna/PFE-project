"use client";

export class BffError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "BffError";
  }
}

/** BFF admin routes that require `DASHBOARD_API_KEY` (full raw key, not the masked preview). */
export function isAdminBffConfigError(error: unknown): error is BffError {
  return (
    error instanceof BffError &&
    (error.code === "DASHBOARD_API_KEY_MISSING" || error.code === "INVALID_DASHBOARD_API_KEY")
  );
}

export async function bffJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { code?: string; message?: string };
  };
  if (!res.ok || data.success === false) {
    const msg = data.error?.message ?? res.statusText;
    throw new BffError(msg, res.status, data.error?.code);
  }
  return data as unknown as T;
}

export async function bffData<T>(path: string, init?: RequestInit): Promise<T> {
  const wrapped = await bffJson<{ success: true; data: T }>(path, init);
  return wrapped.data;
}
