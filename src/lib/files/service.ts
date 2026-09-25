// src/lib/files/service.ts
import { randomUUID } from "node:crypto";
import path from "node:path";
import { rename } from "node:fs/promises";
import { query } from "../db";
import { filesDir, saveStream, removeFile } from "./store";
import { extFromFilename } from "./limits";

export interface FileWithCurrent { id: string; name: string; ext: string; currentVersion: number; currentSize: number; updatedAt: string; uploadedByName: string }
export interface FileVersionRow { version: number; size: number; sha256: string; note: string | null; uploadedByName: string; createdAt: string }
export interface FileDetail { file: FileWithCurrent; versions: FileVersionRow[] }

export async function storeUpload(input: { filename: string; note: string | null; userId: string; stream: NodeJS.ReadableStream }): Promise<{ fileId: string; version: number; isNewFile: boolean }> {
  const name = input.filename.trim();
  const ext = extFromFilename(name);
  if (!name) throw Object.assign(new Error("empty name"), { code: "BAD_NAME" });

  const existing = (await query("SELECT id FROM files WHERE name = $1", [name])).rows[0];
  const fileId = existing ? existing.id : randomUUID();
  const dir = path.join(filesDir(), fileId);
  const absPath = path.join(dir, `__pending__.tmp`);

  const saved = await saveStream(input.stream, absPath);

  try {
    let version: number;
    if (existing) {
      const { rows } = await query("SELECT COALESCE(MAX(version), 0) + 1 AS v FROM file_versions WHERE file_id = $1", [fileId]);
      version = rows[0].v;
    } else {
      version = 1;
    }
    const storagePath = `${fileId}/${version}.${ext || "bin"}`;
    await rename(absPath, path.join(filesDir(), storagePath));

    // files row must exist first: file_versions.file_id is a NOT NULL FK to files(id)
    if (!existing) {
      await query(`INSERT INTO files (id, name, ext, created_by) VALUES ($1,$2,$3,$4)`, [fileId, name, ext, input.userId]);
    }
    const { rows: verRows } = await query(
      `INSERT INTO file_versions (file_id, version, storage_path, size, sha256, note, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [fileId, version, storagePath, saved.bytes, saved.sha256, input.note, input.userId]
    );
    await query(`UPDATE files SET current_version_id = $1 WHERE id = $2`, [verRows[0].id, fileId]);
    return { fileId, version, isNewFile: !existing };
  } catch (e) {
    await removeFile(absPath);
    throw e;
  }
}

export async function listFiles(limit: number, offset: number): Promise<{ items: FileWithCurrent[]; total: number }> {
  const { rows: items } = await query(
    `SELECT f.id, f.name, f.ext,
            COALESCE(v.version, 0) AS "currentVersion",
            COALESCE(v.size, 0) AS "currentSize",
            COALESCE(v.created_at, f.created_at) AS "updatedAt",
            u.name AS "uploadedByName"
     FROM files f
     LEFT JOIN file_versions v ON v.id = f.current_version_id
     LEFT JOIN users u ON u.id = v.uploaded_by
     ORDER BY f.name LIMIT $1 OFFSET $2`, [limit, offset]);
  const { rows: total } = await query(`SELECT count(*)::int AS n FROM files`);
  return { items: items as FileWithCurrent[], total: total[0].n };
}

export async function getFileDetail(id: string): Promise<FileDetail | null> {
  const f = (await query(
    `SELECT f.id, f.name, f.ext, COALESCE(v.version,0) AS "currentVersion", COALESCE(v.size,0) AS "currentSize",
            COALESCE(v.created_at, f.created_at) AS "updatedAt", u.name AS "uploadedByName"
     FROM files f LEFT JOIN file_versions v ON v.id = f.current_version_id LEFT JOIN users u ON u.id = v.uploaded_by
     WHERE f.id = $1`, [id])).rows[0] as FileWithCurrent | undefined;
  if (!f) return null;
  const { rows } = await query(
    `SELECT v.version, v.size, v.sha256, v.note, u.name AS "uploadedByName", v.created_at AS "createdAt"
     FROM file_versions v LEFT JOIN users u ON u.id = v.uploaded_by
     WHERE v.file_id = $1 ORDER BY v.version DESC`, [id]);
  return { file: f, versions: rows as FileVersionRow[] };
}

export async function getFileForDownload(id: string, version?: number) {
  const row = version
    ? (await query(`SELECT v.storage_path, v.size, f.name, f.ext FROM files f JOIN file_versions v ON v.id = f.current_version_id OR v.file_id = f.id WHERE f.id = $1 AND v.version = $2`, [id, version])).rows[0]
    : (await query(`SELECT v.storage_path, v.size, f.name, f.ext FROM files f JOIN file_versions v ON v.id = f.current_version_id WHERE f.id = $1`, [id])).rows[0];
  if (!row) return null;
  return { ...row, storagePath: path.join(filesDir(), row.storage_path), name: row.name, ext: row.ext, size: row.size, current: !version };
}

export async function restoreVersion(fileId: string, version: number): Promise<void> {
  const f = (await query("SELECT id FROM files WHERE id = $1", [fileId])).rows[0];
  if (!f) throw Object.assign(new Error("not found"), { code: "NOT_FOUND" });
  const v = (await query("SELECT id FROM file_versions WHERE file_id = $1 AND version = $2", [fileId, version])).rows[0];
  if (!v) throw Object.assign(new Error("no such version"), { code: "VERSION_NOT_FOUND" });
  await query("UPDATE files SET current_version_id = $1 WHERE id = $2", [v.id, fileId]);
}

export async function deleteFile(fileId: string): Promise<void> {
  const { rows } = await query("SELECT storage_path FROM file_versions WHERE file_id = $1", [fileId]);
  await query("DELETE FROM files WHERE id = $1", [fileId]); // ON DELETE CASCADE removes versions
  for (const r of rows) await removeFile(path.join(filesDir(), r.storage_path));
}
