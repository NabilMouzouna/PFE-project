import type { z } from "zod";
import type { AppBaseConfig } from "./appbase";
import type { AuthClient } from "./auth";
import type { ChangeEvent, RecordId } from "@appbase/types";

/** Record returned by the API — includes id, collection, ownerId, data, timestamps. */
export interface DbRecord<T = Record<string, unknown>> {
  id: RecordId;
  collection: string;
  ownerId: string;
  data: T;
  createdAt: string;
  updatedAt: string;
}

/** List response with typed items. */
export interface DbListResponse<T> {
  items: DbRecord<T>[];
  total: number;
}

/** Options for list queries. */
export interface ListOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, string | number | boolean>;
}

/** Zod schema type for inference. */
export type ZodSchema<T> = z.ZodType<T>;

function parseErrorResponse(text: string): { code?: string; message?: string } {
  try {
    const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
    return parsed.error ?? {};
  } catch {
    return { message: text };
  }
}

class DbError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DbError";
  }
}

export class CollectionRef<T extends Record<string, unknown>> {
  constructor(
    private name: string,
    private baseUrl: string,
    private headers: () => Record<string, string>,
    private schema?: ZodSchema<T>,
  ) {}

  private async request<TRes>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<TRes> {
    const url = `${this.baseUrl}/${path}`;
    const headers = { ...this.headers() };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const init: RequestInit = {
      method,
      headers,
      credentials: "include",
      ...(body !== undefined && { body: JSON.stringify(body) }),
    };

    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text();
      const { code, message } = parseErrorResponse(text);
      throw new DbError(message ?? text, code ?? "DB_ERROR");
    }

    if (res.status === 204) return undefined as TRes;
    return res.json() as Promise<TRes>;
  }

  private parseData(data: unknown): T {
    if (this.schema) {
      return this.schema.parse(data) as T;
    }
    return data as T;
  }

  private recordFromApi(raw: { id: string; collection: string; ownerId: string; data: unknown; createdAt: string; updatedAt: string }): DbRecord<T> {
    return {
      id: raw.id,
      collection: raw.collection,
      ownerId: raw.ownerId,
      data: this.parseData(raw.data),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  /** Create a record. Validates with schema if provided. */
  async create(data: T): Promise<DbRecord<T>> {
    if (this.schema) {
      this.schema.parse(data);
    }
    const res = await this.request<{ success: true; data: { id: string; collection: string; ownerId: string; data: T; createdAt: string; updatedAt: string } }>(
      "POST",
      this.name,
      { data },
    );
    return this.recordFromApi(res!.data);
  }

  /** List records. Options: limit, offset, filter (equality on data fields). */
  async list(options?: ListOptions): Promise<DbListResponse<T>> {
    const params = new URLSearchParams();
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.offset != null) params.set("offset", String(options.offset));
    if (options?.filter) params.set("filter", JSON.stringify(options.filter));
    const query = params.toString();
    const path = query ? `${this.name}?${query}` : this.name;

    const res = await this.request<{ success: true; data: { items: { id: string; collection: string; ownerId: string; data: unknown; createdAt: string; updatedAt: string }[]; total: number } }>(
      "GET",
      path,
    );

    const items = (res!.data.items ?? []).map((item) => this.recordFromApi(item));
    return { items, total: res!.data.total };
  }

  /** Get one record by id. Throws DbError with code NOT_FOUND if missing. */
  async get(id: string): Promise<DbRecord<T>> {
    const res = await this.request<{ success: true; data: { id: string; collection: string; ownerId: string; data: unknown; createdAt: string; updatedAt: string } }>(
      "GET",
      `${this.name}/${encodeURIComponent(id)}`,
    );
    return this.recordFromApi(res!.data);
  }

  /** Update a record. Partial data — merged with existing, then sent to server. */
  async update(id: string, data: Partial<T>): Promise<DbRecord<T>> {
    const existing = await this.get(id);
    const merged = { ...existing.data, ...data } as T;
    if (this.schema) {
      this.schema.parse(merged);
    }
    const res = await this.request<{ success: true; data: { id: string; collection: string; ownerId: string; data: T; createdAt: string; updatedAt: string } }>(
      "PUT",
      `${this.name}/${encodeURIComponent(id)}`,
      { data: merged },
    );
    return this.recordFromApi(res!.data);
  }

  /** Delete a record. Throws DbError with code NOT_FOUND if missing. */
  async delete(id: string): Promise<void> {
    await this.request<{ success: true; data: { deleted: boolean } }>(
      "DELETE",
      `${this.name}/${encodeURIComponent(id)}`,
    );
  }

  /** Alias for delete. */
  remove = this.delete;

  /** Subscribe to real-time changes. Uses fetch + ReadableStream (supports auth headers). Returns unsubscribe. */
  subscribe(callback: (event: ChangeEvent<T>) => void): () => void {
    const url = `${this.baseUrl}/${this.name}/subscribe`;
    const controller = new AbortController();
    let closed = false;

    const run = async () => {
      try {
        const res = await fetch(url, {
          headers: this.headers(),
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";
          for (const block of lines) {
            if (closed) break;
            let eventType = "message";
            let data = "";
            for (const line of block.split("\n")) {
              if (line.startsWith("event:")) eventType = line.slice(6).trim();
              else if (line.startsWith("data:")) data = line.slice(5).trim();
            }
            if (data) {
              try {
                const parsed = JSON.parse(data) as ChangeEvent<T>;
                callback(parsed);
              } catch {
                /* ignore */
              }
            }
          }
        }
      } catch {
        if (!closed) run();
      }
    };

    run();
    return () => {
      closed = true;
      controller.abort();
    };
  }
}

export class DbClient {
  constructor(
    private config: AppBaseConfig,
    private auth: AuthClient,
  ) {}

  private get baseUrl() {
    return `${this.config.endpoint}/db/collections`;
  }

  private headers(): Record<string, string> {
    const token = this.auth.getAccessToken();
    return {
      "x-api-key": this.config.apiKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /** Get a typed collection. Schema optional — when provided, validates create/update and parses get/list. */
  collection<T extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    schema?: ZodSchema<T>,
  ): CollectionRef<T> {
    return new CollectionRef<T>(name, this.baseUrl, () => this.headers(), schema);
  }
}

export { DbError };
