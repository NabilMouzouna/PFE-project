import type { Readable } from "node:stream";

export type PutObjectInput = {
  /** Opaque relative key (e.g. `objects/<id>`), no user-controlled path segments. */
  objectKey: string;
  stream: Readable;
};

export type PutObjectResult = {
  objectKey: string;
  size: number;
  checksum: string;
};

/**
 * Storage backends (local FS, future S3). Callers depend on this interface, not raw `fs`.
 */
export interface StorageDriver {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObjectStream(objectKey: string): Readable;
  deleteObject(objectKey: string): Promise<void>;
  exists(objectKey: string): Promise<boolean>;
}
