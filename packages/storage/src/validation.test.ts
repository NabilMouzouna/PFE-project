import { describe, expect, it } from "vitest";
import { validateBucket, isMimeAllowed } from "./validation";

describe("validateBucket", () => {
  it("accepts valid names", () => {
    expect(validateBucket("avatars").valid).toBe(true);
    expect(validateBucket("app_assets-1").valid).toBe(true);
  });

  it("rejects empty and traversal-ish names", () => {
    expect(validateBucket("").valid).toBe(false);
    expect(validateBucket("a/b").valid).toBe(false);
    expect(validateBucket("..").valid).toBe(false);
    expect(validateBucket("bucket.name").valid).toBe(false);
  });
});

describe("isMimeAllowed", () => {
  it("allows all when patterns are null", () => {
    expect(isMimeAllowed("application/octet-stream", null)).toBe(true);
  });

  it("matches exact and wildcard patterns", () => {
    const cfg = "image/png,application/pdf,text/*";
    expect(isMimeAllowed("image/png", cfg)).toBe(true);
    expect(isMimeAllowed("text/plain", cfg)).toBe(true);
    expect(isMimeAllowed("application/json", cfg)).toBe(false);
  });
});
