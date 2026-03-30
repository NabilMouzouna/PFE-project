import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { Readable } from "node:stream";
import { FileSystemStorageDriver } from "./fs-driver";

describe("FileSystemStorageDriver", () => {
  let root: string;
  let driver: FileSystemStorageDriver;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "appbase-storage-"));
    driver = new FileSystemStorageDriver(root);
  });

  it("putObject, exists, getObjectStream, deleteObject roundtrip", async () => {
    const key = "objects/testid001";
    const buf = Buffer.from("hello-bytes");
    await driver.putObject({ objectKey: key, stream: Readable.from(buf) });
    expect(await driver.exists(key)).toBe(true);

    const chunks: Buffer[] = [];
    for await (const c of driver.getObjectStream(key)) {
      chunks.push(c as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe("hello-bytes");

    await driver.deleteObject(key);
    expect(await driver.exists(key)).toBe(false);
  });

  it("putObject returns sha256 checksum and size", async () => {
    const key = "objects/abc";
    const body = Buffer.from("checksum-me");
    const res = await driver.putObject({ objectKey: key, stream: Readable.from(body) });
    expect(res.size).toBe(body.length);
    expect(res.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects object keys that escape root", async () => {
    await expect(
      driver.putObject({ objectKey: "../escape", stream: Readable.from(Buffer.from("x")) }),
    ).rejects.toThrow(/Invalid object key/);
  });
});
