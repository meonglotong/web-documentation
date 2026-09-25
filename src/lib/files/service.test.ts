// src/lib/files/service.test.ts
import { beforeAll, beforeEach, it, expect } from "vitest";
import { runMigrations } from "../../scripts/migrate";
import { query, closePool } from "../db";
import { Readable } from "node:stream";
import path from "node:path";
import * as svc from "./service";

let adminId: string;

beforeAll(async () => {
  await runMigrations();
  process.env.FILES_DIR = path.join(process.cwd(), ".data", "test-files");
  const ins = await query(
    "INSERT INTO users (email, name, password_hash, role) VALUES ('fs@test.local','FS','x','admin') ON CONFLICT DO NOTHING RETURNING id"
  );
  const id = ins.rows[0]?.id ?? (await query("SELECT id FROM users WHERE email='fs@test.local'")).rows[0].id;
  adminId = id;
});

beforeEach(async () => {
  await query("DELETE FROM file_versions");
  await query("DELETE FROM files");
});

it("upload creates file v1", async () => {
  const r = await svc.storeUpload({ filename: "report.pdf", note: "v awal", userId: adminId, stream: Readable.from([Buffer.from("pdf-data")]) });
  expect(r).toMatchObject({ version: 1, isNewFile: true });
  const detail = await svc.getFileDetail(r.fileId);
  expect(detail?.file.currentVersion).toBe(1);
  expect(detail?.versions[0].note).toBe("v awal");
});

it("re-upload same name = v2, pointer moves", async () => {
  const a = await svc.storeUpload({ filename: "same.docx", note: null, userId: adminId, stream: Readable.from([Buffer.from("v1")]) });
  const b = await svc.storeUpload({ filename: "same.docx", note: "update", userId: adminId, stream: Readable.from([Buffer.from("v2-v2-v2")]) });
  expect(b.fileId).toBe(a.fileId);
  expect(b.version).toBe(2);
  const d = await svc.getFileDetail(a.fileId);
  expect(d?.file.currentVersion).toBe(2);
  expect(d?.versions).toHaveLength(2);
});

it("restore moves pointer back without deleting", async () => {
  await svc.storeUpload({ filename: "r.xlsx", note: null, userId: adminId, stream: Readable.from([Buffer.from("1")]) });
  const b = await svc.storeUpload({ filename: "r.xlsx", note: null, userId: adminId, stream: Readable.from([Buffer.from("22")]) });
  await svc.restoreVersion(b.fileId, 1);
  const d = await svc.getFileDetail(b.fileId);
  expect(d?.file.currentVersion).toBe(1);
  expect(d?.versions).toHaveLength(2);
});

it("delete removes all versions + disk files", async () => {
  const a = await svc.storeUpload({ filename: "del.zip", note: null, userId: adminId, stream: Readable.from([Buffer.from("zz")]) });
  await svc.deleteFile(a.fileId);
  const d = await svc.getFileDetail(a.fileId);
  expect(d).toBeNull();
});

it("unknown file restore throws VERSION_NOT_FOUND", async () => {
  const a = await svc.storeUpload({ filename: "only1.txt", note: null, userId: adminId, stream: Readable.from([Buffer.from("1")]) });
  await expect(svc.restoreVersion(a.fileId, 9)).rejects.toMatchObject({ code: "VERSION_NOT_FOUND" });
});
