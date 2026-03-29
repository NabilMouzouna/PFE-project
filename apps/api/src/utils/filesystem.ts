import fs from "node:fs";
import path from "node:path";

export function ensureParentDirectory(filePath: string) {
  if (filePath === ":memory:" || filePath.startsWith("file:")) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
