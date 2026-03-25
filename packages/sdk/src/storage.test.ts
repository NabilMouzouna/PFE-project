import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { StorageClient } from "./storage";
import type { AuthClient } from "./auth";

const mockConfig = {
  endpoint: "http://api.test",
  apiKey: "hs_live_test",
};

function mockAuth(token = "mock-token"): AuthClient & { ensureAccessToken: ReturnType<typeof vi.fn> } {
  return {
    getAccessToken: () => token,
    ensureAccessToken: vi.fn().mockResolvedValue(token),
  } as AuthClient & { ensureAccessToken: ReturnType<typeof vi.fn> };
}

describe("StorageClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("upload sends multipart field file and returns UploadResponse", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          file: {
            id: "f1",
            bucket: "docs",
            filename: "a.txt",
            mimeType: "text/plain",
            size: 4,
            ownerId: "u1",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          url: "/storage/buckets/docs/f1",
        },
      }),
    });

    const auth = mockAuth();
    const storage = new StorageClient(mockConfig, auth);
    const file = new Blob(["hey"], { type: "text/plain" });
    const result = await storage.upload("docs", file, { filename: "a.txt" });

    expect(auth.ensureAccessToken).toHaveBeenCalled();
    expect(result.url).toContain("/storage/buckets/docs/f1");
    expect(result.file.id).toBe("f1");
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe("http://api.test/storage/buckets/docs/upload");
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("x-api-key")).toBe("hs_live_test");
    expect(headers.get("Authorization")).toBe("Bearer mock-token");
    expect(headers.get("Content-Type")).toBeNull();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("rejects empty bucket before fetch", async () => {
    const storage = new StorageClient(mockConfig, mockAuth());
    await expect(storage.upload("", new Blob([]))).rejects.toMatchObject({
      name: "StorageError",
      code: "VALIDATION_ERROR",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps 413 payload errors to StorageError", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 413,
      text: async () =>
        JSON.stringify({
          success: false,
          error: { code: "PAYLOAD_TOO_LARGE", message: "Too big" },
        }),
    });

    const storage = new StorageClient(mockConfig, mockAuth());
    await expect(storage.upload("docs", new Blob(["x"]))).rejects.toMatchObject({
      name: "StorageError",
      code: "PAYLOAD_TOO_LARGE",
      status: 413,
    });
  });

  it("maps API error envelope to StorageError", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({
          success: false,
          error: { code: "NOT_FOUND", message: "File not found" },
        }),
    });

    const storage = new StorageClient(mockConfig, mockAuth());
    await expect(storage.list("docs")).rejects.toMatchObject({
      name: "StorageError",
      code: "NOT_FOUND",
      message: "File not found",
      status: 404,
    });
  });

  it("list returns files and total", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          total: 1,
          files: [
            {
              id: "f1",
              bucket: "b",
              filename: "x.png",
              mimeType: "image/png",
              size: 10,
              ownerId: "u1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      }),
    });

    const storage = new StorageClient(mockConfig, mockAuth());
    const r = await storage.list("b");
    expect(r.total).toBe(1);
    expect(r.files[0]!.filename).toBe("x.png");
  });

  it("download with as buffer uses arrayBuffer", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });

    const storage = new StorageClient(mockConfig, mockAuth());
    const buf = await storage.download("docs", "abcdefgh12345678901", { as: "buffer" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect([...(buf as Buffer)]).toEqual([1, 2, 3]);
  });

  it("download with as blob calls res.blob", async () => {
    const blob = new Blob([new Uint8Array([9])]);
    fetchMock.mockResolvedValue({
      ok: true,
      blob: async () => blob,
    });

    const storage = new StorageClient(mockConfig, mockAuth());
    const out = await storage.download("docs", "abcdefgh12345678901", { as: "blob" });
    expect(out).toBe(blob);
  });

  it("remove calls DELETE", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { deleted: true } }),
    });

    const storage = new StorageClient(mockConfig, mockAuth());
    await storage.remove("docs", "abcdefgh12345678901");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/storage/buckets/docs/abcdefgh12345678901",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("getUrl encodes path segments", () => {
    const storage = new StorageClient(mockConfig, mockAuth());
    expect(storage.getUrl("my-bucket", "abcd1234abcd1234abcd12")).toBe(
      "http://api.test/storage/buckets/my-bucket/abcd1234abcd1234abcd12",
    );
  });
});
