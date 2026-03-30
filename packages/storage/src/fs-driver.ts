import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import type { Readable } from "node:stream";
import type { PutObjectInput, PutObjectResult, StorageDriver } from "./driver";

function assertSafeObjectKey(root: string, objectKey: string): string {
  const abs = path.resolve(root, objectKey);
  const rootResolved = path.resolve(root);
  if (!abs.startsWith(rootResolved + path.sep) && abs !== rootResolved) {
    throw new Error("Invalid object key: path escapes storage root");
  }
  return abs;
}

/**
 * Volume-backed filesystem driver: atomic writes (temp + rename), streaming reads, SHA-256 checksum.
 */
export class FileSystemStorageDriver implements StorageDriver {
  constructor(private readonly rootDir: string) {}

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const targetAbs = assertSafeObjectKey(this.rootDir, input.objectKey);
    const tmpAbs = `${targetAbs}.${process.pid}.${Date.now()}.tmp`;
    fs.mkdirSync(path.dirname(targetAbs), { recursive: true });

    const hash = createHash("sha256");
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        size += chunk.length;
        hash.update(chunk);
        cb(null, chunk);
      },
    });

    await pipeline(input.stream, meter, createWriteStream(tmpAbs, { flags: "wx" }));

    try {
      fs.renameSync(tmpAbs, targetAbs);
    } catch {
      try {
        fs.unlinkSync(tmpAbs);
      } catch {
        /* ignore */
      }
      throw new Error("Failed to finalize storage object");
    }

    return {
      objectKey: input.objectKey,
      size,
      checksum: hash.digest("hex"),
    };
  }

  getObjectStream(objectKey: string): Readable {
    const abs = assertSafeObjectKey(this.rootDir, objectKey);
    return createReadStream(abs);
  }

  async deleteObject(objectKey: string): Promise<void> {
    const abs = assertSafeObjectKey(this.rootDir, objectKey);
    await fs.promises.unlink(abs).catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return;
      throw err;
    });
  }

  async exists(objectKey: string): Promise<boolean> {
    try {
      const abs = assertSafeObjectKey(this.rootDir, objectKey);
      await fs.promises.access(abs, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists relative object keys under `objects/` for reconciliation (FS driver only).
   */
  async listStoredObjectKeys(): Promise<string[]> {
    const objectsDir = path.join(this.rootDir, "objects");
    if (!fs.existsSync(objectsDir)) return [];
    const names = await fs.promises.readdir(objectsDir, { withFileTypes: true });
    const out: string[] = [];
    for (const ent of names) {
      if (ent.isFile()) {
        out.push(path.posix.join("objects", ent.name));
      }
    }
    return out;
  }
}
