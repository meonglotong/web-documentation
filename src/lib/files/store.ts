// src/lib/files/store.ts
import { createWriteStream, createReadStream as fsCreateReadStream } from "node:fs";
import { promises as fsp } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { ReadStream } from "node:fs";

export function filesDir(): string {
  return process.env.FILES_DIR || "./.data/files";
}

export async function saveStream(stream: NodeJS.ReadableStream, absPath: string): Promise<{ bytes: number; sha256: string }> {
  await fsp.mkdir(path.dirname(absPath), { recursive: true });
  const out = createWriteStream(absPath);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    bytes += buf.length;
    hash.update(buf);
    out.write(buf);
  }
  out.end();
  await new Promise<void>((res, rej) => { out.on("finish", () => res()); out.on("error", rej); });
  return { bytes, sha256: hash.digest("hex") };
}

export function createReadStream(absPath: string, opts?: { start?: number; end?: number }): ReadStream {
  return fsCreateReadStream(absPath, opts);
}

export function removeFile(absPath: string): Promise<void> {
  return fsp.unlink(absPath).catch((e) => { if (e.code !== "ENOENT") throw e; });
}
