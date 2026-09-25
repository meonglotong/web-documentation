// src/scripts/migrate.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { query, closePool } from "../lib/db";

export async function runMigrations(): Promise<void> {
  const sql = readFileSync(
    path.join(import.meta.dirname, "..", "lib", "schema.sql"),
    "utf8"
  );
  await query(sql);
}

if (process.argv[1] === import.meta.url.replace("file://", "")) {
  runMigrations()
    .then(() => { console.log("migrations ok"); return closePool(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
