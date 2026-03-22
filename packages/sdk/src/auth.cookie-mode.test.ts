import { afterEach, describe, expect, it, vi } from "vitest";
import { AppBase } from "./appbase";

describe("AuthClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("startup refresh uses credentials include when session is stale", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
      json: async () => ({ data: { accessToken: "new-access", expiresIn: 900 } }),
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });

    store.s = JSON.stringify({
      accessToken: "old",
      expiresIn: 900,
      user: {
        id: "u1",
        email: "e@e.com",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      accessTokenIssuedAt: 0,
    });

    const app = AppBase.init({
      endpoint: "http://api.example.test",
      apiKey: "k",
      sessionStorageKey: "s",
    });

    await app.auth.ready();

    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).endsWith("/auth/refresh"),
    );
    expect(refreshCalls.length).toBe(1);
    expect(refreshCalls[0]![1]).toEqual(
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(app.auth.getAuthState().authenticated).toBe(true);
  });
});
