// src/app/api/files/download.test.ts
import { beforeAll, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { runMigrations } from "../../../scripts/migrate";
import { query } from "../../../lib/db";
import { GET } from "./[id]/download/route";
import * as svc from "../../../lib/files/service";
import { fakeUserSession } from "../../../test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

// seed: reuse storeUpload via service (needs FILES_DIR tmp) — do inline in beforeAll
beforeAll(async () => {
  await runMigrations();
  process.env.FILES_DIR = mkdtempSync(path.join(os.tmpdir(), "teamdocs-dl-"));
  const { rows } = await query(
    `INSERT INTO users (id, email, name, password_hash, role)
     VALUES ('00000000-0000-0000-0000-000000000002', 'user@test.local', 'User', 'x', 'user')
     ON CONFLICT (id) DO NOTHING RETURNING id`
  );
  const userId = rows[0]?.id ?? "00000000-0000-0000-0000-000000000002";
  // DB persists between runs; drop leftover seed file so current-version is v1
  await query("DELETE FROM file_versions");
  await query("DELETE FROM files");
  globalThis.__TEST_SESSION__ = fakeUserSession;
  // dl.docx (not an inline ext) so this exercises the attachment branch;
  // spec §7: pdf/images are inline
  const up = await svc.storeUpload({ filename: "dl.docx", note: null, userId, stream: Readable.from([Buffer.from("0123456789")]) });
  globalThis.__FILE_ID__ = up.fileId;
});

// Next 15 passes params as a Promise; build the real ctx shape
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

it("streams full file with attachment disposition", async () => {
  const res = await GET(new Request(`http://t/api/files/${globalThis.__FILE_ID__}/download`), ctx(globalThis.__FILE_ID__!));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-disposition")).toContain('attachment; filename="dl.docx"');
  expect(await res.text()).toBe("0123456789");
});

it("supports Range 2-5", async () => {
  const res = await GET(new Request(`http://t/api/files/${globalThis.__FILE_ID__}/download`, { headers: { range: "bytes=2-5" } }), ctx(globalThis.__FILE_ID__!));
  expect(res.status).toBe(206);
  expect(res.headers.get("content-range")).toBe("bytes 2-5/10");
  expect(await res.text()).toBe("2345");
});

it("404 unknown file", async () => {
  const missing = "99999999-9999-9999-9999-999999999999";
  const res = await GET(new Request(`http://t/api/files/${missing}/download`), ctx(missing));
  expect(res.status).toBe(404);
});
