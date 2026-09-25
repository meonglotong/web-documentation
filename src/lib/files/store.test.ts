// src/lib/files/store.test.ts
import { beforeAll, afterAll, it, expect } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { saveStream, createReadStream, removeFile } from "./store";

let dir: string;
beforeAll(async () => { dir = await mkdtemp(path.join(tmpdir(), "teamdocs-store-")); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

it("saves a stream and computes sha256", async () => {
  const stream = Readable.from([Buffer.from("halo dunia")]);
  const p = path.join(dir, "a.txt");
  const { bytes, sha256 } = await saveStream(stream, p);
  expect(bytes).toBe(10);
  expect(sha256).toBe(await sha256Of("halo dunia"));
  expect(await readFile(p, "utf8")).toBe("halo dunia");
});

it("range read returns slice", async () => {
  const p = path.join(dir, "range.txt");
  await writeFile(p, "0123456789");
  const chunk = await streamToString(createReadStream(p, { start: 2, end: 5 }));
  expect(chunk).toBe("2345");
});

it("removeFile deletes", async () => {
  const p = path.join(dir, "gone.txt");
  await writeFile(p, "x");
  await removeFile(p);
  expect(exists(p)).toBe(false);
});

// --- helpers (node crypto/fs) ---
async function sha256Of(text: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(text);
  return hash.digest("hex");
}
async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
function exists(p: string): boolean {
  return existsSync(p);
}
