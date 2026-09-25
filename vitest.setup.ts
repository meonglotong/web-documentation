// vitest.setup.ts
import pg from "pg";
import { afterAll } from "vitest";

const base = new pg.Client({ connectionString: "postgres://mac@localhost/postgres?host=/tmp" });
await base.connect();
const { rows } = await base.query("SELECT 1 FROM pg_database WHERE datname = 'teamdocs_test'");
if (rows.length === 0) await base.query("CREATE DATABASE teamdocs_test");
await base.end();

process.env.DATABASE_URL = "postgres://mac@localhost/teamdocs_test?host=/tmp";
process.env.FILES_DIR = process.env.FILES_DIR || `${process.cwd()}/.data/test-files`;

afterAll(async () => {
  const { closePool } = await import("@/lib/db");
  await closePool();
});
