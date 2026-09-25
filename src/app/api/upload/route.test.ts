// src/app/api/upload/route.test.ts
import { beforeAll, beforeEach, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runMigrations } from "../../../scripts/migrate";
import { query } from "../../../lib/db";
import { POST } from "./route";
import { fakeAdminSession } from "../../../test/fixtures";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__TEST_SESSION__ ?? null),
}));

beforeAll(async () => {
  await runMigrations();
  // throwaway storage dir so uploads never touch real data
  process.env.FILES_DIR = mkdtempSync(path.join(os.tmpdir(), "teamdocs-upload-"));
  const { rows } = await query(
    `INSERT INTO users (id, email, name, password_hash, role)
     VALUES ('00000000-0000-0000-0000-000000000001', 'admin@test.local', 'Admin', 'x', 'admin')
     ON CONFLICT (id) DO NOTHING RETURNING id`
  );
  globalThis.__TEST_USER__ = rows[0]?.id;
});

beforeEach(async () => {
  // DB persists between runs; keep "new file" assertions deterministic
  await query("DELETE FROM file_versions");
  await query("DELETE FROM files");
});

it("rejects unauthenticated", async () => {
  globalThis.__TEST_SESSION__ = null;
  const form = new FormData();
  form.append("file", new File([Buffer.from("x")], "a.txt"));
  const res = await POST(new Request("http://t/api/upload", { method: "POST", body: form }));
  expect(res.status).toBe(401);
});

it("stores a new file as v1 (201)", async () => {
  globalThis.__TEST_SESSION__ = fakeAdminSession;
  const form = new FormData();
  form.append("file", new File([new TextEncoder().encode("isi awal")], "dokumen.txt", { type: "text/plain" }));
  form.append("note", "versi pertama");
  const res = await POST(new Request("http://t/api/upload", { method: "POST", body: form }));
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.version).toBe(1);
  expect(body.isNewFile).toBe(true);
});

it("413 for oversized file", async () => {
  globalThis.__TEST_SESSION__ = fakeAdminSession;
  const form = new FormData();
  form.append("file", new File([new Uint8Array(101 * 1024 * 1024)], "big.bin"));
  const res = await POST(new Request("http://t/api/upload", { method: "POST", body: form }));
  expect(res.status).toBe(413);
});
