#!/usr/bin/env node
// Applies db/seed.sql against DATABASE_URL. Dev/test convenience only — not
// run as part of the Render deploy (see render.yaml's startCommand, which
// only runs scripts/migrate.mjs). Ported from qr-menu-dev's supabase/seed.sql.
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname);
  const ssl = isLocalHost ? undefined : { rejectUnauthorized: false };
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl });

  try {
    const sql = await readFile(join(__dirname, "..", "db", "seed.sql"), "utf8");
    await pool.query(sql);
    console.log("Seed data applied.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
