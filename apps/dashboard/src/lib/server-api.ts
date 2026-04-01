import "server-only";

export async function serverPublicFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${base}${p}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}
