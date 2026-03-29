import type { AppBaseConfig } from "./appbase.js";
import type { AuthClient } from "./auth.js";
import type { FileRecord, BucketListResponse, UploadResponse } from "@appbase/types";

/** File metadata row returned by the API (API-SPEC §6). */
export type StorageFile = FileRecord;

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export type StorageUploadOptions = {
  /** Original filename (Blob/Buffer/stream). Ignored when `input` is a `File` (uses `File.name`). */
  filename?: string;
  /** MIME type hint for Blob/Buffer/stream bodies. */
  contentType?: string;
};

/** Supported upload bodies: browser `File` / `Blob` / `FormData` (`file` field); Node `Buffer` / `Uint8Array` / readable stream. */
export type StorageUploadInput =
  | File
  | Blob
  | FormData
  | Buffer
  | Uint8Array
  | import("node:stream").Readable;

export type StorageDownloadOptions = {
  /**
   * Return shape. Default: `blob` in browsers, `buffer` in Node.
   * Streams are fully buffered; avoid multi‑GB files until a streaming API exists.
   */
  as?: "blob" | "buffer";
};

const BUCKET_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function parseApiError(text: string, status: number): { code: string; message: string } {
  try {
    const j = JSON.parse(text) as { error?: { code?: string; message?: string } };
    if (j.error?.message) {
      return {
        code: j.error.code ?? "REQUEST_FAILED",
        message: j.error.message,
      };
    }
  } catch {
    /* ignore */
  }
  return { code: status === 401 ? "INVALID_TOKEN" : "HTTP_ERROR", message: text || `HTTP ${status}` };
}

function assertValidBucket(bucket: string): void {
  if (typeof bucket !== "string" || !bucket.trim()) {
    throw new StorageError("Bucket name is required", "VALIDATION_ERROR");
  }
  if (!BUCKET_PATTERN.test(bucket)) {
    throw new StorageError(
      "Bucket must be 1–64 characters: letters, digits, hyphens, and underscores only",
      "VALIDATION_ERROR",
    );
  }
}

function assertValidFileId(fileId: string): void {
  if (typeof fileId !== "string" || !fileId.trim()) {
    throw new StorageError("fileId is required", "VALIDATION_ERROR");
  }
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(fileId)) {
    throw new StorageError("fileId format is invalid", "VALIDATION_ERROR");
  }
}

function isFile(x: unknown): x is File {
  return typeof File !== "undefined" && x instanceof File;
}

function uint8ToBlobSlice(u8: Uint8Array, contentType?: string): Blob {
  const copy = Uint8Array.from(u8);
  return new Blob([copy], contentType ? { type: contentType } : undefined);
}

async function buildUploadFormData(
  input: StorageUploadInput,
  options?: StorageUploadOptions,
): Promise<FormData> {
  if (input instanceof FormData) {
    if (!input.has("file")) {
      throw new StorageError("FormData must include a multipart field named \"file\"", "VALIDATION_ERROR");
    }
    return input;
  }

  const form = new FormData();
  const filename = options?.filename;
  const contentType = options?.contentType;

  if (isFile(input)) {
    form.append("file", input);
    return form;
  }

  if (input instanceof Blob) {
    form.append("file", input, filename ?? "upload");
    return form;
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
    const u8 = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    const blob = uint8ToBlobSlice(u8, contentType);
    form.append("file", blob, filename ?? "upload");
    return form;
  }

  if (input instanceof Uint8Array) {
    const blob = uint8ToBlobSlice(input, contentType);
    form.append("file", blob, filename ?? "upload");
    return form;
  }

  const { Readable } = await import("node:stream");
  const { blob: streamToBlob } = await import("node:stream/consumers");
  if (Readable.isReadable?.(input as NodeJS.ReadableStream)) {
    const b = await streamToBlob(input as import("node:stream").Readable);
    form.append("file", b as unknown as Blob, filename ?? "upload");
    return form;
  }

  throw new StorageError("Unsupported upload body type", "VALIDATION_ERROR");
}

export class StorageClient {
  constructor(
    private config: AppBaseConfig,
    private auth: AuthClient,
  ) {}

  private get baseUrl() {
    return `${this.config.endpoint}/storage`;
  }

  private async authorizedInit(base: RequestInit): Promise<RequestInit> {
    const token = await this.auth.ensureAccessToken();
    const headers = new Headers(base.headers);
    headers.set("x-api-key", this.config.apiKey);
    headers.set("Authorization", `Bearer ${token}`);
    if (base.body instanceof FormData) {
      headers.delete("Content-Type");
    }
    return {
      ...base,
      headers,
      credentials: "include",
    };
  }

  private async handleResponse(res: Response): Promise<void> {
    if (res.ok) return;
    const text = await res.text();
    const { code, message } = parseApiError(text, res.status);
    throw new StorageError(message, code, res.status);
  }

  /**
   * Public URL path for a file (same host as `endpoint`). Does not verify existence.
   */
  getUrl(bucket: string, fileId: string): string {
    assertValidBucket(bucket);
    assertValidFileId(fileId);
    return `${this.baseUrl}/buckets/${encodeURIComponent(bucket)}/${encodeURIComponent(fileId)}`;
  }

  /**
   * Upload a file (`multipart` field name `file` per API-SPEC §6).
   */
  async upload(
    bucket: string,
    input: StorageUploadInput,
    options?: StorageUploadOptions,
  ): Promise<UploadResponse> {
    assertValidBucket(bucket);
    const form = await buildUploadFormData(input, options);
    const init = await this.authorizedInit({
      method: "POST",
      body: form,
    });
    const res = await fetch(`${this.baseUrl}/buckets/${encodeURIComponent(bucket)}/upload`, init);
    await this.handleResponse(res);
    const json = (await res.json()) as { data: UploadResponse };
    return json.data;
  }

  async list(bucket: string): Promise<BucketListResponse> {
    assertValidBucket(bucket);
    const init = await this.authorizedInit({ method: "GET" });
    const res = await fetch(`${this.baseUrl}/buckets/${encodeURIComponent(bucket)}`, init);
    await this.handleResponse(res);
    const json = (await res.json()) as { data: BucketListResponse };
    return json.data;
  }

  /**
   * Download file bytes. Default: `Blob` in browser, `Buffer` in Node.
   */
  async download(
    bucket: string,
    fileId: string,
    options?: StorageDownloadOptions,
  ): Promise<Blob | Buffer> {
    assertValidBucket(bucket);
    assertValidFileId(fileId);
    const init = await this.authorizedInit({ method: "GET" });
    const res = await fetch(
      `${this.baseUrl}/buckets/${encodeURIComponent(bucket)}/${encodeURIComponent(fileId)}`,
      init,
    );
    await this.handleResponse(res);

    const defaultAs: StorageDownloadOptions["as"] =
      options?.as ?? (typeof globalThis.window !== "undefined" ? "blob" : "buffer");

    if (defaultAs === "buffer") {
      return Buffer.from(await res.arrayBuffer());
    }
    return res.blob();
  }

  async remove(bucket: string, fileId: string): Promise<void> {
    assertValidBucket(bucket);
    assertValidFileId(fileId);
    const init = await this.authorizedInit({ method: "DELETE" });
    const res = await fetch(
      `${this.baseUrl}/buckets/${encodeURIComponent(bucket)}/${encodeURIComponent(fileId)}`,
      init,
    );
    await this.handleResponse(res);
  }

  /** Alias for {@link remove}. */
  delete = this.remove;
}
