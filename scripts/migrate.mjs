#!/usr/bin/env node
// Minimal migration runner for Render Postgres — there's no Supabase CLI on
// this stack. Applies db/migrations/*.sql in filename order, tracking what
// ran in a `_migrations` table, mirroring the numbered-file convention the
// project already used for supabase/migrations/.
//
// Schema/migration authorship is Mark Cabatuan's per Constitution Principle
// III; this script is only the mechanism that applies whatever lands in
// db/migrations/.
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "db", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const { rows: applied } = await client.query("select name from _migrations");
    const appliedNames = new Set(applied.map((row) => row.name));

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedNames.has(file)) {
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), "utf8");
      console.log(`Applying ${file}...`);

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw new Error(`Migration ${file} failed: ${err.message}`, { cause: err });
      }
    }

    console.log("Migrations up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
